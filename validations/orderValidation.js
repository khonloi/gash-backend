const Joi = require('joi');

const checkoutSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required',
  }),
  addressReceive: Joi.string().trim().required().messages({
    'string.empty': 'Address to receive is required',
    'any.required': 'Address to receive is required',
  }),
  phone: Joi.string().trim().pattern(/^[0-9]+$/).required().messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Phone number must contain only digits',
    'any.required': 'Phone number is required',
  }),
  totalPrice: Joi.number().min(0).required().messages({
    'number.min': 'Total price cannot be negative',
    'any.required': 'Total price is required',
  }),
  payment_method: Joi.string().valid('COD', 'VNPAY').required().messages({
    'any.only': 'Payment method must be either COD or VNPAY',
    'any.required': 'Payment method is required',
  }),
  voucherCode: Joi.string().trim().allow(null, '').optional(),
  items: Joi.array().items(
    Joi.object({
      variant_id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
        'string.pattern.base': 'Invalid variant ID',
        'any.required': 'Variant ID is required',
      }),
      UnitPrice: Joi.number().min(0).required().messages({
        'number.min': 'Unit price cannot be negative',
        'any.required': 'Unit price is required',
      }),
      Quantity: Joi.number().min(1).required().messages({
        'number.min': 'Quantity must be at least 1',
        'any.required': 'Quantity is required',
      }),
      feedback_details: Joi.string().max(500).allow('', null).optional().messages({
        'string.max': 'Feedback cannot exceed 500 characters'
      })
    })
  ).min(1).required().messages({
    'array.min': 'Order must have at least one item',
    'any.required': 'Items are required',
  })
});

const updateOrderSchema = Joi.object({
  order_status: Joi.string().valid('pending', 'confirmed', 'shipping', 'delivered', 'cancelled').optional().messages({
    'any.only': 'Invalid order status'
  }),
  pay_status: Joi.string().valid('unpaid', 'paid').optional().messages({
    'any.only': 'Invalid pay status'
  }),
  refund_status: Joi.string().valid('not_applicable', 'pending_refund', 'refunded').optional().messages({
    'any.only': 'Invalid refund status'
  }),
  refund_proof: Joi.string().allow('', null).optional(),
  cancelReason: Joi.string().max(500).allow('', null).optional().messages({
    'string.max': 'Cancel reason cannot exceed 500 characters'
  })
});

const cancelOrderSchema = Joi.object({
  cancelReason: Joi.string().max(500).allow('', null).optional().messages({
    'string.max': 'Cancel reason cannot exceed 500 characters'
  })
});

module.exports = {
  checkoutSchema,
  updateOrderSchema,
  cancelOrderSchema
};
