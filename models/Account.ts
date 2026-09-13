import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAccount extends Document {
  username: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  password?: string;
  image?: string;
  gender?: 'Male' | 'Female' | 'Other';
  dob?: Date;
  role: 'user' | 'manager' | 'admin';
  acc_status: 'active' | 'inactive' | 'suspended' | 'deleted';
  is_deleted: boolean;
  isEmailVerified: boolean;
  failedLoginAttempts: number;
  lockUntil?: Date;
  googleId?: string;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const accountSchema = new Schema<IAccount>({
  username: { type: String, required: true, unique: true, trim: true },
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  password: { type: String, required: true, select: false },
  image: { type: String, default: 'https://i.redd.it/1to4yvt3i88c1.png' },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true },
  dob: { type: Date },
  role: { type: String, enum: ['user', 'manager', 'admin'], default: 'user' },
  acc_status: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active' },
  is_deleted: { type: Boolean, default: false, index: true },
  isEmailVerified: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  googleId: { type: String },
  refreshTokens: [{ type: String }],
}, {
  timestamps: true
});

accountSchema.pre('save', async function (next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

accountSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const Account: Model<IAccount> = mongoose.model<IAccount>('Accounts', accountSchema);
export default Account;

// Ensure CommonJS interop for existing services/controllers
// @ts-ignore
module.exports = Account;
// @ts-ignore
module.exports.default = Account;

