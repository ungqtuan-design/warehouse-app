const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const realPrisma = require('@prisma/client');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, BigInt, URLSearchParams, require: (id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === 'react/jsx-runtime') return require(id);
    throw new Error(`Unexpected dependency: ${id}`);
  } });
  return exports;
}

function api(prisma = {}) {
  return load('src/lib/warehouse-accounting.ts', { '@prisma/client': realPrisma, '@/lib/prisma': { prisma } });
}
const dates = { from: '2026-09-01', to: '2026-09-29' };

test('defaults use the current Vietnam calendar month, outbound and CUSTOMER_OUT', () => {
  const result = api().parseAccountingFilters({}, new Date('2026-09-28T17:05:00.000Z'));
  assert.equal(result.ok, true);
  assert.equal(result.filters.mode, 'outbound');
  assert.equal(result.filters.flow, 'CUSTOMER_OUT');
  assert.equal(result.filters.from, dates.from);
  assert.equal(result.filters.to, dates.to);
  assert.equal(result.filters.start.toISOString(), '2026-08-31T17:00:00.000Z');
  assert.equal(result.filters.endExclusive.toISOString(), '2026-09-29T17:00:00.000Z');
  assert.equal(api().parseAccountingFilters({ mode: 'inbound' }).filters.flow, 'MANUFACTURER_IN');
});

test('default month rolls over at Vietnam midnight, not host midnight', () => {
  const report = api();
  const before = report.parseAccountingFilters({}, new Date('2026-09-30T16:59:59.999Z'));
  const after = report.parseAccountingFilters({}, new Date('2026-09-30T17:00:00.000Z'));
  assert.equal(before.filters.from, '2026-09-01');
  assert.equal(before.filters.to, '2026-09-30');
  assert.equal(after.filters.from, '2026-10-01');
  assert.equal(after.filters.to, '2026-10-01');
});

test('September 2026 Vietnam boundaries are exact UTC instants in the Prisma filter', async () => {
  const { report, calls } = fixture();
  const result = await report.getWarehouseAccountingReport({ from: '2026-09-01', to: '2026-09-30' });
  assert.equal(result.ok, true);
  assert.equal(result.filters.start.toISOString(), '2026-08-31T17:00:00.000Z');
  assert.equal(result.filters.endExclusive.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(calls[0].where.createdAt.gte.toISOString(), '2026-08-31T17:00:00.000Z');
  assert.equal(calls[0].where.createdAt.lt.toISOString(), '2026-09-30T17:00:00.000Z');
});

for (const [instant, included] of [
  ['2026-08-31T16:59:59.999Z', false],
  ['2026-08-31T17:00:00.000Z', true],
  ['2026-09-30T16:59:59.999Z', true],
  ['2026-09-30T17:00:00.000Z', false],
]) {
  test(`September Vietnam report ${included ? 'includes' : 'excludes'} ${instant}`, async () => {
    const { report, transactions } = fixture();
    transactions.splice(0, transactions.length, ['A', 'CUSTOMER_OUT', 2, 'KHO_LE', null, instant]);
    const result = await report.getWarehouseAccountingReport({ from: '2026-09-01', to: '2026-09-30' });
    assert.equal(result.ok, true);
    assert.equal(result.totalQuantity, included ? 2 : 0);
    assert.equal(result.totalValue, included ? '80000.00' : '0.00');
    assert.equal(result.rows.length, included ? 1 : 0);
  });
}

test('60 inclusive calendar dates valid; 61, reversed, impossible and malformed dates rejected before DB access', async () => {
  const report = api(); // No DB methods: invalid requests must never query.
  for (const range of [
    { from: '2026-01-01', to: '2026-03-01' },
    { from: '2024-02-01', to: '2024-03-31' },
    { from: '2026-10-01', to: '2026-11-29' },
    { from: '2026-09-29', to: '2026-09-29' },
  ]) assert.equal(report.parseAccountingFilters(range).ok, true);
  for (const [params, error] of [
    [{ from: '2026-01-01', to: '2026-03-02' }, 'accountingDateLimit'],
    [{ from: '2026-09-30', to: '2026-09-01' }, 'accountingDateOrder'],
    [{ ...dates, from: '2026-02-29' }, 'accountingInvalidDate'],
    [{ ...dates, to: '2026-09-31' }, 'accountingInvalidDate'],
    [{ ...dates, from: '2026-9-01' }, 'accountingInvalidDate'],
    [{ ...dates, from: '' }, 'accountingInvalidDate'],
    [{ ...dates, from: '0000-01-01' }, 'accountingInvalidDate'],
    [{ ...dates, to: '2026-09-29T12:00:00Z' }, 'accountingInvalidDate'],
    [{ ...dates, from: ['2026-09-01', '2026-09-02'] }, 'accountingInvalidParameters'],
    [{ ...dates, mode: 'all' }, 'accountingInvalidParameters'],
    [{ ...dates, mode: '' }, 'accountingInvalidParameters'],
    [{ ...dates, flow: 'ADJUSTMENT' }, 'accountingInvalidParameters'],
    [{ ...dates, flow: 'MANUFACTURER_IN' }, 'accountingInvalidParameters'],
    [{ ...dates, mode: 'inbound', flow: 'CUSTOMER_OUT' }, 'accountingInvalidParameters'],
    [{ ...dates, flow: ['TRANSFER'] }, 'accountingInvalidParameters'],
  ]) {
    const result = await report.getWarehouseAccountingReport(params);
    assert.equal(result.ok, false, JSON.stringify(params));
    assert.equal(result.error, error);
  }
});

function fixture() {
  const transactions = [
    ['A', 'CUSTOMER_OUT', 10, 'KHO_LE', null, '2026-09-01T00:00:00+07:00'],
    ['A', 'CUSTOMER_OUT', 5, 'KHO_LE', null, '2026-09-29T23:59:59.999+07:00'],
    ['A', 'CUSTOMER_OUT', 90, 'KHO_LE', null, '2026-08-31T23:59:59.999+07:00'],
    ['A', 'CUSTOMER_OUT', 90, 'KHO_LE', null, '2026-09-30T00:00:00+07:00'],
    ['A', 'CUSTOMER_OUT', 90, 'KHO_TONG', null, '2026-09-10T12:00:00+07:00'],
    ['B', 'TRANSFER', 7, 'KHO_TONG', 'KHO_LE', '2026-09-10T12:00:00+07:00'],
    ['B', 'TRANSFER', 3, 'KHO_TONG', 'KHO_LE', '2026-09-20T12:00:00+07:00'],
    ['B', 'TRANSFER', 90, 'KHO_LE', 'KHO_TONG', '2026-09-10T12:00:00+07:00'],
    ['B', 'TRANSFER', 90, 'KHO_TONG', 'KHO_LE', '2026-09-30T00:00:00+07:00'],
    ['A', 'MANUFACTURER_IN', 4, null, 'KHO_TONG', '2026-09-10T12:00:00+07:00'],
    ['A', 'MANUFACTURER_IN', 90, null, 'KHO_LE', '2026-09-10T12:00:00+07:00'],
    ['A', 'ADJUSTMENT', 90, null, 'KHO_TONG', '2026-09-10T12:00:00+07:00'],
  ];
  const products = [
    { id: 'A', sku: 'SKU001', name: 'Product A', costPrice: new realPrisma.Prisma.Decimal('40000') },
    { id: 'B', sku: 'SKU002', name: 'Product B', costPrice: new realPrisma.Prisma.Decimal('0.10') },
  ];
  const calls = [];
  const prisma = {
    inventoryTransaction: { groupBy: async (args) => {
      calls.push(args);
      assert.equal(JSON.stringify(args.by), '["productId"]');
      assert.equal(JSON.stringify(args._sum), '{"quantity":true}');
      const where = args.where;
      assert.ok(where.createdAt.gte instanceof Date);
      assert.ok(where.createdAt.lt instanceof Date);
      assert.equal(where.createdAt.lte, undefined);
      const grouped = new Map();
      // Test double for Postgres: only aggregates cross this boundary.
      for (const [productId, type, quantity, source, destination, created] of transactions) {
        const time = new Date(created);
        if (type !== where.type || time < where.createdAt.gte || time >= where.createdAt.lt) continue;
        if (where.sourceLocation && source !== where.sourceLocation.code) continue;
        if (where.destinationLocation && destination !== where.destinationLocation.code) continue;
        if (where.sourceLocationId === null && source !== null) continue;
        if (where.destinationLocationId === null && destination !== null) continue;
        grouped.set(productId, (grouped.get(productId) || 0) + quantity);
      }
      return [...grouped].map(([productId, quantity]) => ({ productId, _sum: { quantity } }));
    } },
    product: { findMany: async (args) => {
      assert.equal(JSON.stringify(args.select), '{"id":true,"sku":true,"name":true,"costPrice":true}');
      assert.equal(JSON.stringify(args.orderBy), '[{"sku":"asc"}]');
      return products.filter((p) => args.where.id.in.includes(p.id));
    } },
  };
  return { report: api(prisma), calls, products, transactions };
}

test('CUSTOMER_OUT aggregates A=10+5 once, value=600000, full final day included, other flows/locations excluded', async () => {
  const { report, calls, products } = fixture();
  const result = await report.getWarehouseAccountingReport(dates);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].quantity, 15);
  assert.equal(result.rows[0].value, '600000.00');
  assert.equal(result.totalQuantity, 15);
  assert.equal(result.totalValue, '600000.00');
  assert.equal(calls[0].where.sourceLocation.code, 'KHO_LE');
  products[0].costPrice = new realPrisma.Prisma.Decimal('45000');
  assert.equal((await report.getWarehouseAccountingReport(dates)).totalValue, '675000.00');
});

test('TRANSFER is the identical read-only query in outbound and inbound with both locations constrained', async () => {
  const { report, calls, transactions } = fixture();
  const before = JSON.stringify(transactions);
  const outbound = await report.getWarehouseAccountingReport({ ...dates, flow: 'TRANSFER', mode: 'outbound' });
  const inbound = await report.getWarehouseAccountingReport({ ...dates, flow: 'TRANSFER', mode: 'inbound' });
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(calls[1]));
  assert.equal(calls[0].where.sourceLocation.code, 'KHO_TONG');
  assert.equal(calls[0].where.destinationLocation.code, 'KHO_LE');
  assert.equal(outbound.totalQuantity, 10);
  assert.equal(outbound.totalValue, '1.00');
  assert.equal(JSON.stringify(outbound.rows), JSON.stringify(inbound.rows));
  assert.equal(JSON.stringify(transactions), before);
});

test('MANUFACTURER_IN only receives supplier stock into KHO_TONG', async () => {
  const { report, calls } = fixture();
  const result = await report.getWarehouseAccountingReport({ ...dates, mode: 'inbound' });
  assert.equal(calls[0].where.type, 'MANUFACTURER_IN');
  assert.equal(calls[0].where.destinationLocation.code, 'KHO_TONG');
  assert.equal(result.totalQuantity, 4);
  assert.equal(result.totalValue, '160000.00');
});

test('empty aggregates return zero without fetching products', async () => {
  const result = await api({ inventoryTransaction: { groupBy: async () => [] } }).getWarehouseAccountingReport(dates);
  assert.equal(result.rows.length, 0);
  assert.equal(result.totalQuantity, 0);
  assert.equal(result.totalValue, '0.00');
});

test('zero current cost keeps the quantity and produces zero value without changing product data', async () => {
  const { report, products } = fixture();
  products[0].costPrice = new realPrisma.Prisma.Decimal('0');
  const before = JSON.stringify(products);
  const result = await report.getWarehouseAccountingReport(dates);
  assert.equal(result.rows[0].quantity, 15);
  assert.equal(result.rows[0].costPrice, '0.00');
  assert.equal(result.rows[0].value, '0.00');
  assert.equal(result.totalValue, '0.00');
  assert.equal(JSON.stringify(products), before);
});

test('large totals and fractional cost preserve exact cents, with localized VND formatting', async () => {
  const report = api({ inventoryTransaction: { groupBy: async () => [
    { productId: 'A', _sum: { quantity: 2000000000 } }, { productId: 'B', _sum: { quantity: 3 } },
  ] }, product: { findMany: async () => [
    { id: 'A', sku: 'A', name: 'A', costPrice: new realPrisma.Prisma.Decimal('999999999999.99') },
    { id: 'B', sku: 'B', name: 'B', costPrice: new realPrisma.Prisma.Decimal('0.10') },
  ] } });
  const result = await report.getWarehouseAccountingReport(dates);
  assert.equal(result.totalValue, '1999999999999980000000.30');
  assert.equal(result.rows[1].value, '0.30');
  assert.equal(report.formatAccountingMoney('5400000.00', 'vi'), '5.400.000 ₫');
  assert.equal(report.formatAccountingMoney(result.totalValue, 'en'), '1,999,999,999,999,980,000,000.3 ₫');
});

async function renderPage(params, language = 'en', authorize = async () => {}) {
  const { report } = fixture();
  const ui = load('src/lib/ui.ts', { 'server-only': {}, 'next/headers': { cookies: async () => ({ get: (name) => ({ value: name === 'language' ? language : 'light' }) }) },
    '@/lib/ui-preferences': { uiCookieNames: { language: 'language', theme: 'theme' }, legacyUiCookieNames: {} } });
  const page = load('src/app/warehouse-accounting/page.tsx', {
    'next/link': { default: ({ children, prefetch, ...props }) => {
      assert.equal(prefetch, false);
      return React.createElement('a', props, children);
    } },
    '@/lib/auth': { requireUser: authorize }, '@/lib/ui': ui,
    '@/lib/format': { formatNumber: (v) => v.toLocaleString('en-US') }, '@/lib/warehouse-accounting': report,
  });
  return renderToStaticMarkup(await page.default({ searchParams: Promise.resolve(params) }));
}

test('page renders both dictionaries, selected flow, 5 columns, totals, and localized errors/empty state', async () => {
  for (const language of ['vi', 'en']) {
    const html = await renderPage(dates, language);
    assert.match(html, /value="CUSTOMER_OUT" selected=""/);
    assert.equal((html.match(/<option /g) || []).length, 2);
    assert.equal((html.match(/scope="col"/g) || []).length, 5);
    assert.match(html, language === 'vi' ? /Kế toán kho/ : /Warehouse accounting/);
    assert.match(html, language === 'vi' ? /600\.000 ₫/ : /600,000 ₫/);
    assert.match(html, /overflow-x-auto/);
    const invalid = await renderPage({ from: '2026-01-01', to: '2026-03-02' }, language);
    assert.match(invalid, /role="alert"/);
    assert.match(invalid, /60/);
    assert.doesNotMatch(invalid, /<table/);
    const empty = await renderPage({ from: '2026-01-01', to: '2026-01-02' }, language);
    assert.match(empty, language === 'vi' ? /Không có dữ liệu/ : /No data/);
    assert.match(empty, /0 ₫/);
    const inbound = await renderPage({ ...dates, mode: 'inbound' }, language);
    assert.match(inbound, /value="MANUFACTURER_IN" selected=""/);
    assert.doesNotMatch(inbound, /<option value="CUSTOMER_OUT"/);
  }
});

test('page requires authentication before reporting', async () => {
  await assert.rejects(renderPage(dates, 'en', async () => { throw new Error('redirect:/login'); }), /redirect:\/login/);
});
