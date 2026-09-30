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
  vm.runInNewContext(code, { exports, Date, Map, BigInt, URL, URLSearchParams, require: (id) => {
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

function loadUi(language) {
  return load('src/lib/ui.ts', { 'server-only': {}, 'next/headers': { cookies: async () => ({ get: (name) => ({ value: name === 'language' ? language : 'light' }) }) },
    '@/lib/ui-preferences': { uiCookieNames: { language: 'language', theme: 'theme' }, legacyUiCookieNames: {} } });
}

async function renderPage(params, language = 'en', authorize = async () => {}) {
  const { report } = fixture();
  const ui = loadUi(language);
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

function exportCsv(report, params = dates, language = 'vi', authorize = async () => {}) {
  const route = load('src/app/api/export/warehouse-accounting/route.ts', {
    'next/server': require('next/server'),
    '@/lib/auth': { requireUser: authorize },
    '@/lib/ui': loadUi(language),
    '@/lib/csv': load('src/lib/csv.ts', {}),
    '@/lib/warehouse-accounting': report,
  });
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  return route.GET(new Request(`http://localhost/api/export/warehouse-accounting?${query}`));
}

async function csvBody(response) {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.match(response.headers.get('cache-control'), /no-store/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM for Excel');
  return bytes.subarray(3).toString('utf8');
}

const viCsvHeaders = 'Loại báo cáo,Luồng,Từ ngày,Đến ngày,SKU,Sản phẩm,Số lượng,Giá vốn hiện tại,Tổng giá trị';
const selections = [
  { mode: 'outbound', flow: 'CUSTOMER_OUT', type: 'Xuất kho', label: 'Kho Lẻ → Khách hàng',
    data: 'SKU001,Product A,15,40000.00,600000.00', file: 'xuat_kho-le-khach' },
  { mode: 'outbound', flow: 'TRANSFER', type: 'Xuất kho', label: 'Kho Tổng → Kho Lẻ',
    data: 'SKU002,Product B,10,0.10,1.00', file: 'xuat_kho-tong-kho-le' },
  { mode: 'inbound', flow: 'TRANSFER', type: 'Nhập kho', label: 'Kho Tổng → Kho Lẻ',
    data: 'SKU002,Product B,10,0.10,1.00', file: 'nhap_kho-tong-kho-le' },
  { mode: 'inbound', flow: 'MANUFACTURER_IN', type: 'Nhập kho', label: 'NCC → Kho Tổng',
    data: 'SKU001,Product A,4,40000.00,160000.00', file: 'nhap_ncc-kho-tong' },
];

for (const selection of selections) {
  test(`CSV ${selection.mode}/${selection.flow} matches the report with one aggregate row and a safe filename`, async () => {
    const { report, calls, transactions, products } = fixture();
    const before = JSON.stringify({ transactions, products });
    const params = { ...dates, mode: selection.mode, flow: selection.flow };
    const response = await exportCsv(report, params);
    assert.equal(response.headers.get('content-disposition'),
      `attachment; filename="ke-toan-kho_${selection.file}_2026-09-01_2026-09-29.csv"`);
    const csv = await csvBody(response);
    assert.equal(csv, `${viCsvHeaders}\n${selection.type},${selection.label},2026-09-01,2026-09-29,${selection.data}`);
    assert.equal(calls.length, 1, 'one DB aggregation, no transaction detail fetch');
    assert.equal(calls[0].where.createdAt.gte.toISOString(), '2026-08-31T17:00:00.000Z');
    assert.equal(calls[0].where.createdAt.lt.toISOString(), '2026-09-29T17:00:00.000Z');
    const screen = await report.getWarehouseAccountingReport(params);
    const cells = csv.split('\n')[1].split(',');
    assert.equal(cells[6], String(screen.totalQuantity));
    assert.equal(cells[7], screen.rows[0].costPrice);
    assert.equal(cells[8], screen.totalValue);
    assert.equal(JSON.stringify({ transactions, products }), before);
  });
}

test('TRANSFER CSV uses identical data and DB filters for both views', async () => {
  const { report, calls } = fixture();
  const outbound = await csvBody(await exportCsv(report, { ...dates, mode: 'outbound', flow: 'TRANSFER' }));
  const inbound = await csvBody(await exportCsv(report, { ...dates, mode: 'inbound', flow: 'TRANSFER' }));
  assert.equal(inbound.replace('Nhập kho', 'Xuất kho'), outbound);
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(calls[1]));
});

test('CSV uses the current product cost, preserves exact decimal cents and Vietnamese names with commas, quotes and newlines', async () => {
  const { report, products } = fixture();
  products[0].name = 'Cà phê, "Đặc biệt"\r\nHộp giấy\rGói lẻ';
  products[0].costPrice = new realPrisma.Prisma.Decimal('1544.01');
  const csv = await csvBody(await exportCsv(report));
  assert.equal(csv, `${viCsvHeaders}\nXuất kho,Kho Lẻ → Khách hàng,2026-09-01,2026-09-29,SKU001,"Cà phê, ""Đặc biệt""\r\nHộp giấy\rGói lẻ",15,1544.01,23160.15`);
  assert.doesNotMatch(csv, /₫/);
});

test('CSV language follows validated UI cookies; empty reports retain all nine headers', async () => {
  const { report } = fixture();
  const en = await csvBody(await exportCsv(report, dates, 'en'));
  assert.equal(en, 'Report type,Flow,From date,To date,SKU,Product,Quantity,Current cost,Total value\nOutbound,Retail warehouse → Customer,2026-09-01,2026-09-29,SKU001,Product A,15,40000.00,600000.00');
  const fallback = await csvBody(await exportCsv(report, dates, 'unsupported-language'));
  assert.equal(fallback, en);
  const emptyReport = api({ inventoryTransaction: { groupBy: async () => [] } });
  assert.equal(await csvBody(await exportCsv(emptyReport)), viCsvHeaders);
});

test('CSV accepts exactly 60 inclusive days and rejects invalid or duplicate filters before any DB query', async () => {
  const { report, calls } = fixture();
  await csvBody(await exportCsv(report, { from: '2026-01-01', to: '2026-03-01' }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.createdAt.gte.toISOString(), '2025-12-31T17:00:00.000Z');
  assert.equal(calls[0].where.createdAt.lt.toISOString(), '2026-03-01T17:00:00.000Z');
  const invalidReport = api(); // No DB methods available: any query fails this test.
  const { text } = await loadUi('vi').getUiContext();
  for (const [params, error] of [
    [{ from: '2026-01-01', to: '2026-03-02' }, 'accountingDateLimit'],
    [{ from: '2026-09-29', to: '2026-09-01' }, 'accountingDateOrder'],
    [{ ...dates, from: '2026-02-29' }, 'accountingInvalidDate'],
    [{ ...dates, to: '2026-09-31' }, 'accountingInvalidDate'],
    [{ ...dates, from: '2026-9-01' }, 'accountingInvalidDate'],
    [{ ...dates, to: '' }, 'accountingInvalidDate'],
    [{ ...dates, from: '2026-09-01\r\nInjected: header' }, 'accountingInvalidDate'],
    [{ ...dates, mode: 'unknown' }, 'accountingInvalidParameters'],
    [{ ...dates, flow: 'ADJUSTMENT' }, 'accountingInvalidParameters'],
    [{ ...dates, flow: 'MANUFACTURER_IN', mode: 'outbound' }, 'accountingInvalidParameters'],
    [{ ...dates, flow: 'CUSTOMER_OUT', mode: 'inbound' }, 'accountingInvalidParameters'],
    ...['mode', 'flow', 'from', 'to'].map((key) => [
      `${new URLSearchParams({ ...dates, mode: 'outbound', flow: 'CUSTOMER_OUT' })}&${key}=duplicate`,
      'accountingInvalidParameters',
    ]),
  ]) {
    const response = await exportCsv(invalidReport, params);
    assert.equal(response.status, 400, JSON.stringify(params));
    assert.deepEqual(await response.json(), { error: text[error] });
    assert.equal(response.headers.get('content-disposition'), null);
  }
});

test('CSV requires authentication before querying the report', async () => {
  const { report, calls } = fixture();
  await assert.rejects(exportCsv(report, dates, 'vi', async () => { throw new Error('redirect:/login'); }), /redirect:\/login/);
  assert.equal(calls.length, 0);
});

test('export buttons use applied filters for all four selections in both languages and hide on invalid input', async () => {
  for (const language of ['vi', 'en']) {
    for (const { mode, flow } of selections) {
      const html = await renderPage({ ...dates, mode, flow }, language);
      const link = html.match(/<a href="(\/api\/export\/warehouse-accounting\?[^"]+)"[^>]*>([^<]+)<\/a>/);
      assert.ok(link);
      assert.equal(link[2], language === 'vi' ? 'Xuất CSV' : 'Export CSV');
      const url = new URL(link[1].replaceAll('&amp;', '&'), 'http://localhost');
      assert.deepEqual(Object.fromEntries(url.searchParams), { ...dates, mode, flow });
    }
    const invalid = await renderPage({ from: '2026-01-01', to: '2026-03-02' }, language);
    assert.doesNotMatch(invalid, /\/api\/export\/warehouse-accounting/);
    const defaultFlow = await renderPage(dates, language);
    assert.match(defaultFlow, /mode=outbound&amp;flow=CUSTOMER_OUT&amp;from=2026-09-01&amp;to=2026-09-29/);
  }
});

test('shared CSV helper preserves existing inferred headers and handles explicit empty schemas and carriage returns', () => {
  const { toCsv } = load('src/lib/csv.ts', {});
  assert.equal(toCsv([]), '\uFEFF');
  assert.equal(toCsv([{ sku: 'A', quantity: 15, cost: '1544.00', note: null }]), '\uFEFFsku,quantity,cost,note\nA,15,1544.00,');
  assert.equal(toCsv([], ['SKU', 'Product']), '\uFEFFSKU,Product');
  assert.equal(toCsv([{ 'Product, label': 'Cà phê\rHộp', quantity: 1 }]), '\uFEFF"Product, label",quantity\n"Cà phê\rHộp",1');
});
