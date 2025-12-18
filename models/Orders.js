const mongoose = require('mongoose');

const OrdersSchema = new mongoose.Schema(
  {
    acc_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accounts',
      required: [true, 'Account ID is required'],
    },

    voucher_id: {
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

    order_status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
      default: 'pending',
    },

    pay_status: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },

    payment_method: {
      type: String,
      enum: ['COD', 'VNPAY'],
      required: [true, 'Payment method is required'],
    },

    refund_status: {
      type: String,
      enum: ['not_applicable', 'pending_refund', 'refunded'],
      default: 'not_applicable',
    },

    refund_proof: {
      type: String,
      default: '',
    },

    cancelReason: {
          type: String,
          default: '',
          maxlength: [500, 'Cancel reason cannot exceed 500 characters'],
          required: [
            function () {
              return this.order_status === 'cancelled';
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

module.exports = mongoose.model('Orders', OrdersSchema);