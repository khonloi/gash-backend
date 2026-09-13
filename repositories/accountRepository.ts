import Account, { IAccount } from '../models/Account.js';
import { FilterQuery, UpdateQuery } from 'mongoose';

export class AccountRepository {
  async findById(id: string, includePassword = false): Promise<IAccount | null> {
    let query = Account.findById(id);
    if (includePassword) {
      query = query.select('+password');
    } else {
      query = query.select('-password -refreshTokens');
    }
    return query.exec();
  }

  async findByEmailOrUsername(email: string, username: string): Promise<IAccount | null> {
    return Account.findOne({
      $or: [{ username }, { email }],
    }).exec();
  }

  async findForAuth(identifier: string): Promise<IAccount | null> {
    return Account.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }]
    }).select('+password +refreshTokens +failedLoginAttempts +lockUntil').exec();
  }

  async findByEmail(email: string): Promise<IAccount | null> {
    return Account.findOne({ email }).select('+password +refreshTokens').exec();
  }

  async find(filter: FilterQuery<IAccount> = {}): Promise<IAccount[]> {
    return Account.find(filter).select('-password -refreshTokens').sort({ username: 1 }).exec();
  }

  async create(data: Partial<IAccount>): Promise<IAccount> {
    const account = new Account(data);
    return account.save();
  }

  async updateById(id: string, updateData: UpdateQuery<IAccount>): Promise<IAccount | null> {
    return Account.findByIdAndUpdate(id, updateData, { new: true }).select('-password -refreshTokens').exec();
  }

  async pushRefreshToken(id: string, token: string): Promise<IAccount | null> {
    return Account.findByIdAndUpdate(id, { $push: { refreshTokens: token } }, { new: true }).exec();
  }

  async clearRefreshTokens(id: string): Promise<IAccount | null> {
    return Account.findByIdAndUpdate(id, { refreshTokens: [] }, { new: true }).exec();
  }

  async incrementFailedLogins(account: IAccount, maxAttempts: number, lockTimeMs: number): Promise<IAccount> {
    account.failedLoginAttempts += 1;
    if (account.failedLoginAttempts >= maxAttempts) {
      account.lockUntil = new Date(Date.now() + lockTimeMs);
    }
    return account.save();
  }

  async resetFailedLogins(account: IAccount): Promise<IAccount> {
    account.failedLoginAttempts = 0;
    account.lockUntil = undefined;
    return account.save();
  }

  async softDelete(id: string): Promise<IAccount | null> {
    return Account.findByIdAndUpdate(id, { 
      is_deleted: true, 
      role: 'user', 
      acc_status: 'deleted',
      refreshTokens: []
    }, { new: true }).exec();
  }
}

export default new AccountRepository();
