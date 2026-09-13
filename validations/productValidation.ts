import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid Object ID format');

const imageSchema = z.object({
  _id: objectIdSchema.optional(),
  imageUrl: z.string().url('Image URL must be a valid URL'),
  isMain: z.boolean().default(false),
});

export const createProductSchema = z.object({
  productName: z.string()
    .min(3, 'Product name must be at least 3 characters long')
    .max(100, 'Product name cannot exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ỹ0-9\s\-]+$/, 'Product name must contain only letters, numbers, spaces, and hyphens'),
  categoryId: objectIdSchema,
  description: z.string()
    .min(50, 'Description must be at least 50 characters long')
    .max(10000, 'Description cannot exceed 10000 characters'),
  productStatus: z.enum(['active', 'inactive', 'pending']).optional(),
  productImageIds: z.array(imageSchema).min(1, 'At least one product image is required')
    .refine((images) => {
      const mainImages = images.filter((img) => img.isMain);
      return mainImages.length === 1;
    }, { message: 'Exactly one product image must have isMain set to true' }),
  productVariantIds: z.array(objectIdSchema).optional(),
});

export const updateProductSchema = z.object({
  productName: z.string()
    .min(3, 'Product name must be at least 3 characters long')
    .max(100, 'Product name cannot exceed 100 characters')
    .regex(/^[a-zA-ZÀ-ỹ0-9\s\-]+$/, 'Product name must contain only letters, numbers, spaces, and hyphens')
    .optional(),
  categoryId: objectIdSchema.optional(),
  description: z.string()
    .min(50, 'Description must be at least 50 characters long')
    .max(10000, 'Description cannot exceed 10000 characters')
    .optional(),
  productStatus: z.enum(['active', 'inactive', 'pending']).optional(),
  productImageIds: z.array(imageSchema).min(1, 'At least one product image is required')
    .refine((images) => {
      const mainImages = images.filter((img) => img.isMain);
      return mainImages.length === 1;
    }, { message: 'Exactly one product image must have isMain set to true' })
    .optional(),
  productVariantIds: z.array(objectIdSchema).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

export const addProductImageSchema = imageSchema;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AddProductImageInput = z.infer<typeof addProductImageSchema>;
