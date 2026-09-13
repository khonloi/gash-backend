import { z } from 'zod';

export const updateAccountSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  name: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).nullable().optional(),
  dob: z.coerce.date().nullable().optional(), // Coerce string to Date
  role: z.enum(['user', 'manager', 'admin']).optional(),
  acc_status: z.enum(['active', 'inactive', 'suspended', 'deleted']).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(6, 'Old password must be at least 6 characters'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
