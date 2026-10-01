const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const realPrisma = require('@prisma/client');

function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, FormData, Date, Map, require: (id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === 'react/jsx-runtime') return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  } });
  return exports;
}

function fixture() {
  const rows = ['TRANSFER', 'CUSTOMER_OUT', 'MANUFACTURER_IN', 'ADJUSTMENT'].map((type) => ({
    id: type, type, productId: 'product', quantity: 3, note: type === 'TRANSFER' ? null : 'đơn KOL',
    sourceLocationId: type === 'TRANSFER' ? 'main' : 'retail', destinationLocationId: type === 'TRANSFER' ? 'retail' : null,
    createdById: 'staff', createdAt: new Date('2026-09-20T12:00:00Z'), referenceNo: 'ref',
  }));
  const balances = { main: 20, retail: 10 };
  const writes = [];
  let authenticated = true;
  let beforeWrite = () => {};
  const invalidated = [];
  const matches = (row, where) => row.id === where.id && where.type.in.includes(row.type);
  const prisma = {
    inventoryTransaction: {
      findFirst: async ({ where }) => { const row = rows.find((r) => matches(r, where)); return row ? { id: row.id } : null; },
      updateMany: async ({ where, data }) => {
        beforeWrite();
        assert.deepEqual(Object.keys(data), ['note']);
        const row = rows.find((r) => matches(r, where));
        if (!row) return { count: 0 };
        writes.push({ where, data });
        Object.assign(row, data);
        return { count: 1 };
      },
      create: async ({ data }) => { const row = { id: `new-${rows.length}`, ...data }; rows.push(row); return row; },
    },
    location: { findMany: async () => [{ id: 'main', code: 'KHO_TONG' }, { id: 'retail', code: 'KHO_LE' }] },
    inventoryBalance: {
      findUnique: async ({ where }) => ({ quantity: balances[where.productId_locationId.locationId] }),
      update: async ({ where, data }) => { balances[where.productId_locationId.locationId] -= data.quantity.decrement; },
      upsert: async ({ where, update }) => { balances[where.productId_locationId.locationId] += update.quantity.increment; },
    },
    $transaction: async (fn) => fn(prisma),
  };
  const data = load('src/lib/warehouse-data.ts', { '@prisma/client': realPrisma, '@/lib/prisma': { prisma } });
  const action = load('src/app/actions/warehouse.ts', {
    '@prisma/client': realPrisma, 'zod': require('zod'), 'next/cache': { revalidatePath: (path) => invalidated.push(path) },
    '@/lib/auth': { requireUser: async () => { if (!authenticated) throw new Error('login-required'); return { id: 'staff', role: 'OPERATION' }; }, requireAdmin: () => { throw new Error('must not require admin'); } },
    '@/lib/password': {}, '@/lib/prisma': { prisma }, '@/lib/warehouse-data': data,
  });
  return { action, rows, balances, writes, invalidated, data, prisma,
    setAuthenticated: (value) => { authenticated = value; }, setBeforeWrite: (fn) => { beforeWrite = fn; } };
}

function withoutNotes(rows) { return JSON.stringify(rows.map((row) => { const copy = { ...row }; delete copy.note; return copy; })); }

test('OPERATION can edit/add/clear notes for both outbound types; every other field and balance stays identical', async () => {
  const f = fixture();
  const before = withoutNotes(f.rows);
  const inventory = JSON.stringify(f.balances);
  for (const [id, input, expected] of [
    ['CUSTOMER_OUT', '  đơn KOL - Shopee 123  ', 'đơn KOL - Shopee 123'],
    ['TRANSFER', 'Hàng mẫu', 'Hàng mẫu'],
    ['CUSTOMER_OUT', '  \n\t ', null],
    ['TRANSFER', '', null],
    ['CUSTOMER_OUT', 'Tiếng Việt 🧾\nDòng hai', 'Tiếng Việt 🧾\nDòng hai'],
    ['TRANSFER', '-', '-'],
    ['TRANSFER', 'ấ'.repeat(500), 'ấ'.repeat(500)],
  ]) {
    const result = await f.action.updateOutboundNoteAction({ transactionId: id, note: input });
    assert.equal(result.status, 'success');
    assert.equal(result.note, expected);
    assert.equal(f.rows.find((r) => r.id === id).note, expected);
    assert.equal(withoutNotes(f.rows), before);
    assert.equal(JSON.stringify(f.balances), inventory);
  }
  assert.equal(f.rows.length, 4);
  assert.equal(f.writes.length, 7);
  assert.deepEqual(f.invalidated, Array(7).fill('/basket'));
});

test('rejects overlength, oversized whitespace, malformed values, and all non-note write fields', async () => {
  const f = fixture();
  const before = JSON.stringify(f.rows);
  const valid = { transactionId: 'CUSTOMER_OUT', note: 'test' };
  const invalid = [null, [], 'text', {}, { ...valid, note: null }, { ...valid, note: 123 },
    { ...valid, note: ['text'] }, { ...valid, note: 'a'.repeat(501) }, { ...valid, note: ' '.repeat(10000) },
    { ...valid, transactionId: '' }, { ...valid, transactionId: 'x'.repeat(192) },
    ...['quantity', 'productId', 'sourceLocationId', 'destinationLocationId', 'type', 'createdAt', 'createdById'].map((key) => ({ ...valid, [key]: 99 })),
  ];
  for (const input of invalid) assert.equal((await f.action.updateOutboundNoteAction(input)).message, 'outbound-note-invalid');
  assert.equal(f.writes.length, 0);
  assert.equal(JSON.stringify(f.rows), before);
  assert.deepEqual(f.balances, { main: 20, retail: 10 });
});

test('inbound, adjustments, and nonexistent transactions cannot be edited', async () => {
  const f = fixture();
  for (const transactionId of ['MANUFACTURER_IN', 'ADJUSTMENT', 'missing']) {
    assert.equal((await f.action.updateOutboundNoteAction({ transactionId, note: 'bad' })).message, 'outbound-note-unavailable');
  }
  assert.equal(f.writes.length, 0);
  assert.equal(f.invalidated.length, 0);
});

test('auth is required before validation or writes, with no new admin requirement', async () => {
  const f = fixture();
  f.setAuthenticated(false);
  await assert.rejects(f.action.updateOutboundNoteAction({ transactionId: 'TRANSFER', note: 'test' }), /login-required/);
  assert.equal(f.writes.length, 0);
});

test('write remains type-scoped if the transaction changes after validation; errors do not expose internals', async () => {
  const f = fixture();
  f.setBeforeWrite(() => { f.rows[0].type = 'MANUFACTURER_IN'; });
  assert.equal((await f.action.updateOutboundNoteAction({ transactionId: 'TRANSFER', note: 'bad' })).message, 'outbound-note-unavailable');
  assert.equal(f.writes.length, 0);
  f.prisma.inventoryTransaction.findFirst = async () => { throw new Error('private database details'); };
  assert.equal((await f.action.updateOutboundNoteAction({ transactionId: 'TRANSFER', note: 'bad' })).message, 'outbound-note-failed');
});

test('history includes precisely the same outbound types and preserves null versus literal dash notes', async () => {
  const f = fixture();
  f.rows[1].note = '-';
  f.prisma.inventoryTransaction.findMany = async ({ where, take }) => {
    assert.deepEqual(Array.from(where.type.in).sort(), ['CUSTOMER_OUT', 'TRANSFER']);
    assert.equal(take, 20);
    return f.rows.filter((r) => where.type.in.includes(r.type)).map((r) => ({ ...r, product: { sku: 'SKU', name: 'Test' }, sourceLocation: { name: 'Kho' } }));
  };
  const rows = await f.data.getBasketRows();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].note, null);
  assert.equal(rows[1].note, '-');
});

test('explicit outbound action still creates correct TRANSFER and CUSTOMER_OUT quantities and balances', async () => {
  const f = fixture();
  const payload = new FormData();
  payload.set('linesJson', JSON.stringify([
    { productId: 'product', warehouse: 'KHO_TONG', quantity: 4, note: 'chuyển' },
    { productId: 'product', warehouse: 'KHO_LE', quantity: 2, note: 'bán' },
  ]));
  const result = await f.action.submitBasketAction({ status: 'idle', message: '' }, payload);
  assert.equal(result.status, 'success');
  assert.deepEqual(f.balances, { main: 16, retail: 12 });
  assert.equal(f.rows.length, 6);
  const [transfer, outbound] = f.rows.slice(4);
  assert.equal(transfer.type, 'TRANSFER'); assert.equal(transfer.quantity, 4);
  assert.equal(transfer.sourceLocationId, 'main'); assert.equal(transfer.destinationLocationId, 'retail');
  assert.equal(outbound.type, 'CUSTOMER_OUT'); assert.equal(outbound.quantity, 2);
  assert.equal(outbound.sourceLocationId, 'retail'); assert.equal(outbound.destinationLocationId, undefined);
});

const text = load('src/lib/ui.ts', { 'server-only': {} }).uiText;
const baseHooks = { ...React, useState: (value) => [value, () => {}], useRef: (value) => ({ current: value }),
  useMemo: (fn) => fn(), useEffect: () => {}, useActionState: () => [{ status: 'idle' }, () => {}, false] };
function nodes(tree, predicate, inForm = false) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate, inForm));
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), predicate, inForm);
  return [...(predicate(tree) ? [{ node: tree, inForm }] : []), ...nodes(tree.props?.children, predicate, inForm || tree.type === 'form')];
}

test('basket note has no implicit-submit form; only final button dispatches action once while pending', async () => {
  let calls = 0, clears = 0, finish;
  const tasks = [];
  const hooks = { ...baseHooks, useTransition: () => [false, (fn) => tasks.push(fn())] };
  const { BasketWorkspace } = load('src/components/basket-workspace.tsx', {
    react: hooks, 'lucide-react': { Ban: () => null }, 'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/app/actions/warehouse': { submitBasketAction: async (_state, form) => {
      calls++; assert.equal(JSON.parse(form.get('linesJson'))[0].quantity, 2);
      return new Promise((resolve) => { finish = resolve; });
    } },
    '@/components/action-feedback': { ActionToast: () => null }, '@/components/outbound-note-editor': { OutboundNoteEditor: () => null },
    '@/components/basket-provider': { useBasket: () => ({ items: [{ key: 'p', productId: 'p', sku: 'SKU', quantity: 2, warehouse: 'KHO_LE' }], totalCount: 2, clearBasket: () => clears++ }) },
    '@/lib/format': { formatNumber: String },
  });
  const tree = BasketWorkspace({ text, historyRows: [] });
  const inputs = nodes(tree, (n) => n.type === 'input');
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].inForm, false, 'Enter in note cannot cause native implicit submit');
  assert.equal(inputs[0].node.props.onKeyDown, undefined);
  assert.equal(calls, 0);
  const button = nodes(tree, (n) => n.type === 'button' && n.props.children === text.confirmOutbound)[0].node;
  assert.equal(button.props.type, 'button');
  button.props.onClick(); button.props.onClick();
  assert.equal(calls, 1);
  finish({ status: 'success' }); await Promise.all(tasks);
  assert.equal(clears, 1);
});

test('product quantity remains outside any form and cannot trigger final outbound on Enter', () => {
  let stateIndex = 0;
  const values = ['', 'ALL', 'KHO_LE', false, true, [{ id: 'p', sku: 'SKU', name: 'Test', khoTongQty: 20, khoLeQty: 10, totalQty: 30, status: 'ACTIVE', costPrice: 1 }], false, false, { p: '2' }, {}, null, {}];
  const { ProductsBrowser } = load('src/components/products-browser.tsx', {
    react: { ...baseHooks, useState: (initial) => [stateIndex < values.length ? values[stateIndex++] : initial, () => {}] },
    'lucide-react': { Check: () => null, Pencil: () => null }, 'next/navigation': { useRouter: () => ({}) },
    '@/app/actions/warehouse': {}, '@/components/basket-provider': { useBasket: () => ({ addItem() { throw new Error('unexpected basket add'); } }) },
    '@/lib/format': { formatNumber: String },
  });
  const tree = ProductsBrowser({ productCount: 1, suppliers: [], text });
  const inputs = nodes(tree, (n) => n.type === 'input' && n.props.type === 'number');
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].inForm, false);
  assert.equal(inputs[0].node.props.onKeyDown, undefined);
});

test('note editor displays the server-confirmed value immediately, locks saves, supports cancel and preserves drafts on failure', async () => {
  const slots = [];
  let cursor = 0, calls = 0, resolveRequest;
  const hooks = { ...React,
    useState: (initial) => { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef: (initial) => { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
  };
  const { OutboundNoteEditor } = load('src/components/outbound-note-editor.tsx', {
    react: hooks, 'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/components/action-feedback': {}, '@/app/actions/warehouse': { updateOutboundNoteAction: async (input) => {
      calls++; assert.deepEqual(Object.keys(input).sort(), ['note', 'transactionId']);
      return new Promise((resolve) => { resolveRequest = resolve; });
    } },
  });
  const render = () => { cursor = 0; return OutboundNoteEditor({ transactionId: 'row', note: 'đơn KOL', text }); };
  const button = (tree, label) => nodes(tree, (n) => n.type === 'button' && n.props.children === label)[0].node;
  button(render(), text.editNote).props.onClick();
  let editor = render();
  const textarea = nodes(editor, (n) => n.type === 'textarea')[0];
  assert.equal(textarea.inForm, false);
  assert.equal(textarea.node.props.maxLength, 500);
  assert.equal(textarea.node.props.onKeyDown, undefined, 'Enter stays a normal multiline newline');
  textarea.node.props.onChange({ target: { value: '  đơn KOL - Shopee 123  ' } });
  editor = render();
  const first = button(editor, text.saveNote).props.onClick();
  await button(editor, text.saveNote).props.onClick();
  assert.equal(calls, 1);
  assert.equal(button(render(), text.savingNote).props.disabled, true);
  assert.equal(button(render(), text.cancelNote).props.disabled, true);
  resolveRequest({ status: 'success', note: 'đơn KOL - Shopee 123' }); await first;
  assert.equal(nodes(render(), (n) => n.type === 'span')[0].node.props.children, 'đơn KOL - Shopee 123', 'render updated note even before refreshed server props arrive');
  assert.equal(button(render(), text.editNote).props.disabled, false);
  button(render(), text.editNote).props.onClick();
  nodes(render(), (n) => n.type === 'textarea')[0].node.props.onChange({ target: { value: 'draft' } });
  const failed = button(render(), text.saveNote).props.onClick();
  resolveRequest({ status: 'error', message: 'outbound-note-failed' }); await failed;
  assert.equal(nodes(render(), (n) => n.type === 'textarea')[0].node.props.value, 'draft');
  assert.equal(nodes(render(), (n) => n.props.role === 'status')[0].node.props.children, text.noteSaveError);
  button(render(), text.cancelNote).props.onClick();
  assert.equal(nodes(render(), (n) => n.type === 'span')[0].node.props.children, 'đơn KOL - Shopee 123');
});
