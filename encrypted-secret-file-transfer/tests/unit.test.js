// `npm run test:unit` - runs without MongoDB: encryption, storage path safety, validation.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
process.env.FILE_ENCRYPTION_KEY = 'unit-test-passphrase';

const c = require('../services/file-service/utils/crypto');
const storage = require('../services/file-service/utils/storage');

test('encrypt -> decrypt round trip', () => {
  const plain = Buffer.from('top secret \u2713 data');
  const { ciphertext, meta } = c.encryptBuffer(plain);
  assert.ok(!ciphertext.includes(plain));
  assert.deepStrictEqual(c.decryptBuffer(ciphertext, meta), plain);
});

test('every file gets a unique key and IV', () => {
  const a = c.encryptBuffer(Buffer.from('same')), b = c.encryptBuffer(Buffer.from('same'));
  assert.notStrictEqual(a.meta.wrappedKey, b.meta.wrappedKey);
  assert.notStrictEqual(a.meta.iv, b.meta.iv);
  assert.notDeepStrictEqual(a.ciphertext, b.ciphertext);
});

test('tampered ciphertext is rejected (GCM auth tag)', () => {
  const { ciphertext, meta } = c.encryptBuffer(Buffer.from('important'));
  ciphertext[0] ^= 0xff;
  assert.throws(() => c.decryptBuffer(ciphertext, meta));
});

test('wrong master key cannot decrypt', () => {
  const { ciphertext, meta } = c.encryptBuffer(Buffer.from('important'));
  process.env.FILE_ENCRYPTION_KEY = 'a-different-key'; c._resetKeyCache();
  assert.throws(() => c.decryptBuffer(ciphertext, meta));
  process.env.FILE_ENCRYPTION_KEY = 'unit-test-passphrase'; c._resetKeyCache();
});

test('64-hex master key is used raw', () => {
  process.env.FILE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); c._resetKeyCache();
  const { ciphertext, meta } = c.encryptBuffer(Buffer.from('x'));
  assert.strictEqual(c.decryptBuffer(ciphertext, meta).toString(), 'x');
  process.env.FILE_ENCRYPTION_KEY = 'unit-test-passphrase'; c._resetKeyCache();
});

test('storage rejects path traversal and non-generated names', () => {
  for (const bad of ['../../etc/passwd', '..\\x.enc', 'abc.enc', '/etc/passwd', 'a'.repeat(32) + '.enc/../x']) {
    assert.throws(() => storage.resolveStoredPath(bad), bad);
  }
  assert.ok(storage.resolveStoredPath(c.randomStoredName()).endsWith('.enc'));
});

test('validation helpers', () => {
  const v = require('../shared/validation');
  assert.ok(v.isEmail('a@b.co')); assert.ok(!v.isEmail('nope'));
  assert.ok(v.passwordProblem('short1')); assert.ok(v.passwordProblem('allletters')); assert.strictEqual(v.passwordProblem('Alice@123'), null);
  assert.strictEqual(v.safeFileName('../../etc/passwd'), 'passwd');
  assert.strictEqual(v.safeFileName('a<b>:c.txt'), 'a_b__c.txt');
});
