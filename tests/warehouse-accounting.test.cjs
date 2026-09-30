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
  const sqlCalls = [];
  const prisma = {
    $queryRaw: async (query) => {
      sqlCalls.push(query);
      assert.match(query.text, /GROUP BY "productId"/);
      assert.match(query.text, /lower\(btrim\(COALESCE\(t.note, ''\)/);
      assert.match(query.text, /t.type = 'MANUFACTURER_IN' AND destination.code = 'KHO_TONG'/);
      assert.match(query.text, /t\."createdAt" >= \$\d+ AND t\."createdAt" < \$\d+/);
      assert.doesNotMatch(query.text, /hàng hoàn|hàng trả|nhập điều chỉnh/, 'labels must be bound parameters');
      const [start, end] = query.values.filter((value) => value instanceof Date);
      const supplierOnly = query.text.includes('NOT IN');
      const filter = query.text.match(/WHERE "normalizedNote" (?:NOT )?IN \(([^)]+)\)/)[1];
      const labels = [...filter.matchAll(/\$(\d+)/g)].map((match) => query.values[Number(match[1]) - 1]);
      const grouped = new Map();
      for (const [productId, type, quantity, source, destination, created, note] of transactions) {
        const time = new Date(created);
        if (type !== 'MANUFACTURER_IN' || destination !== 'KHO_TONG' || time < start || time >= end) continue;
        if (supplierOnly && source !== null) continue;
        const normalized = (note ?? '').trim().toLowerCase();
        if (supplierOnly ? labels.includes(normalized) : !labels.includes(normalized)) continue;
        const row = grouped.get(productId) ?? { productId, quantity: 0n, hoanQuantity: 0n, traQuantity: 0n };
        row.quantity += BigInt(quantity);
        if (normalized === 'hàng hoàn') row.hoanQuantity += BigInt(quantity);
        if (normalized === 'hàng trả') row.traQuantity += BigInt(quantity);
        grouped.set(productId, row);
      }
      return [...grouped.values()];
    },
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
  return { report: api(prisma), calls, sqlCalls, products, transactions, prisma };
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
  const { report, sqlCalls } = fixture();
  const result = await report.getWarehouseAccountingReport({ ...dates, mode: 'inbound' });
  assert.match(sqlCalls[0].text, /destination.code = 'KHO_TONG'/);
  assert.match(sqlCalls[0].text, /t\."sourceLocationId" IS NULL/);
  assert.equal(result.totalQuantity, 4);
  assert.equal(result.totalValue, '160000.00');
});

test('empty aggregates return zero without fetching products', async () => {
  const result = await api({ inventoryTransaction: { groupBy: async () => [] }, $queryRaw: async () => [] }).getWarehouseAccountingReport(dates);
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
  const report = api({ $queryRaw: async () => [], inventoryTransaction: { groupBy: async () => [
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

async function renderPage(params, language = 'en', authorize = async () => {}, report = fixture().report) {
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

test('page renders both dictionaries, selected flow, net columns, totals, and localized errors/empty state', async () => {
  for (const language of ['vi', 'en']) {
    const html = await renderPage(dates, language);
    assert.match(html, /value="CUSTOMER_OUT" selected=""/);
    assert.equal((html.match(/<option /g) || []).length, 2);
    assert.equal((html.match(/scope="col"/g) || []).length, 9);
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
const viNetHeaders = 'Loại báo cáo,Luồng,Từ ngày,Đến ngày,SKU,Sản phẩm,Số lượng xuất,Số lượng hoàn/trả,Số lượng xuất ròng,Giá vốn hiện tại,Giá trị xuất,Giá trị hoàn/trả,Giá trị ròng';
const viReturnHeaders = 'Loại báo cáo,Loại hoàn/trả,Từ ngày,Đến ngày,SKU,Sản phẩm,Số lượng hoàn,Số lượng trả,Tổng hoàn/trả,Giá vốn hiện tại,Giá trị hoàn/trả';
const selections = [
  { mode: 'outbound', flow: 'CUSTOMER_OUT', type: 'Xuất kho', label: 'Kho Lẻ → Khách hàng',
    data: 'SKU001,Product A,15,0,15,40000.00,600000.00,0.00,600000.00', file: 'xuat-rong_kho-le-khach' },
  { mode: 'outbound', flow: 'TRANSFER', type: 'Xuất kho', label: 'Kho Tổng → Kho Lẻ',
    data: 'SKU002,Product B,10,0.10,1.00', file: 'xuat_kho-tong-kho-le' },
  { mode: 'inbound', flow: 'TRANSFER', type: 'Nhập kho', label: 'Kho Tổng → Kho Lẻ',
    data: 'SKU002,Product B,10,0.10,1.00', file: 'nhap_kho-tong-kho-le' },
  { mode: 'inbound', flow: 'MANUFACTURER_IN', type: 'Nhập kho', label: 'NCC → Kho Tổng',
    data: 'SKU001,Product A,4,40000.00,160000.00', file: 'nhap_ncc-kho-tong' },
];

for (const selection of selections) {
  test(`CSV ${selection.mode}/${selection.flow} matches the report with one aggregate row and a safe filename`, async () => {
    const { report, calls, sqlCalls, transactions, products } = fixture();
    const before = JSON.stringify({ transactions, products });
    const params = { ...dates, mode: selection.mode, flow: selection.flow };
    const response = await exportCsv(report, params);
    assert.equal(response.headers.get('content-disposition'),
      `attachment; filename="ke-toan-kho_${selection.file}_2026-09-01_2026-09-29.csv"`);
    const csv = await csvBody(response);
    const isNet = selection.flow === 'CUSTOMER_OUT';
    assert.equal(csv, `${isNet ? viNetHeaders : viCsvHeaders}\n${selection.type},${selection.label},2026-09-01,2026-09-29,${selection.data}`);
    assert.equal(calls.length + sqlCalls.length, isNet ? 2 : 1, 'only necessary DB aggregates, no transaction detail fetch');
    const boundaries = calls.length ? [calls[0].where.createdAt.gte, calls[0].where.createdAt.lt]
      : sqlCalls[0].values.filter((value) => value instanceof Date);
    assert.equal(boundaries[0].toISOString(), '2026-08-31T17:00:00.000Z');
    assert.equal(boundaries[1].toISOString(), '2026-09-29T17:00:00.000Z');
    const screen = await report.getWarehouseAccountingReport(params);
    const cells = csv.split('\n')[1].split(',');
    assert.equal(cells[isNet ? 8 : 6], String(screen.totalQuantity));
    assert.equal(cells[isNet ? 9 : 7], screen.rows[0].costPrice);
    assert.equal(cells[isNet ? 12 : 8], screen.totalValue);
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
  assert.equal(csv, `${viNetHeaders}\nXuất kho,Kho Lẻ → Khách hàng,2026-09-01,2026-09-29,SKU001,"Cà phê, ""Đặc biệt""\r\nHộp giấy\rGói lẻ",15,0,15,1544.01,23160.15,0.00,23160.15`);
  assert.doesNotMatch(csv, /₫/);
});

test('CSV language follows validated UI cookies; empty reports retain the selected schema', async () => {
  const { report } = fixture();
  const en = await csvBody(await exportCsv(report, dates, 'en'));
  assert.equal(en, 'Report type,Flow,From date,To date,SKU,Product,Gross outbound quantity,Return quantity,Net outbound quantity,Current cost,Gross outbound value,Return value,Net value\nOutbound,Retail warehouse → Customer,2026-09-01,2026-09-29,SKU001,Product A,15,0,15,40000.00,600000.00,0.00,600000.00');
  const fallback = await csvBody(await exportCsv(report, dates, 'unsupported-language'));
  assert.equal(fallback, en);
  const emptyReport = api({ inventoryTransaction: { groupBy: async () => [] }, $queryRaw: async () => [] });
  assert.equal(await csvBody(await exportCsv(emptyReport)), viNetHeaders);
  assert.equal(await csvBody(await exportCsv(emptyReport, { ...dates, flow: 'TRANSFER' })), viCsvHeaders);
  assert.equal(await csvBody(await exportCsv(emptyReport, { ...dates, mode: 'returns' })), viReturnHeaders);
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
  const { report, calls, sqlCalls } = fixture();
  for (const mode of ['outbound', 'inbound', 'returns']) {
    await assert.rejects(exportCsv(report, { ...dates, mode }, 'vi', async () => { throw new Error('redirect:/login'); }), /redirect:\/login/);
  }
  assert.equal(calls.length, 0);
  assert.equal(sqlCalls.length, 0);
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

function netFixture() {
  const data = fixture();
  const at = '2026-09-05T12:00:00+07:00';
  data.transactions.splice(0, data.transactions.length,
    ['A', 'CUSTOMER_OUT', 100, 'KHO_LE', null, at],
    ['A', 'MANUFACTURER_IN', 10, null, 'KHO_TONG', at, 'Hàng hoàn'],
    ['A', 'MANUFACTURER_IN', 5, null, 'KHO_TONG', at, 'Hàng trả'],
    ['A', 'MANUFACTURER_IN', 30, null, 'KHO_TONG', at, 'nhập điều chỉnh'],
    ['A', 'MANUFACTURER_IN', 20, null, 'KHO_TONG', at, 'Nhập từ NCC'],
  );
  return data;
}

test('net outbound reconciles 100 gross - 15 returns = 85 with exact current-cost values and only grouped reads', async () => {
  const { report, calls, sqlCalls, products, transactions } = netFixture();
  const before = JSON.stringify({ products, transactions });
  const result = await report.getWarehouseAccountingReport(dates);
  assert.equal(result.rows.length, 1);
  assert.equal(result.totalGrossQuantity, 100);
  assert.equal(result.totalReturnQuantity, 15);
  assert.equal(result.totalNetQuantity, 85);
  assert.equal(result.totalGrossValue, '4000000.00');
  assert.equal(result.totalReturnValue, '600000.00');
  assert.equal(result.totalNetValue, '3400000.00');
  assert.equal(result.totalQuantity, 85);
  assert.equal(result.totalValue, '3400000.00');
  assert.equal(result.rows[0].netQuantity, 85);
  assert.equal(result.rows[0].netValue, '3400000.00');
  assert.equal(calls.length, 1);
  assert.equal(sqlCalls.length, 1);
  const sqlDates = sqlCalls[0].values.filter((value) => value instanceof Date);
  assert.deepEqual(sqlDates.map((value) => value.toISOString()),
    [calls[0].where.createdAt.gte.toISOString(), calls[0].where.createdAt.lt.toISOString()]);
  assert.equal(JSON.stringify({ products, transactions }), before);
  products[0].costPrice = new realPrisma.Prisma.Decimal('1544.01');
  const updated = await report.getWarehouseAccountingReport(dates);
  assert.equal(updated.totalGrossValue, '154401.00');
  assert.equal(updated.totalReturnValue, '23160.15');
  assert.equal(updated.totalNetValue, '131240.85');
});

test('prior-period sale with a current return is included as a negative SKU, including negative sub-unit money', async () => {
  const { report, transactions } = netFixture();
  transactions.push(['B', 'CUSTOMER_OUT', 5, 'KHO_LE', null, '2026-08-30T12:00:00+07:00']);
  transactions.push(['B', 'MANUFACTURER_IN', 5, 'KHO_LE', 'KHO_TONG', '2026-09-05T12:00:00+07:00', 'Hàng trả']);
  const result = await report.getWarehouseAccountingReport(dates);
  const returned = result.rows.find((row) => row.id === 'B');
  assert.equal(returned.grossQuantity, 0);
  assert.equal(returned.returnQuantity, 5);
  assert.equal(returned.netQuantity, -5);
  assert.equal(returned.netValue, '-0.50');
  assert.equal(result.totalNetQuantity, 80);
  assert.equal(result.totalNetValue, '3399999.50');
  const csv = await csvBody(await exportCsv(report));
  assert.match(csv, /SKU002,Product B,0,5,-5,0.10,0.00,0.50,-0.50/);
  const html = await renderPage(dates, 'vi', undefined, report);
  assert.match(html, />-5</);
  assert.match(html, />-0,5 ₫</);
  assert.equal(report.formatAccountingMoney('-0.50', 'en'), '-0.5 ₫');
});

test('note normalization is exact; supplier inbound excludes returns and adjustments but keeps null and unrelated free text', async () => {
  const { report, transactions, sqlCalls } = fixture();
  const notes = ['Hàng hoàn', ' hàng hoàn ', 'HÀNG HOÀN', '\tHÀNG HOÀN\r\n', 'Hàng trả', ' HÀNG TRẢ ',
    'nhập điều chỉnh', ' \tNHẬP ĐIỀU CHỈNH\n', null, '', '   ', 'Nhập NCC', 'Hàng hoàn từ khách', 'Hàng  hoàn', 'hang hoan'];
  transactions.splice(0, transactions.length, ...notes.map((note) =>
    ['A', 'MANUFACTURER_IN', 1, null, 'KHO_TONG', '2026-09-05T12:00:00+07:00', note]));
  const returns = await report.getWarehouseAccountingReport({ ...dates, mode: 'returns' });
  assert.equal(returns.rows[0].hoanQuantity, 4);
  assert.equal(returns.rows[0].traQuantity, 2);
  assert.equal(returns.totalReturnQuantity, 6);
  const supplier = await report.getWarehouseAccountingReport({ ...dates, mode: 'inbound' });
  assert.equal(supplier.totalQuantity, 7);
  assert.equal(supplier.totalValue, '280000.00');
  assert.equal(sqlCalls.length, 2);
  const supplierCsv = await csvBody(await exportCsv(report, { ...dates, mode: 'inbound' }));
  assert.equal(supplierCsv, `${viCsvHeaders}\nNhập kho,NCC → Kho Tổng,2026-09-01,2026-09-29,SKU001,Product A,7,40000.00,280000.00`);
});

test('supplier report excludes products having only returns/adjustments; wrong location and transaction type never count as returns', async () => {
  const { report, transactions } = netFixture();
  const at = '2026-09-05T12:00:00+07:00';
  transactions.push(
    ['B', 'MANUFACTURER_IN', 10, null, 'KHO_TONG', at, 'nhập điều chỉnh'],
    ['B', 'MANUFACTURER_IN', 10, null, 'KHO_LE', at, 'Hàng hoàn'],
    ['B', 'ADJUSTMENT', 10, null, 'KHO_TONG', at, 'Hàng trả'],
    ['B', 'TRANSFER', 10, 'KHO_TONG', 'KHO_LE', at, 'Hàng hoàn'],
  );
  const supplier = await report.getWarehouseAccountingReport({ ...dates, mode: 'inbound' });
  assert.equal(supplier.rows.length, 1);
  assert.equal(supplier.rows[0].id, 'A');
  assert.equal(supplier.totalQuantity, 20);
  const returns = await report.getWarehouseAccountingReport({ ...dates, mode: 'returns' });
  assert.equal(returns.rows.length, 1);
  assert.equal(returns.totalQuantity, 15);
  const transfer = await report.getWarehouseAccountingReport({ ...dates, flow: 'TRANSFER' });
  assert.equal(transfer.totalQuantity, 10);
  assert.equal(transfer.rows[0].id, 'B');
});

test('net CSV column totals reconcile with the three UI KPIs and show the accounting formula', async () => {
  const { report } = netFixture();
  const csv = await csvBody(await exportCsv(report));
  assert.equal(csv, `${viNetHeaders}\nXuất kho,Kho Lẻ → Khách hàng,2026-09-01,2026-09-29,SKU001,Product A,100,15,85,40000.00,4000000.00,600000.00,3400000.00`);
  for (const language of ['vi', 'en']) {
    const html = await renderPage(dates, language, undefined, report);
    const { text } = await loadUi(language).getUiContext();
    for (const [label, quantity, value] of [[text.accountingGross, 100, '4000000.00'],
      [text.accountingReturns, 15, '600000.00'], [text.accountingNet, 85, '3400000.00']]) {
      const card = html.split(`<article aria-label="${label}"`)[1].split('</article>')[0];
      assert.ok(card.includes(`>${quantity}</dd>`));
      assert.ok(card.includes(report.formatAccountingMoney(value, language)));
    }
    assert.ok(html.includes(text.accountingNetNote));
    assert.ok(html.includes(text.accountingPeriodNote));
    assert.ok(html.includes(renderToStaticMarkup(React.createElement('span', null, text.accountingCostNote)).slice(6, -7)));
    assert.match(html, /ring-2 ring-emerald-600/);
  }
});

for (const [kind, label, hoan, tra, value, slug] of [
  ['all', 'Tất cả', 10, 5, '600000.00', 'tat-ca'],
  ['hoan', 'Hàng hoàn', 10, 0, '400000.00', 'hang-hoan'],
  ['tra', 'Hàng trả', 0, 5, '200000.00', 'hang-tra'],
]) {
  test(`Returns ${kind}: report, filter UI and authenticated CSV agree`, async () => {
    const { report, calls, sqlCalls } = netFixture();
    const params = { ...dates, mode: 'returns', flow: 'RETURNS', returnKind: kind };
    const result = await report.getWarehouseAccountingReport(params);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].hoanQuantity, hoan);
    assert.equal(result.rows[0].traQuantity, tra);
    assert.equal(result.totalQuantity, hoan + tra);
    assert.equal(result.totalValue, value);
    assert.equal(calls.length, 0, 'no gross-outbound query in the returns view');
    assert.equal(sqlCalls.length, 1);
    const response = await exportCsv(report, params);
    assert.equal(response.headers.get('content-disposition'),
      `attachment; filename="ke-toan-kho_hoan-tra_${slug}_2026-09-01_2026-09-29.csv"`);
    assert.equal(await csvBody(response), `${viReturnHeaders}\nHàng hoàn / trả,${label},2026-09-01,2026-09-29,SKU001,Product A,${hoan},${tra},${hoan + tra},40000.00,${value}`);
    for (const language of ['vi', 'en']) {
      const html = await renderPage(params, language, undefined, report);
      assert.equal((html.match(/scope="col"/g) || []).length, 7);
      assert.equal((html.match(/<option /g) || []).length, 3);
      assert.ok(html.includes(`value="${kind}" selected=""`));
      assert.ok(html.includes(`returnKind=${kind}`));
      assert.ok(html.includes(report.formatAccountingMoney(value, language)));
      assert.match(html, /name="flow" value="RETURNS"/);
      const link = html.match(/href="(\/api\/export\/warehouse-accounting\?[^"]+)"/)[1];
      assert.deepEqual(Object.fromEntries(new URL(link.replaceAll('&amp;', '&'), 'http://localhost').searchParams), params);
    }
  });
}

test('return queries use Vietnam boundaries in every view and preserve 60-day validation', async () => {
  const { report, transactions } = fixture();
  const instants = [
    ['2026-08-31T16:59:59.999Z', 90], ['2026-08-31T17:00:00.000Z', 2],
    ['2026-09-30T16:59:59.999Z', 3], ['2026-09-30T17:00:00.000Z', 90],
  ];
  transactions.splice(0, transactions.length, ...instants.map(([instant, quantity]) =>
    ['A', 'MANUFACTURER_IN', quantity, null, 'KHO_TONG', instant, 'Hàng hoàn']));
  for (const mode of ['returns', 'outbound']) {
    const result = await report.getWarehouseAccountingReport({ mode, from: '2026-09-01', to: '2026-09-30' });
    assert.equal(result.totalReturnQuantity, 5);
    assert.equal(result.totalReturnValue, '200000.00');
  }
  for (const returnKind of ['all', 'hoan', 'tra']) {
    await csvBody(await exportCsv(report, { mode: 'returns', returnKind, from: '2026-01-01', to: '2026-03-01' }));
    for (const badDates of [{ from: '2026-01-01', to: '2026-03-02' }, { from: '2026-09-30', to: '2026-09-01' }]) {
      const response = await exportCsv(api(), { ...badDates, mode: 'returns', returnKind });
      assert.equal(response.status, 400);
    }
  }
  for (const bad of [
    { mode: 'returns', flow: 'CUSTOMER_OUT' }, { mode: 'returns', flow: 'MANUFACTURER_IN' },
    { mode: 'returns', flow: 'TRANSFER' }, { mode: 'outbound', flow: 'RETURNS' },
    { mode: 'inbound', flow: 'RETURNS' }, { mode: 'returns', returnKind: 'unknown' },
    { mode: 'returns', returnKind: '' }, { mode: 'outbound', returnKind: 'hoan' },
  ]) assert.equal((await exportCsv(api(), { ...dates, ...bad })).status, 400);
  assert.equal((await exportCsv(api(), 'mode=returns&returnKind=hoan&returnKind=tra')).status, 400);
});

test('actual PostgreSQL executes the parameterized classification SELECTs with Vietnamese case/whitespace and no schema or data writes', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec('BEGIN READ ONLY');
    const { report, prisma, transactions } = netFixture();
    const at = '2026-09-05T12:00:00+07:00';
    transactions.splice(1, 4,
      ...[['Hàng hoàn', 3], [' hàng hoàn ', 3], ['\u00a0HÀNG HOÀN\u00a0', 4],
        [' Hàng trả ', 2], ['\tHÀNG TRẢ\r\n', 3],
        ['nhập điều chỉnh', 10], [' NHẬP ĐIỀU CHỈNH ', 20],
        [null, 6], ['', 7], ['Hàng hoàn từ khách', 7]].map(([note, quantity]) =>
        ['A', 'MANUFACTURER_IN', quantity, null, 'KHO_TONG', at, note]),
      ['B', 'CUSTOMER_OUT', 5, 'KHO_LE', null, '2026-08-30T12:00:00+07:00'],
      ['B', 'MANUFACTURER_IN', 2, null, 'KHO_TONG', '2026-09-01T00:00:00+07:00', 'HÀNG TRẢ'],
      ['B', 'MANUFACTURER_IN', 3, 'KHO_LE', 'KHO_TONG', '2026-09-29T23:59:59.999+07:00', 'hàng trả'],
      ['B', 'MANUFACTURER_IN', 90, null, 'KHO_TONG', '2026-08-31T23:59:59.999+07:00', 'Hàng hoàn'],
      ['B', 'MANUFACTURER_IN', 90, null, 'KHO_TONG', '2026-09-30T00:00:00+07:00', 'Hàng trả'],
      ['B', 'MANUFACTURER_IN', 90, null, 'KHO_LE', at, 'Hàng hoàn'],
      ['B', 'ADJUSTMENT', 90, null, 'KHO_TONG', at, 'Hàng trả'],
    );
    prisma.$queryRaw = async (query) => {
      // VALUES CTEs shadow the table names for this SELECT only. No CREATE,
      // INSERT, seed, local server, credentials or production connection.
      const values = [...query.values];
      const casts = ['text', 'text', 'integer', 'text', 'text', 'timestamp', 'text'];
      const fixtures = transactions.map(([id, type, qty, source, destination, created, note]) => {
        const row = [id, type, qty, source, destination, new Date(created).toISOString(), note ?? null];
        return `(${row.map((value, index) => { values.push(value); return `$${values.length}::${casts[index]}`; }).join(',')})`;
      });
      const sql = `WITH "InventoryTransaction" ("productId", type, quantity, "sourceLocationId", "destinationLocationId", "createdAt", note) AS (
        VALUES ${fixtures.join(',')}
      ), "Location" (id, code) AS (VALUES ('KHO_TONG', 'KHO_TONG'), ('KHO_LE', 'KHO_LE')),
      ${query.text.replace(/^\s*WITH\s+/, '')}`;
      return (await db.query(sql, values)).rows;
    };
    for (const timezone of ['UTC', 'America/Los_Angeles']) {
      await db.query("SELECT set_config('TimeZone', $1, true)", [timezone]);
      for (const [params, quantity, value] of [
        [{}, 80, '3399999.50'],
        [{ mode: 'inbound' }, 20, '800000.00'],
        [{ mode: 'returns', returnKind: 'all' }, 20, '600000.50'],
        [{ mode: 'returns', returnKind: 'hoan' }, 10, '400000.00'],
        [{ mode: 'returns', returnKind: 'tra' }, 10, '200000.50'],
      ]) {
        const result = await report.getWarehouseAccountingReport({ ...dates, ...params });
        assert.equal(result.totalQuantity, quantity, `${timezone}: ${JSON.stringify(params)}`);
        assert.equal(result.totalValue, value);
      }
    }
    await db.exec('ROLLBACK');
  } finally {
    await db.close();
  }
});
