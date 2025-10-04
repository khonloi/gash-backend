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

    if (result.code === "00") {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        data: result
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



// controllers/orderController.js
const Orders = require('../models/Orders');
const Accounts = require('../models/Accounts');
const Voucher = require('../models/Voucher');
const { applyVoucher } = require('./voucherController');

exports.checkout = async (req, res) => {
  try {
    // lấy user từ token
    const userId = req.user.id;

    const { addressReceive, phone, totalPrice, payment_method, voucherCode } = req.body;

    // validate input
    if (!addressReceive || !phone || !totalPrice || !payment_method) {
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
        console.warn("Voucher không áp dụng được:", err.message);
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

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: savedOrder,
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};


