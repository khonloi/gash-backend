import { z } from 'zod';

export const createColorSchema = z.object({
  color_name: z.string()
    .min(2, 'Color name must be at least 2 characters')
    .max(30, 'Color name cannot exceed 30 characters'),
});

export const updateColorSchema = z.object({
  color_name: z.string()
    .min(2, 'Color name must be at least 2 characters')
    .max(30, 'Color name cannot exceed 30 characters')
    .optional(),
  isDeleted: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const createSizeSchema = z.object({
  size_name: z.string()
    .min(1, 'Size name must be at least 1 character')
    .max(12, 'Size name cannot exceed 12 characters'),
});

export const updateSizeSchema = z.object({
  size_name: z.string()
    .min(1, 'Size name must be at least 1 character')
    .max(12, 'Size name cannot exceed 12 characters')
    .optional(),
  isDeleted: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export type CreateColorInput = z.infer<typeof createColorSchema>;
export type UpdateColorInput = z.infer<typeof updateColorSchema>;
export type CreateSizeInput = z.infer<typeof createSizeSchema>;
export type UpdateSizeInput = z.infer<typeof updateSizeSchema>;
