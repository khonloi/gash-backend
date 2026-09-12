const { formatOrderResponse } = require('../utils/orderFormatter');
const { emitOrderUpdateEvent } = require('../utils/orderSocketHelper');
const orderService = require('../services/orderService');
const orderDetailService = require('../services/orderDetailService');
const vnpayService = require('../services/vnpayService');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderDetail = require('../models/OrderDetail');
const Voucher = require('../models/Voucher');
const Product = require('../models/Product');
const ProductVariants = require('../models/ProductVariant');

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

exports.getAllFeedbackOfProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const currentUserId = req.user?.id || null;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID format' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const allVariants = await ProductVariants.find({ productId }).select('_id');
    const variantIds = allVariants.map(v => v._id);

    const query = {
      variant_id: { $in: variantIds },
      $or: [
        { 'feedback.rating': { $exists: true, $ne: null } },
        { 'feedback.content': { $exists: true, $ne: '' } }
      ],
      $and: [
        {
          $or: [
            { 'feedback.is_deleted': { $exists: false } },
            { 'feedback.is_deleted': false }
          ]
        }
      ]
    };

    const allFeedbacks = await OrderDetail.find(query)
      .populate({
        path: 'order_id',
        select: 'orderDate order_status acc_id',
        populate: { path: 'acc_id', select: 'username name image email phone' }
      })
      .populate({
        path: 'variant_id',
        select: 'productColorId productSizeId variantImage',
        populate: [
          { path: 'productColorId', select: 'color_name' },
          { path: 'productSizeId', select: 'size_name' }
        ]
      })
      .sort({ 'order_id.orderDate': -1 });

    const sortedFeedbacks = allFeedbacks
      .filter(f => f.order_id?.acc_id?._id)
      .sort((a, b) => {
        if (currentUserId) {
          const aIsCurrentUser = a.order_id?.acc_id?._id?.toString() === currentUserId;
          const bIsCurrentUser = b.order_id?.acc_id?._id?.toString() === currentUserId;
          if (aIsCurrentUser && !bIsCurrentUser) return -1;
          if (bIsCurrentUser && !aIsCurrentUser) return 1;
        }
        const aDate = a.order_id?.orderDate ? new Date(a.order_id.orderDate) : new Date(0);
        const bDate = b.order_id?.orderDate ? new Date(b.order_id.orderDate) : new Date(0);
        return bDate - aDate;
      });

    const totalFeedbacks = sortedFeedbacks.length;
    const feedbacksWithRating = allFeedbacks.filter(f => f.feedback?.rating);
    const totalRatings = feedbacksWithRating.length;
    const averageRating = totalRatings > 0
      ? feedbacksWithRating.reduce((sum, f) => sum + f.feedback.rating, 0) / totalRatings
      : 0;

    const ratingCounts = {
      5: feedbacksWithRating.filter(f => f.feedback.rating === 5).length,
      4: feedbacksWithRating.filter(f => f.feedback.rating === 4).length,
      3: feedbacksWithRating.filter(f => f.feedback.rating === 3).length,
      2: feedbacksWithRating.filter(f => f.feedback.rating === 2).length,
      1: feedbacksWithRating.filter(f => f.feedback.rating === 1).length
    };

    const ratingPercentage = {
      5: totalRatings > 0 ? Math.round((ratingCounts[5] / totalRatings) * 100) : 0,
      4: totalRatings > 0 ? Math.round((ratingCounts[4] / totalRatings) * 100) : 0,
      3: totalRatings > 0 ? Math.round((ratingCounts[3] / totalRatings) * 100) : 0,
      2: totalRatings > 0 ? Math.round((ratingCounts[2] / totalRatings) * 100) : 0,
      1: totalRatings > 0 ? Math.round((ratingCounts[1] / totalRatings) * 100) : 0
    };

    const formattedFeedbacks = sortedFeedbacks.map(f => ({
      _id: f._id,
      order_id: f.order_id._id,
      order_date: f.order_id.orderDate,
      order_status: f.order_id.order_status,
      customer: {
        user_id: f.order_id.acc_id._id,
        username: f.order_id.acc_id.username,
        name: f.order_id.acc_id.name,
        image: f.order_id.acc_id.image,
        email: f.order_id.acc_id.email,
        phone: f.order_id.acc_id.phone,
        is_current_user: currentUserId ? f.order_id.acc_id._id.toString() === currentUserId : false
      },
      variant: f.variant_id ? {
        variant_id: f.variant_id._id,
        color: f.variant_id.productColorId ? f.variant_id.productColorId.color_name : null,
        size: f.variant_id.productSizeId ? f.variant_id.productSizeId.size_name : null,
        image: f.variant_id.variantImage || null
      } : null,
      feedback: {
        rating: f.feedback.rating,
        content: f.feedback.content,
        created_at: f.feedback.created_at,
        updated_at: f.feedback.updated_at,
        is_deleted: f.feedback.is_deleted,
        has_rating: f.feedback.rating !== null,
        has_content: f.feedback.content && f.feedback.content.trim() !== ''
      },
      unit_price: f.UnitPrice,
      quantity: f.Quantity
    }));

    res.status(200).json({
      success: true,
      message: 'Product feedbacks retrieved successfully',
      product: {
        product_id: product._id,
        product_name: product.productName,
        total_variants: allVariants.length
      },
      statistics: {
        total_feedbacks: totalFeedbacks,
        total_ratings: totalRatings,
        average_rating: Math.round(averageRating * 10) / 10,
        rating_distribution: ratingCounts,
        rating_percentage: ratingPercentage
      },
      feedbacks: formattedFeedbacks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error retrieving product feedbacks' });
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