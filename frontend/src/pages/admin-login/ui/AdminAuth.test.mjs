import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

test('unauthenticated /admin redirects to /admin/login', () => {
  const app = readFileSync(join(src, 'app/App.tsx'), 'utf8');
  assert.match(app, /path=["']\/admin\/login["']/);
  assert.match(app, /AdminLoginPage/);

  const dashboard = readFileSync(join(src, 'pages/admin-dashboard/ui/AdminDashboardPage.tsx'), 'utf8');
  assert.match(dashboard, /useAdminSession/);
  assert.match(dashboard, /Navigate to=["']\/admin\/login["']/);
  assert.match(dashboard, /Logout/);
});

test('authenticated /admin stays on the existing dashboard', () => {
  const dashboard = readFileSync(join(src, 'pages/admin-dashboard/ui/AdminDashboardPage.tsx'), 'utf8');
  assert.match(dashboard, /DashboardWidget/);
  assert.match(dashboard, /session === ['"]unauthenticated['"]/);
  assert.doesNotMatch(dashboard, /localStorage/);
});

test('login page posts credentials to the API and never embeds the admin password', () => {
  const page = readFileSync(join(here, 'AdminLoginPage.tsx'), 'utf8');
  assert.match(page, /adminAuthApi\.login\(username\.trim\(\),\s*password\)/);
  assert.match(page, /Sign In/);
  assert.match(page, /Username/);
  assert.match(page, /Password/);
  assert.match(page, /to=["']\/admin["']/);
  assert.doesNotMatch(page, /ADMIN_PASSWORD/);
  assert.doesNotMatch(page, /codeyoung/);

  const api = readFileSync(join(src, 'features/admin-auth/api/index.ts'), 'utf8');
  assert.match(api, /\/admin\/login/);
  assert.match(api, /\/admin\/logout/);
  assert.match(api, /\/admin\/session/);
  assert.doesNotMatch(api, /localStorage/);
});
