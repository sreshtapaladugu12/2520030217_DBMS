// `npm run reset:data`: wipes the 4 collections + encrypted storage, then seeds demo data.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { loadEnv, requireEnv } = require('../shared/env');
loadEnv();
requireEnv(['MONGODB_URI', 'FILE_ENCRYPTION_KEY']);

const User = require('../services/auth-service/models/User');
const File = require('../services/file-service/models/File');
const Permission = require('../services/permission-service/models/Permission');
const TransferLog = require('../services/audit-service/models/TransferLog');
const { encryptBuffer, sha256, randomStoredName } = require('../services/file-service/utils/crypto');
const storage = require('../services/file-service/utils/storage');

const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@example.com', password: 'Admin@123', role: 'admin' },
  { name: 'Alice Johnson', email: 'alice@example.com', password: 'Alice@123', role: 'user' },
  { name: 'Bob Smith', email: 'bob@example.com', password: 'Bob@123', role: 'user' }
];

async function addFile(owner, name, mime, text) {
  const plain = Buffer.from(text, 'utf8');
  const enc = encryptBuffer(plain);
  const storedName = randomStoredName();
  await storage.writeEncrypted(storedName, enc.ciphertext);
  return File.create({
    originalName: name, storedName, ownerId: owner._id, ownerName: owner.name, ownerEmail: owner.email, mimeType: mime,
    size: plain.length, encryptedSize: enc.ciphertext.length, sha256: sha256(plain), storagePath: storedName, encryption: enc.meta
  });
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User, File, Permission, TransferLog].map((m) => m.deleteMany({})));
  await Promise.all([User, File, Permission, TransferLog].map((m) => m.syncIndexes()));

  const dir = storage.ensureStorage();
  for (const f of fs.readdirSync(dir)) if (/\.enc(\.tmp)?$/.test(f)) fs.unlinkSync(path.join(dir, f));

  const users = {};
  for (const u of DEMO_USERS) {
    users[u.role === 'admin' ? 'admin' : u.name.split(' ')[0].toLowerCase()] =
      await User.create({ name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) });
  }
  const { alice, bob, admin } = users;

  const secret = await addFile(alice, 'demo-secret.txt', 'text/plain', 'TOP SECRET: launch code is 4-8-15-16-23-42.\nThis text is stored ONLY in encrypted form.\n');
  await addFile(alice, 'project-notes.md', 'text/markdown', '# Private notes\nOnly Alice can read this unless she shares it.\n');
  await Permission.create({ fileId: secret._id, fileName: secret.originalName, ownerId: alice._id, userId: bob._id, userEmail: bob.email, userName: bob.name, level: 'download' });

  const t = (minsAgo) => new Date(Date.now() - minsAgo * 60000);
  const who = (u) => ({ userId: u._id, userName: u.name, userEmail: u.email });
  await TransferLog.insertMany([
    { ...who(admin), action: 'REGISTER', timestamp: t(60) }, { ...who(alice), action: 'REGISTER', timestamp: t(58) }, { ...who(bob), action: 'REGISTER', timestamp: t(57) },
    { ...who(alice), action: 'UPLOAD', fileId: secret._id, fileName: secret.originalName, ownerId: alice._id, timestamp: t(40) },
    { ...who(alice), action: 'SHARE', fileId: secret._id, fileName: secret.originalName, ownerId: alice._id, targetUserId: bob._id, targetEmail: bob.email, timestamp: t(35) },
    { ...who(bob), action: 'DOWNLOAD', fileId: secret._id, fileName: secret.originalName, ownerId: alice._id, timestamp: t(30) }
  ]);

  console.log('Demo data ready. Collections: users(3) files(2) permissions(1) transfer_logs(6)');
  console.log('Accounts: admin@example.com / Admin@123, alice@example.com / Alice@123, bob@example.com / Bob@123');
  await mongoose.disconnect();
})().catch((e) => { console.error('Reset failed:', e.message); process.exit(1); });
