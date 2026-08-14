const mongoose = require('mongoose');

const OrdersSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accounts',
      required: [true, 'Account ID is required'],
    },

    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vouchers',
      default: null,
    },

    orderDate: {
      type: Date,
      default: Date.now,
      required: [true, 'Order date is required'],
    },

    addressReceive: {
      type: String,
      required: [true, 'Address to receive is required'],
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
    },

    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price must be >= 0'],
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount must be >= 0'],
    },

    finalPrice: {
      type: Number,
      required: [true, 'Final price is required'],
      min: [0, 'Final price must be >= 0'],
    },

    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
      default: 'pending',
    },

    payStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },

    paymentMethod: {
      type: String,
      enum: ['COD', 'VNPAY'],
      required: [true, 'Payment method is required'],
    },

    refundStatus: {
      type: String,
      enum: ['not_applicable', 'pending_refund', 'refunded'],
      default: 'not_applicable',
    },

    refundProof: {
      type: String,
      default: '',
    },

    cancelReason: {
          type: String,
          default: '',
          maxlength: [500, 'Cancel reason cannot exceed 500 characters'],
          required: [
            function () {
              return this.orderStatus === 'cancelled';
            },
            'Cancel reason is required when order is cancelled',
          ],
        },

    // VNPay payment tracking
    vnpay_payment_url: {
      type: String,
      default: '',
    },

    vnpay_expiry_time: {
      type: Date,
      default: null,
    },

    orderDetails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderDetails',
      },
    ],
  },
  { timestamps: true }
);

// ===== Indexes =====
// Per-user order list, sorted by newest first (getUserOrders, order history page)
OrdersSchema.index({ accountId: 1, orderDate: -1 });

// Admin dashboard filters by order status
OrdersSchema.index({ orderStatus: 1 });

// Admin/reporting filters by payment status
OrdersSchema.index({ payStatus: 1 });

// VNPay expiry checker — queries unpaid VNPAY orders with a set expiry time
OrdersSchema.index({ paymentMethod: 1, payStatus: 1, vnpay_expiry_time: 1 });

// Compound for common admin list: all orders sorted by date
OrdersSchema.index({ orderDate: -1 });

module.exports = mongoose.model('Orders', OrdersSchema);