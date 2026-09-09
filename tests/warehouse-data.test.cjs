const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const realPrisma = require('@prisma/client');

function load(prisma) {
  const source = fs.readFileSync('src/lib/warehouse-data.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Map, require: (id) => {
    if (id === '@prisma/client') return realPrisma;
    if (id === '@/lib/prisma') return { prisma };
    throw new Error(id);
  } });
  return exports;
}

function product(id, balances = []) {
  return { id, sku: id, name: id, costPrice: 5, leadTimeDays: 2,
    supplierId: 'supplier', status: 'ACTIVE', supplier: { name: 'Supplier' },
    inventoryBalances: balances };
}

test('inventory preserves balances, converts SQL bigint and defaults missing sales to zero', async () => {
  let query;
  const api = load({ product: { findMany: async ({ select }) => {
    assert.equal(select.imageUrl, undefined);
    assert.equal(select.inventoryTransactions, undefined);
    return [product('sold', [{ quantity: 7, location: { code: 'KHO_TONG' } }]), product('unsold')];
  } }, $queryRaw: async (sql) => {
    query = sql;
    return [{ productId: 'sold', outbound7d: 3n, outbound30d: 12n }];
  } });
  const rows = await api.getProductInventoryRows();
  assert.equal(rows[0].totalQty, 7);
  assert.equal(rows[0].outbound7d, 3);
  assert.equal(rows[0].outbound30d, 12);
  assert.equal(rows[1].outbound30d, 0);
  assert.equal(Object.hasOwn(rows[1], 'imageUrl'), false);
  assert.match(query.text, /GROUP BY/);
  assert.ok(query.values.includes('sold'));
  assert.ok(!query.text.includes('sold'));
  assert.doesNotThrow(() => JSON.stringify(rows));
});

test('empty inventory avoids an invalid empty IN query', async () => {
  const api = load({ product: { findMany: async () => [] },
    $queryRaw: () => { throw new Error('unnecessary SQL'); } });
  assert.equal((await api.getProductInventoryRows()).length, 0);
});

test('search aggregates only the returned page and retains pagination', async () => {
  const api = load({ product: {
    findMany: async (args) => {
      assert.equal(args.skip, 50);
      assert.equal(args.take, 50);
      assert.equal(args.select.imageUrl, undefined);
      assert.equal(args.select.inventoryTransactions, undefined);
      return [product("quote'bound")];
    }, count: async () => 60,
  }, $queryRaw: async (sql) => {
    assert.ok(sql.values.includes("quote'bound"));
    assert.ok(!sql.text.includes("quote'bound"));
    return [];
  } });
  const result = await api.searchProductRows({ skip: 50 });
  assert.equal(result.hasMore, true);
  assert.equal(result.total, 60);
  assert.equal(result.rows[0].outbound7d, 0);
});
