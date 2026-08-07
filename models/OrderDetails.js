const mongoose = require('mongoose');

const OrderDetailsSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orders',
    required: [true, 'Order ID is required'],
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'newProductVariants',
    required: [true, 'Variant ID is required'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
  },
  Quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    content: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback cannot exceed 500 characters'],
      default: '',
    },
    createdAt: {
      type: Date,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
}, { timestamps: true });

// ===== Indexes =====
// Primary lookup: all details for a given order
OrderDetailsSchema.index({ orderId: 1 });

// Feedback queries: look up a specific item within an order
OrderDetailsSchema.index({ orderId: 1, variantId: 1 });

// Product feedback page: all reviews for a variant across all orders
OrderDetailsSchema.index({ variantId: 1 });

module.exports = mongoose.model('OrderDetails', OrderDetailsSchema);