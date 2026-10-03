const mongoose = require('mongoose');
const { PERMISSION_LEVELS } = require('../../../shared/constants');

const permissionSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  fileName: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: String,
  userName: String,
  level: { type: String, enum: PERMISSION_LEVELS, default: 'download' },
  // Revoking keeps the document (status 'revoked') so the history stays visible in MongoDB Compass.
  status: { type: String, enum: ['active', 'revoked'], default: 'active' },
  revokedAt: Date
}, { timestamps: true, collection: 'permissions' });

permissionSchema.index({ fileId: 1, userId: 1 }, { unique: true }); // one row per (file, recipient)
permissionSchema.index({ fileId: 1 });
permissionSchema.index({ userId: 1, status: 1 });

permissionSchema.set('toJSON', {
  transform: (doc, ret) => { ret.id = String(ret._id); delete ret._id; delete ret.__v; return ret; }
});

module.exports = mongoose.models.Permission || mongoose.model('Permission', permissionSchema);
