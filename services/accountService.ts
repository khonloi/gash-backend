import accountRepository from "../repositories/accountRepository.js";
import { UpdateAccountInput } from "../validations/accountValidation.js";
// We also need Order model to get statistics, but for now we'll import it standardly or create a simple repo
import Order from "../models/Order.js";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AccountService {
  async createAccount(data: any) {
    const {
      username,
      name,
      email,
      phone,
      address,
      password,
      image,
      gender,
      dob,
      role,
    } = data;

    const existing = await accountRepository.findByEmailOrUsername(
      email,
      username,
    );
    if (existing) {
      throw new AppError("Username or email already exists", 400);
    }

    const account = await accountRepository.create({
      username,
      name,
      email,
      phone,
      address,
      password,
      image,
      gender,
      dob,
      role: role || "user",
      acc_status: "active",
      isEmailVerified: true,
    });

    const accountObj = account.toObject();
    delete accountObj.password;
    delete accountObj.refreshTokens;
    return accountObj;
  }

  async getAllAccounts() {
    return accountRepository.find();
  }

  async getAccountById(id: string, currentUser: any) {
    if (currentUser.role !== "admin" && currentUser.id !== id) {
      throw new AppError("Access denied: Can only view own account", 403);
    }
    const account = await accountRepository.findById(id);
    if (!account) throw new AppError("Account not found", 404);
    return account;
  }

  async updateAccount(id: string, data: UpdateAccountInput, currentUser: any) {
    if (currentUser.role !== "admin" && currentUser.id !== id) {
      throw new AppError("Access denied: Can only update own account", 403);
    }
    const account = await accountRepository.findById(id);
    if (!account) throw new AppError("Account not found", 404);
    if (account.is_deleted)
      throw new AppError("Cannot update a deleted account", 400);

    if (data.username || data.email) {
      // Check for conflicts
      const existing = await accountRepository.findByEmailOrUsername(
        data.email || "",
        data.username || "",
      );
      if (existing && existing._id.toString() !== id) {
        throw new AppError("Username or email already exists", 400);
      }
    }

    return accountRepository.updateById(id, data);
  }

  async updatePassword(
    id: string,
    oldPass: string,
    newPass: string,
    currentUser: any,
  ) {
    if (currentUser.role !== "admin" && currentUser.id !== id) {
      throw new AppError("Access denied: Can only update own password", 403);
    }
    const account = await accountRepository.findById(id, true);
    if (!account) throw new AppError("Account not found", 404);
    if (account.is_deleted)
      throw new AppError("Cannot update a deleted account", 400);

    if (currentUser.role !== "admin") {
      const isMatch = await account.comparePassword(oldPass);
      if (!isMatch) throw new AppError("Old password is incorrect", 400);
    }

    account.password = newPass;
    account.refreshTokens = [];
    await account.save();
    return true;
  }

  async softDeleteAccount(id: string, currentUser: any) {
    if (currentUser.role !== "admin" && currentUser.id !== id) {
      throw new AppError(
        "Access denied: Can only soft delete own account",
        403,
      );
    }
    const account = await accountRepository.findById(id);
    if (!account) throw new AppError("Account not found", 404);
    if (account.is_deleted)
      throw new AppError("Account is already soft-deleted", 400);

    await accountRepository.softDelete(id);
    return true;
  }

  async getAccountOrderStatistics(id: string, currentUser: any) {
    if (
      currentUser.role !== "admin" &&
      currentUser.role !== "manager" &&
      currentUser.id !== id
    ) {
      throw new AppError(
        "Access denied: Can only view own order statistics",
        403,
      );
    }

    // Fallback to Mongoose Order model directly for stats
    const orders = await Order.find({ acc_id: id })
      .select("order_status finalPrice totalPrice")
      .exec();
    const totalOrders = orders.length;
    const totalSpent = orders.reduce(
      (sum: number, order: any) =>
        sum + (order.finalPrice || order.totalPrice || 0),
      0,
    );
    const activeOrders = orders.filter((order: any) =>
      ["pending", "confirmed", "shipping"].includes(order.order_status),
    ).length;

    return { totalOrders, totalSpent, activeOrders };
  }
}

export default new AccountService();
