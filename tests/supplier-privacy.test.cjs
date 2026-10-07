const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./helpers/auth-fixture.cjs');
const { maskSupplierName } = load('src/lib/format.ts');

test('supplier masking handles requested examples, short names, Unicode and existing blank fallbacks', () => {
  for (const [value, expected] of [['HEIHUN: Shandong', 'HEI…'], ['MINAFEN', 'MIN…'], ['VRT', 'VRT…'], ['WEADDU', 'WEA…'], ['AB', 'AB…'], ['  CÔNG TY  ', 'CÔN…'], ['🌸ABCD', '🌸AB…']]) {
    assert.equal(maskSupplierName(value), expected);
  }
  for (const empty of [null, undefined, '', '   ']) assert.equal(maskSupplierName(empty), empty);
});

test('only dashboard presentation masks names; inventory, options, search and CSV retain the original data', async () => {
  const names = ['HEIHUN: Shandong', 'MINAFEN', 'VRT'];
  const suppliers = names.map((name, i) => ({ id: `s${i}`, name, isActive: true }));
  const products = suppliers.map((supplier, i) => ({ id: `p${i}`, sku: `SKU${i}`, name: `Product ${i}`, costPrice: 10, leadTimeDays: 2, status: 'ACTIVE', supplierId: supplier.id, supplier,
    inventoryBalances: [{ quantity: 5, location: { code: 'KHO_TONG' } }, { quantity: 2, location: { code: 'KHO_LE' } }] }));
  const before = JSON.stringify({ suppliers, products });
  const prisma = { product: { findMany: async () => products, count: async () => products.length },
    supplier: { findMany: async () => suppliers }, inventoryTransaction: { count: async () => 0 }, $queryRaw: async () => [] };
  const dependencies = { '@/lib/prisma': { prisma }, '@/lib/auth': { requireUser: async () => ({ id: 'local' }) },
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children) } };
  const data = load('src/lib/warehouse-data.ts', dependencies);
  const dashboard = load('src/app/page.tsx', dependencies);
  const inventory = load('src/app/inventory/page.tsx', dependencies);
  const dashboardHtml = renderToStaticMarkup(await dashboard.default());
  for (const masked of ['HEI…', 'MIN…', 'VRT…']) assert.ok(dashboardHtml.includes(masked));
  assert.ok(!dashboardHtml.includes('HEIHUN: Shandong')); assert.ok(!dashboardHtml.includes('MINAFEN'));
  assert.doesNotMatch(dashboardHtml, /title="(?:HEIHUN|MINAFEN|VRT)/);
  const inventoryHtml = renderToStaticMarkup(await inventory.default());
  for (const name of names) assert.ok(inventoryHtml.includes(name));
  for (const rows of [await data.getProductInventoryRows(), (await data.searchProductRows({})).rows]) {
    assert.deepEqual(Array.from(rows, r => r.supplierName), names);
  }
  assert.deepEqual(Array.from(await data.getSupplierOptions(), s => s.name), names);
  for (const rows of [await data.getStockExportRows(), await data.getSupplierExportRows(), await data.getInventoryExportRows()]) {
    assert.deepEqual(Array.from(rows, r => r.supplier_name), names);
  }
  assert.equal(JSON.stringify({ suppliers, products }), before);
});
