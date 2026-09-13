import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = (message: string) => z.string().regex(objectIdRegex, message);

export const createVariantSchema = z.object({
  productId: objectIdSchema('Invalid product ID format'),
  productColorId: objectIdSchema('Invalid product color ID format'),
  productSizeId: objectIdSchema('Invalid product size ID format'),
  variantImage: z.string().url('Variant image must be a valid URL'),
  variantPrice: z.number().min(0, 'Variant price cannot be negative'),
  stockQuantity: z.number().int('Stock quantity must be an integer').min(0, 'Stock quantity cannot be negative'),
  variantStatus: z.enum(['active', 'inactive', 'discontinued']).optional(),
});

export const updateVariantSchema = z.object({
  productId: objectIdSchema('Invalid product ID format').optional(),
  productColorId: objectIdSchema('Invalid product color ID format').optional(),
  productSizeId: objectIdSchema('Invalid product size ID format').optional(),
  variantImage: z.string().url('Variant image must be a valid URL').optional(),
  variantPrice: z.number().min(0, 'Variant price cannot be negative').optional(),
  stockQuantity: z.number().int('Stock quantity must be an integer').min(0, 'Stock quantity cannot be negative').optional(),
  variantStatus: z.enum(['active', 'inactive', 'discontinued']).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const bulkCreateVariantSchema = z.object({
  productId: objectIdSchema('Invalid product ID format'),
  productColorId: objectIdSchema('Invalid product color ID format'),
  variantImage: z.string().url('Variant image must be a valid URL'),
  variantPrice: z.number().min(0, 'Variant price cannot be negative'),
  stockQuantity: z.number().int('Stock quantity must be an integer').min(0, 'Stock quantity cannot be negative'),
  sizeIds: z.array(objectIdSchema('Invalid product size ID format')).min(1, 'At least one size ID must be provided'),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type BulkCreateVariantInput = z.infer<typeof bulkCreateVariantSchema>;
