const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load, fixture } = require('./helpers/auth-fixture.cjs');
const text = load('src/lib/ui.ts').uiText;
const idle = { status: 'idle', message: '' };
function form(current = 'Old-local-123', next = 'New-local-456', confirmation = next) {
  const data = new FormData();
  data.set('currentPassword', current); data.set('newPassword', next); data.set('confirmPassword', confirmation);
  return data;
}
const redirected = (promise, url) => assert.rejects(promise, e => e.url === url);

for (const role of ['ADMIN', 'OPERATION']) {
  test(`${role} changes own password, revokes every own session, preserves other users, and must sign in again`, async () => {
    const f = fixture(role);
    await f.auth.createSession('A'); const firstToken = f.jar.get('mims_session');
    await f.auth.createSession('A'); const secondToken = f.jar.get('mims_session');
    await f.auth.createSession('B'); const otherToken = f.jar.get('mims_session');
    const otherUser = JSON.stringify(f.users[1]);
    const otherSessions = JSON.stringify(f.sessions.filter(s => s.userId === 'B'));
    f.jar.set('mims_session', firstToken); f.jar.set('wiings_session', firstToken);
    const payload = form(); payload.set('userId', 'B'); payload.set('username', 'qa-admin');
    await redirected(f.action.changePasswordAction(idle, payload), '/login?passwordChanged=1');
    assert.equal(f.jar.has('mims_session'), false); assert.equal(f.jar.has('wiings_session'), false);
    assert.equal(f.sessions.filter(s => s.userId === 'A').length, 0);
    assert.equal(JSON.stringify(f.users[1]), otherUser);
    assert.equal(JSON.stringify(f.sessions.filter(s => s.userId === 'B')), otherSessions);
    assert.equal(f.password.verifyPassword('Old-local-123', f.users[0].passwordHash), false);
    assert.equal(f.password.verifyPassword('New-local-456', f.users[0].passwordHash), true);
    assert.deepEqual(f.writes, [{ kind: 'password-and-sessions', userId: 'A' }]);
    for (const token of [firstToken, secondToken]) {
      f.jar.set('mims_session', token);
      await redirected(f.auth.requireUser(), '/login');
    }
    f.jar.set('mims_session', otherToken);
    assert.equal((await f.auth.requireUser()).id, 'B');
    f.jar.clear();
    const login = new FormData(); login.set('username', 'qa-operation'); login.set('password', 'Old-local-123');
    await redirected(f.action.loginAction(login), '/login?error=invalid');
    login.set('password', 'New-local-456');
    await redirected(f.action.loginAction(login), '/');
    assert.equal((await f.auth.requireUser()).id, 'A');
  });
}

for (const [label, current, next, confirmation, expected] of [
  ['wrong current', 'Wrong-local-123', 'New-local-456', 'New-local-456', text.currentPasswordIncorrect],
  ['missing current', '', 'New-local-456', 'New-local-456', text.currentPasswordRequired],
  ['short new password', 'Old-local-123', 'short', 'short', text.newPasswordTooShort],
  ['mismatched confirmation', 'Old-local-123', 'New-local-456', 'Other-local-456', text.passwordConfirmationMismatch],
  ['same new password', 'Old-local-123', 'Old-local-123', 'Old-local-123', text.passwordMustDiffer],
]) {
  test(`${label} is rejected in Vietnamese without changing hashes or sessions`, async () => {
    const f = fixture(); await f.auth.createSession('A'); const before = f.snapshot();
    const result = await f.action.changePasswordAction(idle, form(current, next, confirmation));
    assert.equal(result.status, 'error'); assert.equal(result.message, expected);
    assert.equal(f.snapshot(), before); assert.equal(f.writes.length, 0);
    assert.deepEqual(Object.keys(result).sort(), ['message', 'status']);
  });
}

test('unauthenticated requests cannot choose a target through browser fields', async () => {
  const f = fixture(); const before = f.snapshot();
  const payload = form(); payload.set('userId', 'A');
  await redirected(f.action.changePasswordAction(idle, payload), '/login');
  assert.equal(f.snapshot(), before);
});

test('password whitespace remains significant and exactly eight characters is accepted', async () => {
  const f = fixture(); f.users[0].passwordHash = f.password.hashPassword(' Old-local-123 ');
  await f.auth.createSession('A');
  assert.equal((await f.action.changePasswordAction(idle, form('Old-local-123', ' new123 '))).message, text.currentPasswordIncorrect);
  await redirected(f.action.changePasswordAction(idle, form(' Old-local-123 ', ' new123 ')), '/login?passwordChanged=1');
  assert.equal(f.password.verifyPassword(' new123 ', f.users[0].passwordHash), true);
  assert.equal(f.password.verifyPassword('new123', f.users[0].passwordHash), false);
});

test('malformed form values return a safe Vietnamese error with no write', async () => {
  const f = fixture(); await f.auth.createSession('A'); const before = f.snapshot();
  const payload = form(); payload.set('newPassword', new Blob(['invalid']), 'not-a-password.txt');
  const result = await f.action.changePasswordAction(idle, payload);
  assert.equal(result.message, text.passwordChangeError); assert.equal(f.snapshot(), before);
});

test('database failure leaves auth unchanged and never reveals internal errors', async () => {
  const f = fixture(); await f.auth.createSession('A'); const before = f.snapshot();
  f.beforeWrite = () => { throw new Error('private database detail'); };
  const result = await f.action.changePasswordAction(idle, form());
  assert.equal(result.message, text.passwordChangeError); assert.equal(f.snapshot(), before);
});

test('successful change clears cookies without an extra database cleanup that could fail after commit', async () => {
  const f = fixture(); await f.auth.createSession('A');
  f.prisma.userSession.deleteMany = () => { throw new Error('Redundant database cleanup'); };
  await redirected(f.action.changePasswordAction(idle, form()), '/login?passwordChanged=1');
  assert.equal(f.jar.size, 0); assert.equal(f.sessions.length, 0);
});

test('a concurrent reset cannot be overwritten after checking the old password', async () => {
  const f = fixture(); await f.auth.createSession('A');
  f.beforeWrite = () => { f.users[0].passwordHash = f.password.hashPassword('Concurrent-local-789'); };
  const result = await f.action.changePasswordAction(idle, form());
  assert.equal(result.status, 'error'); assert.equal(f.writes.length, 0);
  assert.equal(f.password.verifyPassword('Concurrent-local-789', f.users[0].passwordHash), true);
});

test('admin reset still changes the selected user and revokes only that user sessions', async () => {
  const f = fixture(); await f.auth.createSession('A'); await f.auth.createSession('A'); await f.auth.createSession('B');
  const adminBefore = JSON.stringify(f.users[1]); const adminSessions = JSON.stringify(f.sessions.filter(s => s.userId === 'B'));
  const payload = new FormData(); payload.set('userId', 'A'); payload.set('password', 'Admin-reset-456');
  const result = await f.admin.resetUserPasswordAction(idle, payload);
  assert.equal(result.status, 'success'); assert.equal(f.password.verifyPassword('Admin-reset-456', f.users[0].passwordHash), true);
  assert.equal(f.sessions.filter(s => s.userId === 'A').length, 0);
  assert.equal(JSON.stringify(f.users[1]), adminBefore); assert.equal(JSON.stringify(f.sessions.filter(s => s.userId === 'B')), adminSessions);
});

test('OPERATION still cannot use admin reset', async () => {
  const f = fixture(); await f.auth.createSession('A'); const before = f.snapshot();
  const payload = new FormData(); payload.set('userId', 'B'); payload.set('password', 'Admin-reset-456');
  await redirected(f.admin.resetUserPasswordAction(idle, payload), '/'); assert.equal(f.snapshot(), before);
});

test('change form exposes exactly three password inputs, no target user field, and disables pending submissions', () => {
  for (const pending of [false, true]) {
    const { ChangePasswordForm } = load('src/components/change-password-form.tsx', {
      react: { ...React, useActionState: () => [{ status: 'error', message: text.currentPasswordIncorrect }, '/test-action', pending] },
      '@/app/actions/auth': {}, '@/components/action-feedback': {},
    });
    const html = renderToStaticMarkup(React.createElement(ChangePasswordForm, { text }));
    assert.equal((html.match(/type="password"/g) || []).length, 3);
    assert.doesNotMatch(html, /name="(?:userId|username)"/);
    assert.match(html, /role="alert"/);
    assert.equal((html.match(/disabled=""/g) || []).length, pending ? 4 : 0);
  }
});

test('both roles see self password link; only ADMIN has user management navigation', async () => {
  for (const role of ['ADMIN', 'OPERATION']) {
    const { default: Layout } = load('src/app/layout.tsx', {
      '@/lib/auth': { getCurrentUser: async () => ({ id: 'A', username: 'local', role }) },
      '@/app/actions/auth': { logoutAction: '/test-logout' },
      '@/components/basket-provider': { BasketProvider: ({ children }) => children },
      '@/components/inventory-basket-count': { InventoryBasketCount: () => null },
      'next/link': { default: ({ children, href }) => React.createElement('a', { href }, children) },
      'lucide-react': new Proxy({}, { get: () => () => null }),
    });
    const html = renderToStaticMarkup(await Layout({ children: null }));
    assert.match(html, /href="\/change-password"/); assert.match(html, /Đổi mật khẩu/);
    assert.equal(html.includes('href="/manage-users"'), role === 'ADMIN');
  }
});

test('change-password page authenticates before rendering; login renders only fixed Vietnamese messages', async () => {
  const f = fixture();
  const page = load('src/app/change-password/page.tsx', { ...f.dependencies, '@/components/change-password-form': { ChangePasswordForm: () => null } });
  await redirected(page.default(), '/login');
  const login = load('src/app/login/page.tsx', { ...f.dependencies, '@/components/login-submit-button': { LoginSubmitButton: () => null } });
  const success = renderToStaticMarkup(await login.default({ searchParams: Promise.resolve({ passwordChanged: '1' }) }));
  assert.match(success, /Mật khẩu đã được thay đổi/);
  const invalid = renderToStaticMarkup(await login.default({ searchParams: Promise.resolve({ error: 'invalid', passwordChanged: '1' }) }));
  assert.match(invalid, /Tên đăng nhập hoặc mật khẩu không đúng/); assert.doesNotMatch(invalid, /Mật khẩu đã được thay đổi/);
});
