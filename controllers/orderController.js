// ===== Imports (all at top) =====
const mongoose = require('mongoose');
const orderService = require('../services/orderService');
const vnpayService = require('../services/vnpayService');
const feedbackService = require('../services/feedbackService');
const { createOrderNotification, emitOrderNotification } = require('../utils/orderNotificationHelper');

// Models used in checkout, cancelOrder, feedback, and VNPay handlers
const Accounts = require('../models/Accounts');
const Voucher = require('../models/Voucher');
const Cart = require('../models/Cart');
const { applyVoucher } = require('./voucherController');

// ===== Shared Socket Emit Helper =====
/**
 * Emits an order update to the user's room and the admin room,
 * then creates and emits a notification.
 *
 * @param {import('socket.io').Server} io
 * @param {object} order - The updated order document (Mongoose or plain object)
 * @param {string} messageType - One of: 'created', 'status_changed', 'payment_changed', 'cancelled', 'delivered'
 * @param {object} [opts] - Optional overrides
 * @param {string} [opts.oldOrderStatus] - Used to determine notification messageType for admin updates
 * @param {string} [opts.oldPayStatus]
 */
async function emitOrderUpdate(io, order, messageType, opts = {}) {
  if (!io || !order) return;

  const accountId = order.accountId;
  if (!accountId) return;

  const userId =
    typeof accountId === 'object' && accountId._id
      ? accountId._id.toString()
      : accountId.toString();

  const orderId = order._id.toString();

  // Normalize to a plain object
  const orderData = order.toObject ? order.toObject() : order;

  io.to(`user_${userId}`).emit('orderUpdated', { userId, order: orderData });
  io.to('order_admins').emit('orderUpdated', { userId, order: orderData });

  try {
    const notification = await createOrderNotification({
      userId,
      orderId,
      orderStatus: order.orderStatus,
      payStatus: order.payStatus,
      messageType,
    });
    // Small delay to ensure socket connection is established before emitting
    setTimeout(() => emitOrderNotification(io, notification, userId), 100);
  } catch (notifErr) {
    console.error('Error creating order notification:', notifErr.message);
  }
}

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

    // Format response data
    const formattedOrder = {
      _id: order._id,
      orderDate: order.orderDate,
      addressReceive: order.addressReceive,
      name: order.name,
      phone: order.phone,
      totalPrice: order.totalPrice,
      discountAmount: order.discountAmount,
      finalPrice: order.finalPrice,
      orderStatus: order.orderStatus,
      payStatus: order.payStatus,
      paymentMethod: order.paymentMethod,
      refundStatus: order.refundStatus,
      refundProof: order.refundProof,
      cancelReason: order.cancelReason, // Added cancelReason to response
      vnpay_payment_url: order.vnpay_payment_url,
      vnpay_expiry_time: order.vnpay_expiry_time,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      // Customer information
      customer: {
        _id: order.accountId._id,
        username: order.accountId.username,
        name: order.accountId.name,
        email: order.accountId.email,
        phone: order.accountId.phone,
        address: order.accountId.address,
        image: order.accountId.image
      },

      // Voucher information (if exists)
      voucher: order.voucherId ? {
        _id: order.voucherId._id,
        code: order.voucherId.code,
        voucher_name: order.voucherId.voucher_name,
        discountType: order.voucherId.discountType,
        discountValue: order.voucherId.discountValue,
        discount_percentage: order.voucherId.discount_percentage,
        discount_amount: order.voucherId.discount_amount,
      } : null,

      // Order details with product information
      orderDetails: order.orderDetails ? order.orderDetails.map(detail => ({
        _id: detail._id,
        variant: detail.variantId ? {
          _id: detail.variantId._id,
          product: detail.variantId.productId ? {
            _id: detail.variantId.productId._id,
            name: detail.variantId.productId.productName
          } : null,
          color: detail.variantId.productColorId ? {
            _id: detail.variantId.productColorId._id,
            name: detail.variantId.productColorId.productColorName
          } : null,
          size: detail.variantId.productSizeId ? {
            _id: detail.variantId.productSizeId._id,
            name: detail.variantId.productSizeId.productSizeName
          } : null,
          image: detail.variantId.variantImage || null
        } : null,
        unitPrice: detail.unitPrice,
        quantity: detail.Quantity,
        totalPrice: detail.unitPrice * detail.Quantity,
        feedback: detail.feedback ? {
          rating: detail.feedback.rating,
          content: detail.feedback.isDeleted
            ? 'This feedback has been deleted by staff/admin'
            : detail.feedback.content,
          createdAt: detail.feedback.createdAt,
          updatedAt: detail.feedback.updatedAt,
          isDeleted: detail.feedback.isDeleted,
          has_rating: detail.feedback.rating !== null && detail.feedback.rating !== undefined,
          has_content: detail.feedback.isDeleted
            ? true  // Show content flag as true so the deletion message displays
            : (detail.feedback.content && detail.feedback.content.trim() !== '')
        } : null
      })) : [],

      // Summary
      summary: {
        totalItems: order.orderDetails ? order.orderDetails.length : 0,
        totalQuantity: order.orderDetails ? order.orderDetails.reduce((sum, detail) => sum + detail.Quantity, 0) : 0,
        hasVoucher: !!order.voucherId,
        hasFeedback: false
      }
    };

    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: formattedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error retrieving order'
    });
  }
};

exports.updateOrderByAdmin = async (req, res) => {
  try {
    // Only admin and staff can update order
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied: Admin/Staff role required' });
    }

    // Validate orderId
    const { orderId } = req.params;
    if (!orderId || !orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid order ID format' });
    }

    const { orderStatus, payStatus, refundStatus, refundProof, cancelReason } = req.body;

    // Validate enums
    if (orderStatus && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(orderStatus)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }
    if (payStatus && !['unpaid', 'paid'].includes(payStatus)) {
      return res.status(400).json({ message: 'Invalid pay status' });
    }
    if (refundStatus && !['not_applicable', 'pending_refund', 'refunded'].includes(refundStatus)) {
      return res.status(400).json({ message: 'Invalid refund status' });
    }
    if (cancelReason && typeof cancelReason === 'string' && cancelReason.length > 500) {
      return res.status(400).json({ message: 'Cancel reason cannot exceed 500 characters' });
    }

    // Only allow updating basic fields, feedback not included
    const allowedFields = { orderStatus, payStatus, refundStatus, refundProof, cancelReason };
    const filteredData = Object.fromEntries(
      Object.entries(allowedFields).filter(([key, value]) => value !== undefined)
    );

    // Get old order status before update for notification logic
    const oldOrder = await orderService.getOrderByIdService(orderId, req.user);
    const oldOrderStatus = oldOrder?.orderStatus;
    const oldPayStatus = oldOrder?.payStatus;

    const updatedOrder = await orderService.updateOrderService(orderId, filteredData, req.user);
    const io = req.app.get('io');

    // Determine notification type
    const newOrderStatus = updatedOrder.orderStatus;
    const newPayStatus   = updatedOrder.payStatus;
    let notifType = 'status_changed';
    if (oldPayStatus !== newPayStatus && newPayStatus) notifType = 'payment_changed';
    else if (newOrderStatus === 'delivered' && oldOrderStatus !== 'delivered') notifType = 'delivered';

    await emitOrderUpdate(io, updatedOrder, notifType);
    res.status(200).json({
      success: true,
      message: 'Order updated successfully by admin',
      data: updatedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error updating order'
    });
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
    const orderId = req.query.vnp_TxnRef;
    const amount = req.query.vnp_Amount ? Number(req.query.vnp_Amount) / 100 : 0;
    const paymentMethod = "VNPay";

    const io = req.app.get('io');
    if (io && orderId) {
      const updatedOrder = await orderService.getOrderForEmitService(orderId);
      if (updatedOrder && updatedOrder.accountId) {
        await emitOrderUpdate(io, updatedOrder, 'payment_changed');
      }
    }

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

    const io = req.app.get('io');
    if (io && req.query.vnp_TxnRef) {
      const orderId = req.query.vnp_TxnRef;
      const updatedOrder = await orderService.getOrderForEmitService(orderId);
      if (updatedOrder && updatedOrder.accountId) {
        await emitOrderUpdate(io, updatedOrder, 'payment_changed');
      }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("VNPay IPN error:", error);
    res.status(200).json({
      RspCode: '99',
      Message: 'Internal server error'
    });
  }
};

exports.checkout = async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await orderService.checkoutService(req.user.id, req.body, io);
    
    return res.status(201).json({
      success: true,
      message: 'Order created successfully with details, cart cleared',
      data: result
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(error.status || 500).json({ 
      success: false, 
      message: error.message || 'Error creating order' 
    });
  }
};

exports.getOrderByIdForUser = async (req, res) => {
  try {
    const order = await orderService.getOrderByIdForUserService(req.params.id, req.user);
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Error retrieving order' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { cancelReason } = req.body;
    const io = req.app.get('io');
    
    const result = await orderService.cancelOrderService(orderId, cancelReason, req.user, io);

    res.status(200).json({
      message: 'Order cancelled successfully',
      ...result
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.message || 'Error cancelling order' });
  }
};

exports.addFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;
    const { rating, content } = req.body;

    if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or variant ID' });
    }

    const { savedOrderDetail, order } = await feedbackService.addFeedbackProductService(orderId, variantId, rating, content, req.user);

    res.status(200).json({
      success: true,
      message: 'Product feedback added successfully',
      feedback: savedOrderDetail.feedback,
      orderDetail: {
        _id: savedOrderDetail._id,
        orderId: savedOrderDetail.orderId,
        variantId: savedOrderDetail.variantId,
        feedback: savedOrderDetail.feedback
      },
      order: {
        _id: order._id
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error adding product feedback',
    });
  }
};

exports.editFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;
    const { rating, content } = req.body;

    if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or variant ID' });
    }

    const { savedOrderDetail, order } = await feedbackService.editFeedbackProductService(orderId, variantId, rating, content, req.user);

    res.status(200).json({
      success: true,
      message: 'Product feedback updated successfully',
      feedback: savedOrderDetail.feedback,
      orderDetail: {
        _id: savedOrderDetail._id,
        orderId: savedOrderDetail.orderId,
        variantId: savedOrderDetail.variantId,
        feedback: savedOrderDetail.feedback
      }
    });
  } catch (error) {
    console.error('Edit feedback product error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error updating product feedback',
    });
  }
};

exports.deleteFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;

    // Validate IDs
    if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or variant ID' });
    }

    // Check order exists and belongs to current user
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only allow delete feedback when order is delivered
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be deleted when the order is delivered',
      });
    }

    // Find product detail in order
    const orderDetail = await OrderDetails.findOne({
      orderId: orderId,
      variantId: variantId,
    });

    if (!orderDetail) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in this order',
      });
    }

    // Check if feedback is deleted
    if (orderDetail.feedback && orderDetail.feedback.isDeleted === true) {
      return res.status(404).json({
        success: false,
        message: 'Feedback has been deleted',
      });
    }

    // Check if there is existing feedback to delete
    const hasExistingFeedback = orderDetail.feedback && (
      (orderDetail.feedback.rating && orderDetail.feedback.rating !== null) ||
      (orderDetail.feedback.content && orderDetail.feedback.content.trim() !== '')
    );

    if (!hasExistingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'No existing feedback to delete',
      });
    }

    // Soft delete feedback (set isDeleted = true)
    console.log('Deleting feedback for orderDetail:', orderDetail._id);
    const savedOrderDetail = await OrderDetails.findByIdAndUpdate(
      orderDetail._id,
      {
        $set: {
          'feedback.isDeleted': true,
          'feedback.updatedAt': new Date()
        }
      },
      { new: true, runValidators: true }
    );
    console.log('Feedback deleted, isDeleted:', savedOrderDetail.feedback.isDeleted);

    if (!savedOrderDetail) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete feedback from database'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product feedback deleted successfully',
      feedback: {
        rating: savedOrderDetail.feedback.rating,
        content: savedOrderDetail.feedback.content,
        createdAt: savedOrderDetail.feedback.createdAt,
        updatedAt: savedOrderDetail.feedback.updatedAt,
        isDeleted: true
      },
      orderDetail: {
        _id: savedOrderDetail._id,
        orderId: savedOrderDetail.orderId,
        variantId: savedOrderDetail.variantId,
        feedback: {
          rating: savedOrderDetail.feedback.rating,
          content: savedOrderDetail.feedback.content,
          createdAt: savedOrderDetail.feedback.createdAt,
          updatedAt: savedOrderDetail.feedback.updatedAt,
          isDeleted: true
        }
      }
    });
  } catch (error) {
    console.error('Delete feedback product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting product feedback',
    });
  }
};

exports.getAllFeedbackOfProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const currentUserId = req.user ? req.user.id : null; // Get current user if logged in

    // Validate product ID
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get all variants of this product
    const allVariantsOfProduct = await ProductVariant.find({
      productId: productId
    }).select('_id');

    const variantIds = allVariantsOfProduct.map(v => v._id);

    // Find all feedback of all variants belonging to this product
    // Include deleted feedbacks so they can be shown to users with deletion message
    const query = {
      variantId: { $in: variantIds },
      $or: [
        { 'feedback.rating': { $exists: true, $ne: null } },
        { 'feedback.content': { $exists: true, $ne: '' } }
      ]
    };

    // Get all feedback first for custom sorting
    const allFeedbacks = await OrderDetails.find(query)
      .populate({
        path: 'orderId',
        select: 'orderDate orderStatus accountId',
        populate: {
          path: 'accountId',
          select: 'username name image email phone'
        }
      })
      .populate({
        path: 'variantId',
        select: 'productColorId productSizeId variantImage',
        populate: [
          {
            path: 'productColorId',
            select: 'productColorName'
          },
          {
            path: 'productSizeId',
            select: 'productSizeName'
          }
        ]
      })
      .sort({ 'orderId.orderDate': -1 }); // Sort by order date first

    // Custom sorting: current user's feedback on top, then by date
    const sortedFeedbacks = allFeedbacks
      .filter(feedback => feedback.orderId?.accountId?._id) // Skip entries with null/undefined orderId, accountId, or _id
      .sort((a, b) => {
        // If current user is logged in
        if (currentUserId) {
          const aIsCurrentUser = a.orderId?.accountId?._id?.toString() === currentUserId || false;
          const bIsCurrentUser = b.orderId?.accountId?._id?.toString() === currentUserId || false;

          // Priority 1: Current user's feedback first
          if (aIsCurrentUser && !bIsCurrentUser) return -1; // a first
          if (bIsCurrentUser && !aIsCurrentUser) return 1; // b first
        }

        // Priority 2 (or default): Sort by date
        const aDate = a.orderId?.orderDate ? new Date(a.orderId.orderDate) : new Date(0);
        const bDate = b.orderId?.orderDate ? new Date(b.orderId.orderDate) : new Date(0);
        return bDate - aDate; // Newest first
      });

    // Get total feedback count (excluding deleted ones for statistics)
    const activeFeedbacks = sortedFeedbacks.filter(f => !f.feedback.isDeleted);
    const totalFeedbacks = activeFeedbacks.length;

    // Calculate rating statistics (exclude deleted feedbacks from statistics)
    const feedbacksWithRating = activeFeedbacks.filter(f => f.feedback.rating && f.feedback.rating !== null);
    const totalRatings = feedbacksWithRating.length;
    const averageRating = totalRatings > 0
      ? feedbacksWithRating.reduce((sum, feedback) => sum + feedback.feedback.rating, 0) / totalRatings
      : 0;

    // Calculate % rating instead of count
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

    // Format response
    const formattedFeedbacks = sortedFeedbacks.map(feedback => ({
      _id: feedback._id,
      orderId: feedback.orderId._id,
      order_date: feedback.orderId.orderDate,
      orderStatus: feedback.orderId.orderStatus,
      customer: {
        user_id: feedback.orderId.accountId._id,
        username: feedback.orderId.accountId.username,
        name: feedback.orderId.accountId.name,
        image: feedback.orderId.accountId.image,
        email: feedback.orderId.accountId.email,
        phone: feedback.orderId.accountId.phone,
        is_current_user: currentUserId ? feedback.orderId.accountId._id.toString() === currentUserId : false
      },
      variant: feedback.variantId ? {
        variantId: feedback.variantId._id,
        color: feedback.variantId.productColorId ? feedback.variantId.productColorId.productColorName : null,
        size: feedback.variantId.productSizeId ? feedback.variantId.productSizeId.productSizeName : null,
        image: feedback.variantId.variantImage || null
      } : null,
      feedback: {
        rating: feedback.feedback.rating,
        content: feedback.feedback.isDeleted
          ? 'This feedback has been deleted by staff/admin'
          : feedback.feedback.content,
        createdAt: feedback.feedback.createdAt,
        updatedAt: feedback.feedback.updatedAt,
        isDeleted: feedback.feedback.isDeleted,
        has_rating: feedback.feedback.rating !== null,
        has_content: feedback.feedback.isDeleted
          ? true  // Show content flag as true so the deletion message displays
          : (feedback.feedback.content && feedback.feedback.content.trim() !== '')
      },
      unit_price: feedback.unitPrice,
      quantity: feedback.Quantity
    }));

    res.status(200).json({
      success: true,
      message: 'Product feedbacks retrieved successfully',
      product: {
        product_id: product._id,
        product_name: product.productName,
        total_variants: allVariantsOfProduct.length
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
    console.error('Get all feedback of product error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving product feedbacks'
    });
  }
};

exports.getAllOrderForAdmin = async (req, res) => {
  try {
    // Access check
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied: Admin/Manager role required' });
    }

    const orders = await orderService.getAllOrdersForAdminService();
    res.status(200).json({
      success: true,
      data: orders,
      message: 'All orders retrieved successfully for admin'
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error retrieving all orders for admin'
    });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { cancelReason } = req.body; // Added cancelReason from request body

    // Validate cancelReason
    if (cancelReason && (typeof cancelReason !== 'string' || cancelReason.length > 500)) {
      return res.status(400).json({
        message: 'Invalid cancel reason. Must be a string up to 500 characters.'
      });
    }

    // Get current order information with voucher
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow cancelling when status is pending
    if (order.orderStatus !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    // Handle voucher if order used a voucher
    if (order.voucherId) {
      const voucher = await Voucher.findById(order.voucherId);
      if (voucher) {
        // Decrease usedCount of voucher (restore usage count)
        if (voucher.usedCount > 0) {
          voucher.usedCount -= 1;
          await voucher.save();
        }
      }
    }

    // Restore product stock quantity to warehouse
    if (order.orderDetails && order.orderDetails.length > 0) {
      for (const orderDetail of order.orderDetails) {
        if (orderDetail.variantId) {
          const variant = await ProductVariant.findById(orderDetail.variantId);
          if (variant) {
            // Save stockQuantity before restoring for validation
            const oldStockQuantity = variant.stockQuantity;
            // Add purchased quantity back to stock
            variant.stockQuantity += orderDetail.Quantity;
            // If transition from 0 to > 0, set variantStatus = active
            if (oldStockQuantity === 0 && variant.stockQuantity > 0) {
              variant.variantStatus = 'active';
            }
            await variant.save();
          }
        }
      }
    }

    // Update status to cancelled and save cancelReason
    let updateData = {
      orderStatus: 'cancelled',
      cancelReason
    };

    // If it's a paid VNPAY order, automatically start refund process
    if (order.paymentMethod === 'VNPAY' && order.payStatus === 'paid') {
      updateData.refundStatus = 'pending_refund';
    }

    const updatedOrder = await orderService.updateOrderService(orderId, updateData, req.user);

    // Emit real-time update and notification
    const io = req.app.get('io');
    await emitOrderUpdate(io, updatedOrder, 'cancelled');

    res.status(200).json({
      message: 'Order cancelled successfully',
      order: updatedOrder,
      voucherRefunded: !!order.voucherId,
      stockRestored: order.orderDetails ? order.orderDetails.length : 0,
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.message || 'Error cancelling order' });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const { accountId } = req.params;
    // Validate account ID
    if (!mongoose.isValidObjectId(accountId)) {
      return res.status(400).json({ message: 'Invalid account ID' });
    }
    // Check authorization: only admin, manager, or the user themselves can access
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.id !== accountId) {
      return res.status(403).json({ message: 'Access denied: Can only view own orders' });
    }
    const orders = await orderService.getUserOrdersService(accountId);
    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: orders
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error retrieving user orders'
    });
  }
};