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
  feedback_details: {
    type: String,
    maxlength: [500, 'Feedback cannot exceed 500 characters'],
  },
  // soft delete flag for product feedback
  is_deleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('OrderDetails', OrderDetailsSchema);