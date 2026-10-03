// `npm run check`: syntax-checks every backend/script/test file.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const skip = new Set(['node_modules', 'frontend', '.git', 'uploads', 'docs', 'postman']);
let failures = 0, count = 0;

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.js')) {
      count++;
      const r = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      if (r.status !== 0) { failures++; console.error(`FAIL ${path.relative(root, full)}\n${r.stderr}`); }
    }
  }
})(root);

console.log(failures ? `${failures} file(s) failed` : `OK - ${count} files passed syntax check`);
process.exit(failures ? 1 : 0);
