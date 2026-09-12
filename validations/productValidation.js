const Joi = require('joi');

const imageSchema = Joi.object({
  _id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  imageUrl: Joi.string().uri().required().messages({
    'string.uri': 'Image URL must be a valid URI',
    'any.required': 'Image URL is required'
  }),
  isMain: Joi.boolean().default(false)
});

const createProductSchema = Joi.object({
  productName: Joi.string().min(3).max(100).pattern(/^[a-zA-ZÀ-ỹ0-9\s\-]+$/).required().messages({
    'string.pattern.base': 'Product name must contain only letters, numbers, spaces, and hyphens',
    'string.min': 'Product name must be at least 3 characters long',
    'string.max': 'Product name cannot exceed 100 characters',
    'any.required': 'Product name is required'
  }),
  categoryId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid category ID format',
    'any.required': 'Category ID is required'
  }),
  description: Joi.string().min(50).max(10000).required().messages({
    'string.min': 'Description must be at least 50 characters long',
    'string.max': 'Description cannot exceed 10000 characters',
    'any.required': 'Description is required'
  }),
  productStatus: Joi.string().valid('active', 'inactive', 'pending').optional(),
  productImageIds: Joi.array().items(imageSchema).min(1).required().custom((value, helpers) => {
    const mainImages = value.filter(img => img.isMain);
    if (mainImages.length !== 1) {
      return helpers.message('Exactly one product image must have isMain set to true');
    }
    return value;
  }).messages({
    'array.min': 'At least one product image is required',
    'any.required': 'Product images are required'
  }),
  productVariantIds: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)).optional()
});

const updateProductSchema = Joi.object({
  productName: Joi.string().min(3).max(100).pattern(/^[a-zA-ZÀ-ỹ0-9\s\-]+$/).optional().messages({
    'string.pattern.base': 'Product name must contain only letters, numbers, spaces, and hyphens'
  }),
  categoryId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  description: Joi.string().min(50).max(10000).optional(),
  productStatus: Joi.string().valid('active', 'inactive', 'pending').optional(),
  productImageIds: Joi.array().items(imageSchema).min(1).optional().custom((value, helpers) => {
    const mainImages = value.filter(img => img.isMain);
    if (mainImages.length !== 1) {
      return helpers.message('Exactly one product image must have isMain set to true');
    }
    return value;
  }),
  productVariantIds: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const addProductImageSchema = imageSchema;

module.exports = {
  createProductSchema,
  updateProductSchema,
  addProductImageSchema
};
