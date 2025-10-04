const mongoose = require('mongoose');

const OrdersSchema = new mongoose.Schema(
  {
    acc_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accounts',
      required: [true, 'Account ID is required'],
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
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
    },

    // voucher áp dụng (nếu có)
    voucher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      default: null,
    },

    // số tiền được giảm
    discountAmount: {
      type: Number,
      default: 0,
    },

    // tổng tiền sau khi giảm
    finalPrice: {
      type: Number,
      required: [true, 'Final price is required'],
    },

    // trạng thái đơn hàng
    order_status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
      default: 'pending',
    },

    // trạng thái thanh toán
    pay_status: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },

    // phương thức thanh toán
    payment_method: {
      type: String,
      enum: ['COD', 'VNPAY'],
      required: [true, 'Payment method is required'],
    },

    // trạng thái hoàn tiền
    refund_status: {
      type: String,
      enum: ['not_applicable', 'pending_refund', 'refunded'],
      default: 'not_applicable',
    },

    // bằng chứng hoàn tiền
    refund_proof: {
      type: String,
      default: '',
    },

    // feedback của user
    feedback_order: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Orders', OrdersSchema);
