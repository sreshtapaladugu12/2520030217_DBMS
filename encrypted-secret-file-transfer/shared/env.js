// Tiny .env loader (no dotenv dependency) + startup validation.
const fs = require('fs');
const path = require('path');

const PLACEHOLDER = /change_this/i;

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue; // blank lines and comments
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// Fail fast if required variables are missing (or still placeholders in production).
function requireEnv(names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill them in.');
    process.exit(1);
  }
  const weak = names.filter((n) => /SECRET|KEY/.test(n) && PLACEHOLDER.test(process.env[n]));
  if (weak.length) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`Refusing to start in production with placeholder secrets: ${weak.join(', ')}`);
      process.exit(1);
    }
    console.warn(`[warn] Placeholder secrets in use (${weak.join(', ')}). Fine for a demo, change them otherwise.`);
  }
}

module.exports = { loadEnv, requireEnv };
