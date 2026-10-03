// Generates postman/EncryptedFileTransfer.postman_collection.json  (node scripts/make-postman.js)
const fs = require('fs');
const path = require('path');

const url = (p) => ({ raw: `{{baseUrl}}${p}`, host: ['{{baseUrl}}'], path: p.split('?')[0].split('/').filter(Boolean), query: (p.split('?')[1] || '').split('&').filter(Boolean).map((kv) => ({ key: kv.split('=')[0], value: kv.split('=')[1] })) });
const test = (lines) => [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];
const req = (name, method, p, { token, body, form, tests } = {}) => ({
  name,
  event: tests ? test(tests) : undefined,
  request: {
    method,
    header: [...(token ? [{ key: 'Authorization', value: `Bearer {{${token}}}` }] : []), ...(body ? [{ key: 'Content-Type', value: 'application/json' }] : [])],
    body: body ? { mode: 'raw', raw: JSON.stringify(body, null, 2) } : form ? { mode: 'formdata', formdata: form } : undefined,
    url: url(p)
  }
});
const login = (who, email, pw, v) => req(`Login ${who}`, 'POST', '/api/auth/login', { body: { email, password: pw }, tests: [`pm.test('200', () => pm.response.to.have.status(200));`, `pm.collectionVariables.set('${v}', pm.response.json().token);`] });

const collection = {
  info: { name: 'Encrypted Secret File Transfer', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run folders in order: 1 Auth -> 2 Files -> 3 Permissions -> 4 Logs & Admin. Requires `npm run reset:data` first.' },
  variable: [{ key: 'baseUrl', value: 'http://localhost:4000' }, { key: 'tokenAlice', value: '' }, { key: 'tokenBob', value: '' }, { key: 'tokenAdmin', value: '' }, { key: 'fileId', value: '' }, { key: 'permissionId', value: '' }],
  item: [
    { name: '0 Gateway', item: [req('Health', 'GET', '/api/health'), req('Service status', 'GET', '/api/service-status')] },
    { name: '1 Auth', item: [
      req('Register (new user)', 'POST', '/api/auth/register', { body: { name: 'Carol Test', email: 'carol{{$timestamp}}@example.com', password: 'Carol@123' }, tests: [`pm.test('201', () => pm.response.to.have.status(201));`] }),
      login('Alice', 'alice@example.com', 'Alice@123', 'tokenAlice'),
      login('Bob', 'bob@example.com', 'Bob@123', 'tokenBob'),
      login('Admin', 'admin@example.com', 'Admin@123', 'tokenAdmin'),
      req('Login wrong password (401)', 'POST', '/api/auth/login', { body: { email: 'alice@example.com', password: 'nope12345' }, tests: [`pm.test('401', () => pm.response.to.have.status(401));`] }),
      req('Me (Alice)', 'GET', '/api/auth/me', { token: 'tokenAlice' }),
      req('Me without token (401)', 'GET', '/api/auth/me', { tests: [`pm.test('401', () => pm.response.to.have.status(401));`] })
    ] },
    { name: '2 Files', item: [
      req('Upload (Alice) - pick any .txt in the body', 'POST', '/api/files/upload', { token: 'tokenAlice', form: [{ key: 'file', type: 'file', src: [] }], tests: [`pm.test('201', () => pm.response.to.have.status(201));`, `pm.collectionVariables.set('fileId', pm.response.json().file.id);`] }),
      req('List (Alice)', 'GET', '/api/files?scope=all', { token: 'tokenAlice' }),
      req('Details (Alice)', 'GET', '/api/files/{{fileId}}', { token: 'tokenAlice' }),
      req('Download BEFORE share (Bob) -> 403', 'GET', '/api/files/{{fileId}}/download', { token: 'tokenBob', tests: [`pm.test('403', () => pm.response.to.have.status(403));`] })
    ] },
    { name: '3 Permissions', item: [
      req('Share with Bob (Alice)', 'POST', '/api/permissions', { token: 'tokenAlice', body: { fileId: '{{fileId}}', email: 'bob@example.com' }, tests: [`pm.test('201', () => pm.response.to.have.status(201));`, `pm.collectionVariables.set('permissionId', pm.response.json().permission.id);`] }),
      req('List permissions (Alice)', 'GET', '/api/permissions/{{fileId}}', { token: 'tokenAlice' }),
      req('Bob sees shared file', 'GET', '/api/files?scope=shared', { token: 'tokenBob' }),
      req('Download (Bob) -> 200 decrypted', 'GET', '/api/files/{{fileId}}/download', { token: 'tokenBob', tests: [`pm.test('200', () => pm.response.to.have.status(200));`] }),
      req('Revoke (Alice)', 'DELETE', '/api/permissions/{{permissionId}}', { token: 'tokenAlice', tests: [`pm.test('200', () => pm.response.to.have.status(200));`] }),
      req('Download after revoke (Bob) -> 403', 'GET', '/api/files/{{fileId}}/download', { token: 'tokenBob', tests: [`pm.test('403', () => pm.response.to.have.status(403));`] })
    ] },
    { name: '4 Logs & Admin', item: [
      req('My logs (Alice)', 'GET', '/api/logs?limit=50', { token: 'tokenAlice' }),
      req('Admin stats', 'GET', '/api/admin/stats', { token: 'tokenAdmin' }),
      req('Admin users', 'GET', '/api/admin/users', { token: 'tokenAdmin' }),
      req('Admin logs', 'GET', '/api/admin/logs', { token: 'tokenAdmin' }),
      req('Admin stats as normal user -> 403', 'GET', '/api/admin/stats', { token: 'tokenBob', tests: [`pm.test('403', () => pm.response.to.have.status(403));`] }),
      req('Dashboard overview (Alice)', 'GET', '/api/overview', { token: 'tokenAlice' }),
      req('Delete file (Alice)', 'DELETE', '/api/files/{{fileId}}', { token: 'tokenAlice' })
    ] }
  ]
};
const out = path.join(__dirname, '..', 'postman', 'EncryptedFileTransfer.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log('wrote', out);
