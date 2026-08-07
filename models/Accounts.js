const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false  // Never return password in queries unless explicitly selected with +password
  },
  image: {
    type: String,
    default: 'https://i.redd.it/1to4yvt3i88c1.png'
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    trim: true
  },
  dob: {
    type: Date
  },
  role: {
    type: String,
    enum: ['user', 'manager', 'admin'],
    default: 'user'
  },
  accountStatus: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  passkeys: [{
    credentialID: {
      type: String,
      required: true
    },
    credentialPublicKey: {
      type: String,
      required: true
    },
    counter: {
      type: Number,
      default: 0
    },
    deviceType: {
      type: String,
      default: 'unknown'
    },
    backedUp: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  googleId: {
    type: String,
    sparse: true
  },
  requireAuthForCheckout: {
    type: Boolean,
    default: false
  },
  preferences: {
    email: { type: Boolean, default: true },
    web: { type: Boolean, default: true },
  },
}, {
  timestamps: true
});

// Hash password before saving if it exists
accountSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password method
accountSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false; // No password set (e.g., Google login user)
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Accounts', accountSchema);

// ===== Indexes =====
// Note: username and email already have unique indexes from schema definition.
// These additional indexes optimize common filter + sort patterns.

// Login, OTP, password reset — lookup by email
accountSchema.index({ email: 1 });

// Admin dashboard — filter accounts by role
accountSchema.index({ role: 1 });

// Admin dashboard — filter by account status
accountSchema.index({ accountStatus: 1 });

// Soft-delete filter (isDeleted already has index: true in the schema field)
// Compound for listing active, non-deleted users
accountSchema.index({ isDeleted: 1, accountStatus: 1 });