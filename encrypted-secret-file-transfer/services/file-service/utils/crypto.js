// File encryption using Node's built-in crypto: AES-256-GCM with ENVELOPE encryption.
//
//   1. A fresh random 256-bit Data Encryption Key (DEK) is created for every file.
//   2. The file is encrypted with the DEK (AES-256-GCM, random 96-bit IV, 128-bit auth tag).
//   3. The DEK is itself encrypted ("wrapped") with the server master key (FILE_ENCRYPTION_KEY).
//   4. Only the ciphertext goes to disk; the wrapped DEK + IVs + tags go to MongoDB.
//
// Without the master key (kept in the environment, never in the DB or the frontend) neither
// the disk nor the database alone can reveal a file. GCM also detects any tampering.
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
let cachedMaster = null;

function getMasterKey() {
  if (cachedMaster) return cachedMaster;
  const raw = process.env.FILE_ENCRYPTION_KEY;
  if (!raw) throw new Error('FILE_ENCRYPTION_KEY is not set');
  cachedMaster = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')                                    // raw 256-bit key
    : crypto.scryptSync(raw, 'efts-master-key-salt-v1', 32);     // derived from a passphrase
  return cachedMaster;
}

function gcmEncrypt(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, data, tag: cipher.getAuthTag() };
}

function gcmDecrypt(key, iv, tag, data) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]); // final() throws if tampered
}

// Returns { ciphertext, meta } - meta is safe to store in MongoDB (useless without the master key).
function encryptBuffer(plaintext) {
  const dek = crypto.randomBytes(32);
  const file = gcmEncrypt(dek, plaintext);
  const wrapped = gcmEncrypt(getMasterKey(), dek);
  dek.fill(0);
  return {
    ciphertext: file.data,
    meta: {
      algorithm: 'aes-256-gcm',
      keyVersion: 1,
      iv: file.iv.toString('base64'),
      authTag: file.tag.toString('base64'),
      wrappedKey: wrapped.data.toString('base64'),
      wrapIv: wrapped.iv.toString('base64'),
      wrapTag: wrapped.tag.toString('base64')
    }
  };
}

function decryptBuffer(ciphertext, meta) {
  const b = (s) => Buffer.from(s, 'base64');
  const dek = gcmDecrypt(getMasterKey(), b(meta.wrapIv), b(meta.wrapTag), b(meta.wrappedKey));
  try {
    return gcmDecrypt(dek, b(meta.iv), b(meta.authTag), ciphertext);
  } finally {
    dek.fill(0);
  }
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const randomStoredName = () => `${crypto.randomBytes(16).toString('hex')}.enc`;

module.exports = { encryptBuffer, decryptBuffer, sha256, randomStoredName, _resetKeyCache: () => { cachedMaster = null; } };
