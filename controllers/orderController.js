const { formatOrderResponse } = require('../utils/orderFormatter');
const { emitOrderUpdateEvent } = require('../utils/orderSocketHelper');
const orderService = require('../services/orderService');
const orderDetailService = require('../services/orderDetailService');
const vnpayService = require('../services/vnpayService');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
const ProductVariants = require('../models/ProductVariant');

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
    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: formatOrderResponse(order)
    });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Error retrieving order' });
  }
};

exports.updateOrderByAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied: Admin/Staff role required' });
    }
    const { orderId } = req.params;
    if (!orderId || !orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid order ID format' });
    }
    const { order_status, pay_status, refund_status, refund_proof, cancelReason } = req.body;
    const allowedFields = { order_status, pay_status, refund_status, refund_proof, cancelReason };
    const filteredData = Object.fromEntries(Object.entries(allowedFields).filter(([_, v]) => v !== undefined));
    
    const oldOrder = await orderService.getOrderByIdService(orderId, req.user);
    const updatedOrder = await orderService.updateOrderService(orderId, filteredData, req.user);
    
    const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) {
      let messageType = 'status_changed';
      if (oldOrder?.pay_status !== updatedOrder.pay_status && updatedOrder.pay_status) messageType = 'payment_changed';
      else if (updatedOrder.order_status === 'delivered' && oldOrder?.order_status !== 'delivered') messageType = 'delivered';
      await emitOrderUpdateEvent(io, updatedOrder, messageType);
    }
    res.status(200).json({ success: true, message: 'Order updated successfully by admin', data: updatedOrder });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Error updating order' });
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
    if (!orderId) return res.status(400).json({ message: 'Order ID is required' });
    const paymentUrl = await vnpayService.createPaymentUrl(orderId, bankCode, language, req.user, req);
    res.status(200).json({ success: true, message: 'Payment URL created successfully', paymentUrl });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Error creating payment URL', error: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    if (!req.query || Object.keys(req.query).length === 0) return res.status(400).json({ success: false, message: 'Invalid return data from VNPay' });
    const result = await vnpayService.handleReturn(req.query);
    const orderId = req.query.vnp_TxnRef;
    
    const io = req.app.get('io');
    if (io && orderId) {
      const updatedOrder = await Order.findById(orderId).populate('acc_id', 'username name email phone').lean();
      if (updatedOrder && updatedOrder.acc_id) {
        await emitOrderUpdateEvent(io, updatedOrder, 'payment_changed');
      }
    }
    const statusCode = result.code === "00" ? 200 : 400;
    res.status(statusCode).json({ success: result.code === "00", message: result.message, data: { ...result, orderId, amount: req.query.vnp_Amount ? Number(req.query.vnp_Amount) / 100 : 0, paymentMethod: "VNPay" } });
  } catch (error) {
    res.status(error.status || 400).json({ success: false, message: error.message || 'Payment verification failed' });
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    if (!req.query || Object.keys(req.query).length === 0) return res.status(400).json({ RspCode: '99', Message: 'Invalid IPN data' });
    const result = await vnpayService.handleIpn(req.query);
    
    const io = req.app.get('io');
    if (io && req.query.vnp_TxnRef) {
      const updatedOrder = await Order.findById(req.query.vnp_TxnRef).populate('acc_id', 'username name email phone').lean();
      if (updatedOrder && updatedOrder.acc_id) {
        await emitOrderUpdateEvent(io, updatedOrder, 'payment_changed');
      }
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(200).json({ RspCode: '99', Message: 'Internal server error' });
  }
};

exports.checkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { savedOrder, orderDetailsToSave, orderDetailsIds, voucher } = await orderService.createOrderService(userId, req.body);
    
    const io = req.app.get('io');
    if (io && userId) {
      io.to(`user_${userId.toString()}`).emit('cartUpdated', { action: 'cleared', accountId: userId });
      const populatedOrder = await Order.findById(savedOrder._id).populate('acc_id', 'username name email phone').lean();
      await emitOrderUpdateEvent(io, { ...populatedOrder, orderDetails: orderDetailsIds }, 'created');
    }
    
    return res.status(201).json({
      success: true,
      message: 'Order created successfully with details, cart cleared',
      data: {
        order: { ...savedOrder.toObject(), orderDetails: orderDetailsIds },
        orderDetails: orderDetailsToSave,
        orderDetailsIds,
        voucher,
        summary: { totalItems: orderDetailsToSave.length, originalPrice: savedOrder.totalPrice, discountAmount: savedOrder.discountAmount, finalPrice: savedOrder.finalPrice }
      }
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getOrderByIdForUser = async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.isValidObjectId(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID' });
    const order = await Order.findById(orderId).populate('acc_id', 'username name').populate('voucher_id', 'code discountType discountValue');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && order.acc_id._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Can only view own order' });
    }
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Error retrieving order' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { cancelReason } = req.body;
    if (cancelReason && (typeof cancelReason !== 'string' || cancelReason.length > 500)) return res.status(400).json({ message: 'Invalid cancel reason' });
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.order_status !== 'pending') return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    
    if (order.voucher_id) {
      const voucher = await Voucher.findById(order.voucher_id);
      if (voucher && voucher.usedCount > 0) { voucher.usedCount -= 1; await voucher.save(); }
    }
    if (order.orderDetails?.length > 0) {
      for (const orderDetail of order.orderDetails) {
        if (orderDetail.variant_id) {
          const variant = await ProductVariants.findById(orderDetail.variant_id);
          if (variant) { variant.stockQuantity += orderDetail.Quantity; await variant.save(); }
        }
      }
    }
    const updatedOrder = await orderService.updateOrderService(orderId, { order_status: 'cancelled', cancelReason }, req.user);
    const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) await emitOrderUpdateEvent(io, updatedOrder, 'cancelled');
    
    res.status(200).json({ message: 'Order cancelled successfully', order: updatedOrder, voucherRefunded: !!order.voucher_id, stockRestored: order.orderDetails?.length || 0 });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error cancelling order' });
  }
};

exports.addFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;
    const { rating, content } = req.body;
    const { savedOrderDetail, order } = await orderDetailService.addFeedbackService(orderId, variantId, rating, content, req.user);
    return res.status(200).json({ success: true, message: 'Product feedback added successfully', feedback: savedOrderDetail.feedback, orderDetail: savedOrderDetail, order: { _id: order._id } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error adding product feedback' });
  }
};

exports.editFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;
    const { rating, content } = req.body;
    const { savedOrderDetail, order } = await orderDetailService.editFeedbackService(orderId, variantId, rating, content, req.user);
    return res.status(200).json({ success: true, message: 'Product feedback updated successfully', feedback: savedOrderDetail.feedback, orderDetail: savedOrderDetail, order: { _id: order._id } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error updating product feedback' });
  }
};

exports.deleteFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;
    const { savedOrderDetail, order } = await orderDetailService.deleteFeedbackService(orderId, variantId, req.user);
    return res.status(200).json({ success: true, message: 'Product feedback deleted successfully', orderDetail: savedOrderDetail, order: { _id: order._id } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error deleting product feedback' });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const orders = await orderService.getUserOrdersService(req.params.acc_id, req.query, req.user);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving user orders' });
  }
};

exports.getAllOrderForAdmin = async (req, res) => {
  try {
    const orders = await orderService.getAllOrderForAdminService(req.query, req.user);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving all orders' });
  }
};