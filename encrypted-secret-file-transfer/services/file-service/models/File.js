const mongoose = require('mongoose');

// Metadata only. The encrypted bytes live on disk; this holds what is needed to decrypt them
// (wrapped key, IV, tags) - useless without the server master key.
const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true, maxlength: 150 },
  storedName: { type: String, required: true, unique: true },   // random hex + .enc, never the user's filename
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerName: String,
  ownerEmail: String,
  mimeType: { type: String, default: 'application/octet-stream' },
  size: { type: Number, required: true },           // plaintext size in bytes
  encryptedSize: { type: Number, required: true },
  sha256: { type: String, required: true },         // hash of plaintext, checked after decryption
  storagePath: { type: String, required: true },    // relative to the protected storage dir
  encryption: {
    algorithm: String, keyVersion: Number, iv: String, authTag: String,
    wrappedKey: String, wrapIv: String, wrapTag: String
  }
}, { timestamps: true, collection: 'files' });

fileSchema.index({ ownerId: 1, createdAt: -1 });

// Public view: NEVER includes storedName, storagePath, or key material.
fileSchema.methods.toPublic = function () {
  return {
    id: String(this._id),
    originalName: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    encryptedSize: this.encryptedSize,
    sha256: this.sha256,
    ownerId: String(this.ownerId),
    ownerName: this.ownerName,
    ownerEmail: this.ownerEmail,
    encrypted: true,
    encryption: { algorithm: this.encryption && this.encryption.algorithm, keyVersion: this.encryption && this.encryption.keyVersion },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.models.File || mongoose.model('File', fileSchema);
