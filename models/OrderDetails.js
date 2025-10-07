const mongoose = require('mongoose');

const OrderDetailsSchema = new mongoose.Schema({
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Orders',
    required: [true, 'Order ID is required'],
  },
  variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariants',
    required: [true, 'Variant ID is required'],
  },
  UnitPrice: {
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
    // Thời gian tạo feedback
    created_at: {
      type: Date,
      default: null,
    },
    // Thời gian cập nhật feedback
    updated_at: {
      type: Date,
      default: null,
    },
    // Soft delete flag chỉ cho feedback
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
});

module.exports = mongoose.model('OrderDetails', OrderDetailsSchema);