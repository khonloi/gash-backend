// orderController.js
const orderService = require('../services/orderService');
const vnpayService = require('../services/vnpayService');


exports.createOrder = async (req, res) => {
  try {
    const { acc_id, addressReceive, phone, totalPrice, order_status, pay_status, payment_method, refund_status, feedback_order } = req.body;

    // Validate required fields and enums
    if (!acc_id || !addressReceive || !phone || !totalPrice || !payment_method) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!['COD', 'VNPAY'].includes(payment_method)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }
    if (order_status && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(order_status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }
    if (pay_status && !['unpaid', 'paid'].includes(pay_status)) {
      return res.status(400).json({ message: 'Invalid pay status' });
    }
    if (refund_status && !['not_applicable', 'pending_refund', 'refunded'].includes(refund_status)) {
      return res.status(400).json({ message: 'Invalid refund status' });
    }

    const savedOrder = await orderService.createOrderService(req.body, req.user);
    const io = req.app.get('io');
    if (io && savedOrder && savedOrder.acc_id) {
      io.emit('orderUpdated', { userId: savedOrder.acc_id.toString(), order: savedOrder });
    }
    res.status(201).json({
      message: 'Order created successfully',
      order: savedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error creating order' });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await orderService.getAllOrdersService(req.user);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving orders' });
  }
};

exports.searchOrders = async (req, res) => {
  try {
    const orders = await orderService.searchOrdersService(req.query, req.user);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error searching orders' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await orderService.getOrderByIdService(req.params.id, req.user);
    res.status(200).json(order);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving order' });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { order_status, pay_status, refund_status, feedback_order } = req.body;

    // Validate enums
    if (order_status && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(order_status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }
    if (pay_status && !['unpaid', 'paid'].includes(pay_status)) {
      return res.status(400).json({ message: 'Invalid pay status' });
    }
    if (refund_status && !['not_applicable', 'pending_refund', 'refunded'].includes(refund_status)) {
      return res.status(400).json({ message: 'Invalid refund status' });
    }

    const updatedOrder = await orderService.updateOrderService(req.params.id, req.body, req.user);
    const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) {
      const userId = typeof updatedOrder.acc_id === 'object' && updatedOrder.acc_id._id
        ? updatedOrder.acc_id._id.toString()
        : updatedOrder.acc_id.toString();
      io.emit('orderUpdated', { userId, order: updatedOrder });
    }
    res.status(200).json({
      message: 'Order updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating order' });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const result = await orderService.deleteOrderService(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error deleting order' });
  }
};

exports.createVnpayPaymentUrl = async (req, res) => {
  try {
    const { orderId, bankCode, language } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const paymentUrl = await vnpayService.createPaymentUrl(orderId, bankCode, language, req.user, req);

    res.status(200).json({
      success: true,
      message: 'Payment URL created successfully',
      paymentUrl
    });
  } catch (error) {
    console.error("Payment URL creation error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error creating payment URL',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    if (!req.query || Object.keys(req.query).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid return data from VNPay'
      });
    }

    const result = await vnpayService.handleReturn(req.query);

    // Lấy orderId từ VNPay (chính là vnp_TxnRef đã gửi khi tạo URL)
    const orderId = req.query.vnp_TxnRef;

    // Lấy số tiền (VNPay trả về nhân 100)
    const amount = req.query.vnp_Amount ? Number(req.query.vnp_Amount) / 100 : 0;

    // Phương thức thanh toán
    const paymentMethod = "VNPay";

    if (result.code === "00") {
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          ...result,
          orderId,
          amount,
          paymentMethod
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: {
          ...result,
          orderId,
          amount,
          paymentMethod
        }
      });
    }
  } catch (error) {
    console.error("VNPay return error:", error);
    res.status(error.status || 400).json({
      success: false,
      message: error.message || 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


exports.vnpayIpn = async (req, res) => {
  try {
    if (!req.query || Object.keys(req.query).length === 0) {
      return res.status(400).json({
        RspCode: '99',
        Message: 'Invalid IPN data'
      });
    }

    const result = await vnpayService.handleIpn(req.query);

    res.status(200).json(result);
  } catch (error) {
    console.error("VNPay IPN error:", error);
    res.status(200).json({
      RspCode: '99',
      Message: 'Internal server error'
    });
  }
};



const mongoose = require("mongoose");
const Accounts = require("../models/Accounts");
const Orders = require("../models/Orders");
const OrderDetails = require("../models/OrderDetails");
const ProductVariants = require("../models/ProductVariants");
const Voucher = require("../models/Voucher");
const Carts = require('../models/Carts');
const { applyVoucher } = require('./voucherController');

exports.checkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressReceive, phone, totalPrice, payment_method, voucherCode, items } = req.body;

    // validate input
    if (!addressReceive || !phone || !totalPrice || !payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!['COD', 'VNPAY'].includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    // check account tồn tại
    const account = await Accounts.findById(userId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // tính toán voucher (nếu có)
    let voucher = null;
    let discountAmount = 0;
    let finalPrice = totalPrice;

    if (voucherCode) {
      try {
        const applied = await applyVoucher(voucherCode, totalPrice);
        voucher = applied.voucher;
        discountAmount = applied.discountAmount;
        finalPrice = applied.finalPrice;
      } catch (err) {
        console.warn("Voucher không áp dụng được, bỏ qua:", err.message);
        // bỏ qua voucher, giữ nguyên giá gốc
      }
    }

    // tạo order
    const newOrder = new Orders({
      acc_id: userId,
      addressReceive,
      phone,
      totalPrice,
      voucher_id: voucher ? voucher._id : null,
      discountAmount,
      finalPrice,
      order_status: 'pending',
      pay_status: 'unpaid',
      payment_method,
    });

    const savedOrder = await newOrder.save();

    // nếu có voucher thì tăng usedCount
    if (voucher) {
      voucher.usedCount += 1;
      await voucher.save();
    }

    // tạo order details từ items
    const orderDetailsToSave = [];
    const boughtVariantIds = [];
    for (const item of items) {
      const { variant_id, UnitPrice, Quantity, feedback_details } = item;

      // validate item
      if (!variant_id || !UnitPrice || !Quantity) {
        return res.status(400).json({ success: false, message: 'Invalid item in order details' });
      }
      if (UnitPrice < 0) {
        return res.status(400).json({ success: false, message: 'Unit price cannot be negative' });
      }
      if (Quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
      }
      if (feedback_details && feedback_details.length > 500) {
        return res.status(400).json({ success: false, message: 'Feedback cannot exceed 500 characters' });
      }

      const variant = await ProductVariants.findById(variant_id);
      if (!variant) {
        return res.status(404).json({ success: false, message: `Product variant not found: ${variant_id}` });
      }

      const orderDetail = new OrderDetails({
        order_id: savedOrder._id,
        variant_id,
        UnitPrice,
        Quantity,
        feedback_details: feedback_details || '',
        is_deleted: false,
      });
      const savedDetail = await orderDetail.save();
      orderDetailsToSave.push(savedDetail);
      boughtVariantIds.push(variant_id.toString());
    }

    // XÓA CÁC SẢN PHẨM ĐÃ MUA KHỎI CART (chỉ xóa đúng sản phẩm đã mua của user)
    const objectUserId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const objectVariantIds = boughtVariantIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

    await Carts.deleteMany({
      acc_id: objectUserId,
      variant_id: { $in: objectVariantIds }
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully with details, cart cleared',
      data: {
        order: savedOrder,
        orderDetails: orderDetailsToSave,
      },
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


exports.getOrderByIdForUser = async (req, res) => {
  try {
    const user = req.user;
    const orderId = req.params.id;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const order = await Orders.findById(orderId)
      .populate('acc_id', 'username name')
      .populate('voucher_id', 'code discountType discountValue');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Kiểm tra quyền
    if (user.role !== 'admin' && user.role !== 'manager' && order.acc_id._id.toString() !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Can only view own order' });
    }


    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || 'Error retrieving order' });
  }
};



exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Lấy thông tin order hiện tại
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Chỉ cho phép hủy khi trạng thái là pending
    if (order.order_status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    // Cập nhật trạng thái sang cancelled
    const updatedOrder = await orderService.updateOrderService(
      orderId,
      { order_status: 'cancelled' },
      req.user
    );

    res.status(200).json({
      message: 'Order cancelled successfully',
      order: updatedOrder
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.message || 'Error cancelling order' });
  }
};
