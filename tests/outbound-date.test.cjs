const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./helpers/auth-fixture.cjs');
const dates = load('src/lib/outbound-date.ts');
const now = new Date('2026-11-19T09:00:00Z');

test('business dates accept real past calendar dates and switch at Vietnam midnight, independently of host time', () => {
  assert.equal(dates.vietnamToday(new Date('2026-11-18T16:59:59Z')), '2026-11-18');
  assert.equal(dates.vietnamToday(new Date('2026-11-18T17:00:00Z')), '2026-11-19');
  for (const value of ['2026-11-17', '2026-11-19', '2024-02-29', '2026-10-31']) {
    assert.equal(dates.parseOutboundDate(value, now).toISOString(), `${value}T00:00:00.000Z`);
  }
  for (const value of [null, undefined, 20261117, '', '2026-2-01', '0000-01-01', '2026-02-29', '2026-11-31', '2026-11-20', '2026-11-17T00:00:00Z']) {
    assert.equal(dates.parseOutboundDate(value, now), null, String(value));
  }
  assert.equal(dates.parseOutboundDate('2026-11-19', new Date('2026-11-18T17:00:00Z')).toISOString(), '2026-11-19T00:00:00.000Z');
  assert.equal(dates.formatOutboundDate('2026-11-17'), '17/11/2026');
  assert.equal(dates.formatOutboundDate(null), 'Chưa xác nhận');
});

function payload(value = '2026-11-17', lines = [{ productId: 'p', warehouse: 'KHO_LE', quantity: 2 }]) {
  const form = new FormData();
  if (value !== null) form.set('outboundDate', value);
  form.set('linesJson', JSON.stringify(lines));
  return form;
}

function actionFixture() {
  const balances = { main: 100, retail: 10 };
  const rows = [{ id: 'legacy', quantity: 8, createdAt: new Date('2026-11-18T09:00:00Z'), outboundDate: null }];
  const invalidated = [];
  let auth = true, locationReads = 0;
  const prisma = {
    location: { findMany: async () => { locationReads++; return [{ id: 'main', code: 'KHO_TONG' }, { id: 'retail', code: 'KHO_LE' }]; } },
    inventoryBalance: {
      findUnique: async ({ where }) => ({ quantity: balances[where.productId_locationId.locationId] }),
      update: async ({ where, data }) => { balances[where.productId_locationId.locationId] -= data.quantity.decrement; },
      upsert: async ({ where, update }) => { balances[where.productId_locationId.locationId] += update.quantity.increment; },
    },
    inventoryTransaction: { create: async ({ data }) => {
      assert.equal(Object.hasOwn(data, 'createdAt'), false, 'entry time must remain the DB default');
      rows.push({ id: 'new-' + rows.length, ...data, createdAt: now });
    } },
    $transaction: async (fn) => {
      const before = { ...balances }, rowCount = rows.length;
      try { return await fn(prisma); } catch (error) { Object.assign(balances, before); rows.splice(rowCount); throw error; }
    },
  };
  const actions = load('src/app/actions/warehouse.ts', {
    '@/lib/prisma': { prisma }, '@/lib/auth': { requireUser: async () => { if (!auth) throw new Error('login-required'); return { id: 'staff' }; } },
    'next/cache': { revalidatePath: path => invalidated.push(path) },
    '@/lib/outbound-date': { ...dates, parseOutboundDate: value => dates.parseOutboundDate(value, now) },
  });
  return { actions, balances, rows, invalidated, reads: () => locationReads, unauthenticate: () => { auth = false; } };
}

test('missing, duplicate, file, invalid and future dates fail before any inventory access, including old browser payloads', async () => {
  const f = actionFixture();
  const duplicate = payload(); duplicate.append('outboundDate', '2026-11-18');
  const file = payload(); file.set('outboundDate', new Blob(['2026-11-17']), 'date.txt');
  for (const form of [payload(null), payload(''), payload('2026-02-29'), payload('2026-11-20'), duplicate, file]) {
    assert.equal((await f.actions.submitBasketAction({}, form)).message, 'outbound-date-invalid');
  }
  assert.equal(f.reads(), 0);
  assert.equal(f.rows.length, 1);
  f.unauthenticate();
  await assert.rejects(f.actions.submitBasketAction({}, payload(null)), /login-required/);
});

test('one chosen backdate is saved on every outbound line, stock changes once and entry/legacy timestamps are preserved', async () => {
  const f = actionFixture(), legacy = JSON.stringify(f.rows[0]);
  const result = await f.actions.submitBasketAction({}, payload('2026-10-31', [
    { productId: 'p', warehouse: 'KHO_TONG', quantity: 4 },
    { productId: 'p', warehouse: 'KHO_LE', quantity: 3 },
  ]));
  assert.equal(result.status, 'success');
  assert.deepEqual(f.balances, { main: 96, retail: 11 });
  assert.equal(f.rows.length, 3);
  assert.equal(JSON.stringify(f.rows[0]), legacy);
  for (const row of f.rows.slice(1)) {
    assert.equal(row.outboundDate.toISOString(), '2026-10-31T00:00:00.000Z');
    assert.equal(row.createdAt.toISOString(), now.toISOString());
  }
  assert.deepEqual(f.rows.slice(1).map(row => row.type), ['TRANSFER', 'CUSTOMER_OUT']);
  assert.ok(f.invalidated.includes('/warehouse-accounting'));
});

test('a failed backdated batch rolls back prior lines and stock, without invalidating the reports', async () => {
  const f = actionFixture();
  const result = await f.actions.submitBasketAction({}, payload('2026-11-17', [
    { productId: 'p', warehouse: 'KHO_LE', quantity: 2 },
    { productId: 'p', warehouse: 'KHO_LE', quantity: 100 },
  ]));
  assert.equal(result.status, 'error');
  assert.deepEqual(f.balances, { main: 100, retail: 10 });
  assert.equal(f.rows.length, 1);
  assert.equal(f.invalidated.length, 0);
});

test('date migration preserves old records; actual SQL filters put backdated COGS in its selected day only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "InventoryTransaction" (
      id text PRIMARY KEY, type text NOT NULL, "productId" text NOT NULL,
      quantity integer NOT NULL, "createdAt" timestamp NOT NULL,
      source text, destination text);
      INSERT INTO "InventoryTransaction" VALUES ('legacy', 'CUSTOMER_OUT', 'p', 8, '2026-11-18 09:00:00', 'KHO_LE', NULL);`);
    const before = await db.query('SELECT * FROM "InventoryTransaction"');
    await db.exec(fs.readFileSync('prisma/sql/20261119_outbound_date.sql', 'utf8'));
    const after = (await db.query('SELECT * FROM "InventoryTransaction"')).rows[0];
    assert.equal(after.outboundDate, null); delete after.outboundDate;
    assert.deepEqual(after, before.rows[0]);
    for (const [id, type, chosen, quantity, source, destination] of [
      ['backdate', 'CUSTOMER_OUT', '2026-11-17', 3, 'KHO_LE', null],
      ['same-day', 'CUSTOMER_OUT', '2026-11-19', 4, 'KHO_LE', null],
      ['last-month', 'CUSTOMER_OUT', '2026-10-31', 2, 'KHO_LE', null],
      ['transfer', 'TRANSFER', '2026-11-17', 5, 'KHO_TONG', 'KHO_LE'],
      ['wrong-route', 'CUSTOMER_OUT', '2026-11-17', 99, 'KHO_TONG', null],
    ]) await db.query(`INSERT INTO "InventoryTransaction" VALUES ($1, $2, 'p', $3, '2026-11-19 09:00:00', $4, $5, $6)`, [id, type, quantity, source, destination, chosen]);
    for (const [id, type, created, chosen] of [
      ['future', 'CUSTOMER_OUT', '2026-11-19 09:00:00', '2026-11-20'],
      ['inbound', 'MANUFACTURER_IN', '2026-11-19 09:00:00', '2026-11-17'],
    ]) await assert.rejects(db.query(`INSERT INTO "InventoryTransaction" (id,type,"productId",quantity,"createdAt","outboundDate") VALUES ($1,$2,'p',1,$3,$4)`, [id, type, created, chosen]), /outboundDate_check/);
    // Midnight Vietnam allows the new calendar day although the stored UTC timestamp is still yesterday.
    await db.query(`INSERT INTO "InventoryTransaction" (id,type,"productId",quantity,"createdAt","outboundDate") VALUES ('midnight','TRANSFER','p',1,'2026-11-18 17:00:00','2026-11-19')`);
    const prisma = {
      inventoryTransaction: {
        groupBy: async ({ where }) => {
          const [confirmed, legacy] = where.OR;
          assert.equal(legacy.outboundDate, null);
          const result = await db.query(`SELECT "productId", SUM(quantity)::int AS quantity FROM "InventoryTransaction"
            WHERE type = $1 AND source = $2 AND destination IS NOT DISTINCT FROM $3
            AND (("outboundDate" >= $4::date AND "outboundDate" <= $5::date)
              OR ("outboundDate" IS NULL AND "createdAt" >= $6::timestamp AND "createdAt" < $7::timestamp))
            GROUP BY "productId"`, [where.type, where.sourceLocation.code, where.destinationLocation?.code ?? null,
            confirmed.outboundDate.gte.toISOString().slice(0,10), confirmed.outboundDate.lte.toISOString().slice(0,10),
            legacy.createdAt.gte.toISOString(), legacy.createdAt.lt.toISOString()]);
          return result.rows.map(row => ({ productId: row.productId, _sum: { quantity: row.quantity } }));
        },
        count: async ({ where }) => {
          assert.equal(where.outboundDate, null);
          assert.equal(where.createdAt, undefined, 'unknown-date warning covers legacy outside the requested day');
          return (await db.query(`SELECT COUNT(*)::int AS n FROM "InventoryTransaction"
            WHERE type = $1 AND source = $2 AND destination IS NOT DISTINCT FROM $3 AND "outboundDate" IS NULL`,
          [where.type, where.sourceLocation.code, where.destinationLocation?.code ?? null])).rows[0].n;
        },
      },
      $queryRaw: async () => [], // No returns in this fixture; existing suite verifies actual return SQL.
      product: { findMany: async () => [{ id: 'p', sku: 'P', name: 'Fixture', costPrice: '10000.25' }] },
    };
    const report = load('src/lib/warehouse-accounting.ts', { '@/lib/prisma': { prisma } });
    for (const [day, expected] of [['2026-10-31', 2], ['2026-11-17', 3], ['2026-11-18', 8], ['2026-11-19', 4], ['2026-11-16', 0]]) {
      const result = await report.getWarehouseAccountingReport({ from: day, to: day }, now);
      assert.equal(result.totalQuantity, expected, day);
      assert.equal(result.totalValue, (expected * 10000.25).toFixed(2), day);
      assert.equal(result.undatedTransactionCount, 1);
    }
    const whole = await report.getWarehouseAccountingReport({ from: '2026-10-31', to: '2026-11-19' }, now);
    assert.equal(whole.totalQuantity, 17, 'backdated records must never also count on entry day');
    const transfer = await report.getWarehouseAccountingReport({ flow: 'TRANSFER', from: '2026-11-17', to: '2026-11-17' }, now);
    assert.equal(transfer.totalQuantity, 5);
    assert.equal(transfer.undatedTransactionCount, 0);
    const unchanged = (await db.query('SELECT * FROM "InventoryTransaction" WHERE id = $1', ['legacy'])).rows[0];
    delete unchanged.outboundDate;
    assert.deepEqual(unchanged, before.rows[0]);
  } finally { await db.close(); }
});

test('history and raw CSV carry business date separately from exact entry instant; old rows stay unknown', async () => {
  const rows = [new Date('2026-11-17T00:00:00Z'), null].map((outboundDate, i) => ({
    id: String(i), outboundDate, createdAt: now, type: 'CUSTOMER_OUT', quantity: 2,
    product: { sku: 'P', name: 'Fixture', supplier: { name: 'Supplier' } }, sourceLocation: { name: 'Kho Lẻ' },
  }));
  const data = load('src/lib/warehouse-data.ts', { '@/lib/prisma': { prisma: { inventoryTransaction: { findMany: async ({ select }) => {
    assert.equal(select.outboundDate, true); assert.equal(select.createdAt, true); return rows;
  } } } } });
  const history = await data.getBasketRows();
  assert.equal(history[0].outboundDate, '2026-11-17');
  assert.equal(history[1].outboundDate, null);
  assert.equal(history[0].createdAt, now.toISOString());
  const csv = await data.getOrderExportRows();
  assert.equal(csv[0].outbound_date, '2026-11-17');
  assert.equal(csv[1].outbound_date, '');
  assert.equal(csv[0].created_at, now.toISOString());
});

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

test('basket exposes the date even when empty; chosen backdate reaches action and locks during submission', async () => {
  const slots = []; let cursor = 0, pending = false, finish, sent, calls = 0;
  const tasks = [], items = [];
  const text = load('src/lib/ui.ts').uiText;
  const hooks = { ...React,
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = next; }]; },
    useRef: initial => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useTransition: () => [pending, fn => { pending = true; tasks.push(fn().finally(() => { pending = false; })); }],
  };
  const { BasketWorkspace } = load('src/components/basket-workspace.tsx', {
    react: hooks, 'lucide-react': { Ban: () => null }, 'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/app/actions/warehouse': { submitBasketAction: async (_state, form) => { calls++; sent = form; return new Promise(resolve => { finish = resolve; }); } },
    '@/components/action-feedback': { ActionToast: () => null }, '@/components/local-date-time': { LocalDateTime: () => null },
    '@/components/outbound-note-editor': { OutboundNoteEditor: () => null },
    '@/components/basket-provider': { useBasket: () => ({ items, totalCount: items.length, clearBasket() {} }) },
  });
  const render = () => { cursor = 0; return BasketWorkspace({ text, today: '2026-11-19', historyRows: [] }); };
  const input = tree => nodes(tree, n => n.type === 'input' && n.props.type === 'date')[0];
  const submit = tree => nodes(tree, n => n.type === 'button' && [text.confirmOutbound, text.submitting].includes(n.props.children))[0];
  let tree = render();
  assert.equal(input(tree).props.value, '2026-11-19');
  assert.equal(input(tree).props.max, '2026-11-19');
  assert.equal(nodes(tree, n => n.type === 'form').length, 0);
  assert.equal(submit(tree), undefined);
  items.push({ key: 'p', productId: 'p', sku: 'P', quantity: 2, warehouse: 'KHO_LE' });
  input(render()).props.onChange({ target: { value: '2026-11-17' } });
  tree = render(); submit(tree).props.onClick(); submit(tree).props.onClick();
  assert.equal(calls, 1);
  assert.equal(sent.get('outboundDate'), '2026-11-17');
  assert.equal(input(render()).props.disabled, true);
  assert.equal(submit(render()).props.disabled, true);
  finish({ status: 'success' }); await Promise.all(tasks);
  assert.equal(input(render()).props.value, '2026-11-19');
});

test('history UI clearly separates actual date and entry time, without inventing dates for legacy rows', () => {
  const text = load('src/lib/ui.ts').uiText;
  const { BasketWorkspace } = load('src/components/basket-workspace.tsx', {
    react: { ...React, useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useTransition: () => [false, () => {}] },
    'lucide-react': { Ban: () => null }, 'next/navigation': { useRouter: () => ({}) },
    '@/app/actions/warehouse': {}, '@/components/action-feedback': { ActionToast: () => null },
    '@/components/local-date-time': { LocalDateTime: ({ iso }) => iso },
    '@/components/outbound-note-editor': { OutboundNoteEditor: () => null },
    '@/components/basket-provider': { useBasket: () => ({ items: [], totalCount: 0 }) },
  });
  const html = renderToStaticMarkup(BasketWorkspace({ text, today: '2026-11-19', historyRows: [
    { id: 'new', sku: 'P', outboundDate: '2026-11-17', createdAt: now.toISOString(), quantity: 2 },
    { id: 'old', sku: 'Q', outboundDate: null, createdAt: now.toISOString(), quantity: 3 },
  ] }));
  assert.match(html, /Ngày xuất thực tế/);
  assert.match(html, /Thời điểm nhập/);
  assert.match(html, /17\/11\/2026/);
  assert.match(html, /Chưa xác nhận/);
  assert.ok(html.includes(now.toISOString()));
});
