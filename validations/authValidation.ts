import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional().or(z.literal('')),
  image: z.string().url().nullable().optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other']).nullable().optional().or(z.literal('')),
  dob: z.string().nullable().optional().or(z.literal(''))
});

export const loginSchema = z.object({
  username: z.string().min(1, { message: 'Username or email is required' }),
  password: z.string().min(1, { message: 'Password is required' })
});

export const requestOtpSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(['register', 'forgot-password'])
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  purpose: z.enum(['register', 'forgot-password']),
  registrationData: z.any().optional()
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, { message: 'Reset token is required' }),
  newPassword: z.string().min(6)
});

export const googleLoginSchema = z.object({
  token: z.string().min(1, { message: 'Token is required' })
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required' })
});
