// Starts the gateway and every backend service as separate Node processes.
//   node scripts/start-all.js             -> backend only (gateway serves frontend/dist)
//   node scripts/start-all.js --frontend  -> also runs the Vite dev server on :5173
const { spawn } = require('child_process');
const path = require('path');
const { loadEnv, requireEnv } = require('../shared/env');
loadEnv();
requireEnv(['MONGODB_URI', 'JWT_SECRET', 'FILE_ENCRYPTION_KEY', 'INTERNAL_API_KEY']);

const root = path.join(__dirname, '..');
const procs = [
  ['auth-service', 'services/auth-service/server.js'],
  ['audit-service', 'services/audit-service/server.js'],
  ['permission-service', 'services/permission-service/server.js'],
  ['file-service', 'services/file-service/server.js'],
  ['gateway', 'gateway/server.js']
];

const children = [];
function run(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  child.stdout.on('data', (d) => process.stdout.write(String(d).split('\n').filter(Boolean).map((l) => `[${name}] ${l}\n`).join('')));
  child.stderr.on('data', (d) => process.stderr.write(String(d).split('\n').filter(Boolean).map((l) => `[${name}] ${l}\n`).join('')));
  child.on('exit', (code) => { if (code) console.error(`[${name}] exited with code ${code}`); });
  children.push(child);
}

for (const [name, script] of procs) run(name, process.execPath, [script]);
if (process.argv.includes('--frontend')) run('frontend', 'npm', ['--prefix', 'frontend', 'run', 'dev'], { shell: true });

const stop = () => { children.forEach((c) => !c.killed && c.kill('SIGTERM')); setTimeout(() => process.exit(0), 300); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(`Encrypted File Transfer starting... gateway: http://localhost:${process.env.PORT || 4000}` +
  (process.argv.includes('--frontend') ? '  |  dev UI: http://localhost:5173' : ''));
