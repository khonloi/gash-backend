const Joi = require('joi');

const createVariantSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid product ID format',
    'any.required': 'Product ID is required'
  }),
  productColorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid product color ID format',
    'any.required': 'Product color ID is required'
  }),
  productSizeId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid product size ID format',
    'any.required': 'Product size ID is required'
  }),
  variantImage: Joi.string().uri().required().messages({
    'string.uri': 'Variant image must be a valid URI',
    'any.required': 'Variant image is required'
  }),
  variantPrice: Joi.number().min(0).required().messages({
    'number.min': 'Variant price cannot be negative',
    'any.required': 'Variant price is required'
  }),
  stockQuantity: Joi.number().integer().min(0).required().messages({
    'number.min': 'Stock quantity cannot be negative',
    'any.required': 'Stock quantity is required'
  })
});

const updateVariantSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  productColorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  productSizeId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  variantImage: Joi.string().uri().optional(),
  variantPrice: Joi.number().min(0).optional(),
  stockQuantity: Joi.number().integer().min(0).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const bulkCreateVariantSchema = Joi.object({
  productId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  productColorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  variantImage: Joi.string().uri().required(),
  variantPrice: Joi.number().min(0).required(),
  stockQuantity: Joi.number().integer().min(0).required(),
  sizeIds: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).required().messages({
    'array.min': 'At least one size ID must be provided',
    'any.required': 'Size IDs array is required'
  })
});

module.exports = {
  createVariantSchema,
  updateVariantSchema,
  bulkCreateVariantSchema
};
