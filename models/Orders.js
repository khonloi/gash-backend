const mongoose = require('mongoose');

const OrdersSchema = new mongoose.Schema({
  acc_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accounts',
    required: [true, 'Account ID is required'],
  },
  orderDate: {
    type: Date,
    required: [true, 'Order date is required'],
    default: Date.now,
  },
  addressReceive: {
    type: String,
    required: [true, 'Address is required'],
    maxlength: [100, 'Address cannot exceed 100 characters'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\d{10}$/, 'Phone number must be exactly 10 digits'],
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative'],
  },
  order_status: {
    type: String,
    required: [true, 'Order status is required'],
    enum: {
      values: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      message: 'Order status must be pending, confirmed, shipped, delivered, or cancelled',
    },
    default: 'pending',
  },
  pay_status: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: {
      values: ['unpaid', 'paid', 'failed'],
      message: 'Payment status must be unpaid, paid, or failed',
    },
    default: 'unpaid',
  },
  shipping_status: {
    type: String,
    required: [true, 'Shipping status is required'],
    enum: {
      values: ['not_shipped', 'in_transit', 'delivered'],
      message: 'Shipping status must be not_shipped, in_transit, or delivered',
    },
    default: 'not_shipped',
  },
  feedback_order: {
    type: String,
    maxlength: [500, 'Feedback cannot exceed 500 characters'],
  },
});

// Pre-save hook to automatically set order_status to 'cancelled' when pay_status is 'failed'
OrdersSchema.pre('save', function(next) {
  if (this.pay_status === 'failed' && this.order_status !== 'cancelled') {
    this.order_status = 'cancelled';
  }
  next();
});

// Pre-findOneAndUpdate hook to automatically set order_status to 'cancelled' when pay_status is 'failed'
OrdersSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update && update.pay_status === 'failed' && (!update.order_status || update.order_status !== 'cancelled')) {
    update.order_status = 'cancelled';
  }
  next();
});

module.exports = mongoose.model('Orders', OrdersSchema);