/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS harness matches the existing .test.cjs suites. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '../..');

function load(file, dependencies = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, FormData, Date, Buffer, console, process: { env: { NODE_ENV: 'test' } }, require(id) {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === 'server-only' || id.endsWith('.css')) return {};
    if (id.startsWith('@/')) {
      const base = 'src/' + id.slice(2);
      return load(fs.existsSync(path.join(root, base + '.ts')) ? base + '.ts' : base + '.tsx', dependencies);
    }
    if (id === 'react') return { ...React, cache: (fn) => fn };
    if (['react/jsx-runtime', 'node:crypto', '@prisma/client', 'zod'].includes(id)) return require(id);
    throw new Error(`Unexpected test dependency: ${id}`);
  } });
  return exports;
}

function fixture(role = 'OPERATION') {
  const password = load('src/lib/password.ts');
  const users = [
    { id: 'A', username: 'qa-operation', role, passwordHash: password.hashPassword('Old-local-123') },
    { id: 'B', username: 'qa-admin', role: 'ADMIN', passwordHash: password.hashPassword('Admin-local-123') },
  ];
  const sessions = [];
  const jar = new Map();
  const writes = [];
  const select = (row, fields) => row && (fields ? Object.fromEntries(Object.keys(fields).filter(k => fields[k]).map(k => [k, row[k]])) : { ...row });
  const f = { users, sessions, jar, writes, password, beforeWrite: () => {} };
  const prisma = {
    user: {
      findUnique: async ({ where, select: fields }) => select(users.find(u => where.id ? u.id === where.id : u.username === where.username), fields) || null,
      findMany: async ({ select: fields } = {}) => users.map(u => select(u, fields)),
      update: async ({ where, data, select: fields }) => {
        await f.beforeWrite();
        const user = users.find(u => u.id === where.id && (!where.passwordHash || u.passwordHash === where.passwordHash));
        if (!user) throw new Error('Guarded user update rejected');
        if (Object.keys(data).sort().join(',') !== 'passwordHash,sessions' || Object.keys(data.sessions.deleteMany).length) throw new Error('Unexpected auth write');
        writes.push({ kind: 'password-and-sessions', userId: user.id });
        user.passwordHash = data.passwordHash;
        for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].userId === user.id) sessions.splice(i, 1);
        return select(user, fields);
      },
    },
    userSession: {
      create: async ({ data }) => { const row = { id: `session-${sessions.length + 1}`, ...data }; sessions.push(row); return row; },
      findUnique: async ({ where }) => {
        const session = sessions.find(s => s.tokenHash === where.tokenHash);
        if (!session) return null;
        return { ...session, user: select(users.find(u => u.id === session.userId), { id: true, username: true, role: true }) };
      },
      deleteMany: async ({ where }) => {
        let count = 0;
        for (let i = sessions.length - 1; i >= 0; i--) {
          if ((where.tokenHash && sessions[i].tokenHash === where.tokenHash) || (where.userId && sessions[i].userId === where.userId)) { sessions.splice(i, 1); count++; }
        }
        return { count };
      },
      delete: async ({ where }) => { const i = sessions.findIndex(s => s.id === where.id); if (i >= 0) sessions.splice(i, 1); },
    },
  };
  const redirect = (url) => { const error = new Error('Redirect'); error.url = url; throw error; };
  const dependencies = {
    '@/lib/prisma': { prisma },
    'next/headers': { cookies: async () => ({ get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined, set: (name, value) => jar.set(name, value), delete: (name) => jar.delete(name) }) },
    'next/navigation': { redirect },
    'next/cache': { revalidatePath() {} },
  };
  f.prisma = prisma;
  f.dependencies = dependencies;
  f.auth = load('src/lib/auth.ts', dependencies);
  f.action = load('src/app/actions/auth.ts', dependencies);
  f.admin = load('src/app/actions/warehouse.ts', dependencies);
  f.snapshot = () => JSON.stringify({ users, sessions });
  return f;
}

module.exports = { load, fixture };
