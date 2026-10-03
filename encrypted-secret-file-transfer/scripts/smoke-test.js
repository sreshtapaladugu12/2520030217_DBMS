// `npm run test:smoke`: end-to-end test through the gateway. Starts the stack itself if it is not running.
// Requires MongoDB. Run `npm run reset:data` first for a clean database.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../shared/env');
loadEnv();

const BASE = `http://localhost:${process.env.PORT || 4000}`;
const MARKER = `SMOKE-PLAINTEXT-${Date.now()}`;
const CONTENT = `${MARKER}\nsecret smoke-test content\n`;
let child, passed = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(name, cond, extra = '') {
  if (!cond) throw new Error(`FAILED: ${name} ${extra}`);
  passed++; console.log(`  ok  ${name}`);
}
async function api(p, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + p, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, res, json: type.includes('json') ? await res.json() : null };
}
async function up() { try { return (await fetch(`${BASE}/api/health`)).ok; } catch { return false; } }

async function waitForStack() {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (await up()) {
      const s = await api('/api/service-status');
      if (['authentication', 'file', 'permission', 'audit'].every((k) => s.json[k] === 'ok')) return;
    }
    await sleep(700);
  }
  throw new Error('Stack did not become healthy (is MongoDB running?)');
}

async function run() {
  if (!(await up())) {
    console.log('Gateway not running - starting the stack for the test...');
    child = spawn(process.execPath, [path.join(__dirname, 'start-all.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.on('data', (d) => process.stderr.write(d));
  }
  await waitForStack();
  console.log('Running smoke tests against', BASE);

  const health = await api('/api/health');
  check('1. gateway is running', health.status === 200);
  const status = await api('/api/service-status');
  check('2. auth service reachable + health endpoint', status.json.authentication === 'ok' && status.json.gateway === 'ok');
  check('13. service status lists all services', ['file', 'permission', 'audit'].every((k) => status.json[k] === 'ok'));

  const id = Date.now();
  const A = { name: 'Smoke A', email: `smoke.a.${id}@example.com`, password: 'Smoke@123' };
  const B = { name: 'Smoke B', email: `smoke.b.${id}@example.com`, password: 'Smoke@456' };
  const regA = await api('/api/auth/register', { method: 'POST', body: A });
  const regB = await api('/api/auth/register', { method: 'POST', body: B });
  check('3. registration', regA.status === 201 && regB.status === 201 && !JSON.stringify(regA.json).includes('passwordHash'));
  const loginA = await api('/api/auth/login', { method: 'POST', body: A });
  const loginB = await api('/api/auth/login', { method: 'POST', body: B });
  check('4. login returns JWT', loginA.status === 200 && !!loginA.json.token);
  const badLogin = await api('/api/auth/login', { method: 'POST', body: { email: A.email, password: 'wrong-pass1' } });
  check('   wrong password rejected', badLogin.status === 401);
  const tA = loginA.json.token, tB = loginB.json.token;
  const me = await api('/api/auth/me', { token: tA });
  check('5. JWT authenticates /api/auth/me', me.status === 200 && me.json.user.email === A.email);
  check('   missing token -> 401', (await api('/api/files')).status === 401);
  check('   invalid token -> 401', (await api('/api/files', { token: 'abc.def.ghi' })).status === 401);

  const form = new FormData();
  form.append('file', new Blob([CONTENT], { type: 'text/plain' }), 'smoke-secret.txt');
  const upl = await api('/api/files/upload', { method: 'POST', token: tA, form });
  check('6. file upload', upl.status === 201 && upl.json.file.id);
  const fileId = upl.json.file.id;
  const meta = await api(`/api/files/${fileId}`, { token: tA });
  check('7. file metadata created', meta.status === 200 && meta.json.file.originalName === 'smoke-secret.txt' && meta.json.file.size === Buffer.byteLength(CONTENT));
  check('   metadata hides keys/paths', !/wrappedKey|storedName|storagePath/.test(JSON.stringify(meta.json)));

  const dir = path.resolve(__dirname, '..', process.env.FILE_STORAGE_DIR || './uploads/encrypted');
  if (fs.existsSync(dir)) {
    const blobs = fs.readdirSync(dir).filter((f) => f.endsWith('.enc'));
    const leaked = blobs.some((f) => fs.readFileSync(path.join(dir, f)).includes(MARKER));
    check('   stored file is encrypted on disk (plaintext marker absent)', blobs.length > 0 && !leaked);
  }

  const denied = await api(`/api/files/${fileId}/download`, { token: tB });
  check('11. unauthorized download rejected (403)', denied.status === 403);
  const share = await api('/api/permissions', { method: 'POST', token: tA, body: { fileId, email: B.email } });
  check('8. file sharing', share.status === 201);
  const permId = share.json.permission.id;
  check('9. non-owner cannot share', (await api('/api/permissions', { method: 'POST', token: tB, body: { fileId, email: A.email } })).status === 403);
  const shared = await api('/api/files?scope=shared', { token: tB });
  check('   file appears in "Shared With Me"', shared.json.files.some((f) => f.id === fileId));

  const dl = await api(`/api/files/${fileId}/download`, { token: tB });
  const text = dl.res.status === 200 ? await dl.res.text() : '';
  check('10. authorized download returns original content', dl.status === 200 && text === CONTENT);

  const revoke = await api(`/api/permissions/${permId}`, { method: 'DELETE', token: tA });
  check('   revoke access', revoke.status === 200);
  check('   download denied after revoke', (await api(`/api/files/${fileId}/download`, { token: tB })).status === 403);

  const logs = await api('/api/logs?limit=100', { token: tA });
  const actions = new Set(logs.json.logs.filter((l) => l.fileId === fileId).map((l) => l.action));
  check('12. audit logs (UPLOAD/SHARE/DOWNLOAD/REVOKE/DOWNLOAD_DENIED)', ['UPLOAD', 'SHARE', 'DOWNLOAD', 'REVOKE', 'DOWNLOAD_DENIED'].every((a) => actions.has(a)), [...actions].join(','));

  check('   normal user blocked from admin API', (await api('/api/admin/stats', { token: tA })).status === 403);
  const admin = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'Admin@123' } });
  if (admin.status === 200) {
    const stats = await api('/api/admin/stats', { token: admin.json.token });
    check('   admin stats', stats.status === 200 && stats.json.totalUsers >= 3);
    check('   admin cannot download others\' files', (await api(`/api/files/${fileId}/download`, { token: admin.json.token })).status === 403);
  } else console.log('  --  admin checks skipped (run npm run reset:data to seed admin)');

  const overview = await api('/api/overview', { token: tA });
  check('   dashboard overview', overview.status === 200 && overview.json.stats.totalFiles >= 1);
  console.log(`\nSmoke test passed (${passed} checks).`);
}

run().catch((e) => { console.error('\n' + e.message); process.exitCode = 1; })
  .finally(() => { if (child) child.kill('SIGTERM'); });
