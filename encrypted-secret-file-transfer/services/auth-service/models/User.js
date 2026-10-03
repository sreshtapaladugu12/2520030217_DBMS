const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false }, // bcrypt hash only, never the password
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date }
}, { timestamps: true, collection: 'users' });

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id; delete ret.__v; delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
