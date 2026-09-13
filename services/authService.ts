import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import accountRepository from "../repositories/accountRepository.js";
import { generateOTP, storeOTP, verifyStoredOTP } from "../utils/emailUtils.js";
import tempStore from "../utils/tempStore.js";
import { JWT_SECRET } from "../middleware/authMiddleware.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

const generateTokens = (account: any) => {
  const payload = {
    id: account._id,
    username: account.username,
    role: account.role,
  };
  const accessToken = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET as string, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
};

export class AuthService {
  async requestOtp(data: any) {
    const { email, purpose } = data;
    const existingAccount = await accountRepository.findByEmail(email);

    switch (purpose) {
      case "register":
        if (existingAccount) throw new Error("Email already registered");
        break;
      case "forgot-password":
        if (!existingAccount)
          throw new Error("No account found with this email");
        break;
      default:
        throw new Error("Invalid purpose");
    }

    const otp = generateOTP();
    const stored = storeOTP(email, otp);
    if (!stored) {
      throw new Error("Failed to store OTP");
    }
    return { message: "OTP generated successfully", otp }; // Remove 'otp' in production!
  }

  async verifyOtp(data: any) {
    const { email, otp, purpose, registrationData } = data;

    const isValidOTP = await verifyStoredOTP(email, otp);
    if (!isValidOTP) {
      throw new Error("Invalid or expired OTP");
    }

    switch (purpose) {
      case "register":
        // Store validated user data temporarily until they call register
        tempStore.setTempUser(email, registrationData);
        return { message: "OTP verified successfully. Proceed to register." };

      case "forgot-password": {
        const account = await accountRepository.findByEmail(email);
        if (!account) throw new Error("No account found with this email");

        const resetToken = jwt.sign(
          { id: account._id, email: account.email, purpose: "resetPassword" },
          JWT_SECRET as string,
          { expiresIn: "15m" },
        );
        return { message: "OTP verified successfully", resetToken };
      }

      default:
        throw new Error("Invalid purpose");
    }
  }

  async register(data: any) {
    const { email } = data;
    const tempUserData = tempStore.getTempUser(email);
    if (!tempUserData) {
      throw new Error(
        "Registration timeout or OTP not verified. Please request OTP again.",
      );
    }

    const { username, name, phone, address, password, image } = tempUserData;
    const existingAccount = await accountRepository.findByEmailOrUsername(
      email,
      username,
    );
    if (existingAccount) {
      throw new Error("Username or email already exists");
    }

    const savedAccount = await accountRepository.create({
      username,
      name,
      email,
      phone,
      address,
      password,
      image: image,
      role: "user",
      acc_status: "active",
      isEmailVerified: true,
    });

    tempStore.deleteTempUser(email);

    const { accessToken, refreshToken } = generateTokens(savedAccount);
    await accountRepository.pushRefreshToken(
      savedAccount._id.toString(),
      refreshToken,
    );

    return {
      message: "Registration successful",
      accessToken,
      refreshToken,
      account: {
        _id: savedAccount._id,
        username: savedAccount.username,
        name: savedAccount.name,
        email: savedAccount.email,
        role: savedAccount.role,
        acc_status: savedAccount.acc_status,
      },
    };
  }

  async login(data: any) {
    const { username, password } = data;

    const account = await accountRepository.findForAuth(username);
    if (!account) {
      throw new Error("Invalid username or password");
    }

    if (account.acc_status !== "active") {
      throw new Error("Account is inactive or suspended");
    }

    if (account.lockUntil && account.lockUntil.getTime() > Date.now()) {
      throw new Error("Account is locked. Please try again later.");
    }

    const isMatch = await account.comparePassword(password);

    if (!isMatch) {
      await accountRepository.incrementFailedLogins(
        account,
        MAX_LOGIN_ATTEMPTS,
        LOCK_TIME,
      );
      throw new Error("Invalid username or password");
    }

    // Successful login, reset attempts
    await accountRepository.resetFailedLogins(account);

    const { accessToken, refreshToken } = generateTokens(account);
    await accountRepository.pushRefreshToken(
      account._id.toString(),
      refreshToken,
    );

    return {
      message: "Login successful",
      accessToken,
      refreshToken,
      account: {
        _id: account._id,
        username: account.username,
        name: account.name,
        email: account.email,
        role: account.role,
        acc_status: account.acc_status,
      },
    };
  }

  async refreshAccessToken(data: any) {
    const { refreshToken } = data;
    if (!refreshToken) throw new Error("Refresh token is required");

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET as string);
    } catch (err) {
      throw new Error("Invalid or expired refresh token");
    }

    const accountWithTokens = await accountRepository.findForAuth(
      decoded.username,
    );

    if (
      !accountWithTokens ||
      !accountWithTokens.refreshTokens.includes(refreshToken)
    ) {
      throw new Error("Invalid refresh token");
    }

    if (accountWithTokens.acc_status !== "active") {
      throw new Error("Account is inactive or suspended");
    }

    const payload = {
      id: accountWithTokens._id,
      username: accountWithTokens.username,
      role: accountWithTokens.role,
    };
    const newAccessToken = jwt.sign(payload, JWT_SECRET as string, {
      expiresIn: "15m",
    });

    return { accessToken: newAccessToken };
  }

  async googleLogin(data: any) {
    const { token } = data;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google token");

    const { email, name, picture, sub: googleId } = payload;
    let account = await accountRepository.findByEmail(email!);

    if (!account) {
      const username = email!.split("@")[0];
      const randomPassword = crypto.randomBytes(24).toString("base64");
      account = await accountRepository.create({
        username,
        name: name || username,
        email: email!,
        image: picture,
        googleId,
        password: randomPassword,
        role: "user",
        acc_status: "active",
        isEmailVerified: true,
      });
    } else if (!account.googleId) {
      await accountRepository.updateById(account._id.toString(), {
        googleId,
        isEmailVerified: true,
      });
    }

    if (account.acc_status !== "active") {
      throw new Error("Account is inactive or suspended");
    }

    const { accessToken, refreshToken } = generateTokens(account);
    await accountRepository.pushRefreshToken(
      account._id.toString(),
      refreshToken,
    );

    return {
      message: "Google login successful",
      accessToken,
      refreshToken,
      account: {
        _id: account._id,
        username: account.username,
        name: account.name,
        email: account.email,
        role: account.role,
        acc_status: account.acc_status,
      },
    };
  }

  async resetPassword(data: any) {
    const { resetToken, newPassword } = data;
    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET as string);
      if (decoded.purpose !== "resetPassword")
        throw new Error("Invalid token purpose");
    } catch (err) {
      throw new Error("Invalid or expired reset token");
    }

    const account = await accountRepository.findById(decoded.id, true);
    if (!account) {
      throw new Error("Account not found");
    }

    account.password = newPassword;
    account.refreshTokens = [];
    await account.save();

    return {
      message:
        "Password reset successfully. All existing sessions have been invalidated.",
    };
  }
}

export default new AuthService();
