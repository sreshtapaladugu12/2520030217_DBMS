const mongoose = require('mongoose');
const { ACTIONS } = require('../../../shared/constants');

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  userName: String,             // denormalised so logs stay readable even if the auth service is down
  userEmail: String,
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', index: true },
  fileName: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // file owner: lets owners see who touched their files
  action: { type: String, enum: ACTIONS, required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetEmail: String,
  status: { type: String, enum: ['success', 'denied', 'failed'], default: 'success' },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}, { collection: 'transfer_logs', versionKey: false });

logSchema.index({ timestamp: -1 });
logSchema.index({ action: 1, timestamp: -1 });

logSchema.set('toJSON', {
  transform: (doc, ret) => { ret.id = String(ret._id); delete ret._id; return ret; }
});

module.exports = mongoose.models.TransferLog || mongoose.model('TransferLog', logSchema);
