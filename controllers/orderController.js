// ===== Imports (all at top) =====
const mongoose = require('mongoose');
const orderService = require('../services/orderService');
const vnpayService = require('../services/vnpayService');
const { createOrderNotification, emitOrderNotification } = require('../utils/orderNotificationHelper');

// Models used in checkout, cancelOrder, feedback, and VNPay handlers
const Accounts = require('../models/Accounts');
const Orders = require('../models/Orders');
const OrderDetails = require('../models/OrderDetails');
const ProductVariant = require('../models/ProductVariant');
const Product = require('../models/Product');
const ProductImage = require('../models/ProductImage');
const ProductColors = require('../models/ProductColors');
const ProductSizes = require('../models/ProductSizes');
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

    // Get orderId from VNPay (vnp_TxnRef sent when creating URL)
    const orderId = req.query.vnp_TxnRef;

    // Get amount (VNPay returns amount multiplied by 100)
    const amount = req.query.vnp_Amount ? Number(req.query.vnp_Amount) / 100 : 0;

    // Payment method
    const paymentMethod = "VNPay";

    // Emit Socket.IO event for payment status update
    const io = req.app.get('io');
    if (io && orderId) {
      const updatedOrder = await Orders.findById(orderId)
        .populate('accountId', 'username name email phone')
        .lean();

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

    // Emit Socket.IO event for payment status update (IPN)
    const io = req.app.get('io');
    if (io && req.query.vnp_TxnRef) {
      const orderId = req.query.vnp_TxnRef;
      const updatedOrder = await Orders.findById(orderId)
        .populate('accountId', 'username name email phone')
        .lean();

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
    const userId = req.user.id;
    const { name, addressReceive, phone, totalPrice, paymentMethod, voucherCode, items } = req.body;

    // validate input - name is the recipient's name (who will receive the order)
    if (!name || !addressReceive || !phone || !totalPrice || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, addressReceive, phone, totalPrice, paymentMethod, items' });
    }
    if (!['COD', 'VNPAY'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    // Check if account exists
    const account = await Accounts.findById(userId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Calculate voucher (if any)
    let voucher = null;
    let discountAmount = 0;
    let finalPrice = totalPrice;

    if (voucherCode) {
      try {
        const result = await applyVoucher(voucherCode, totalPrice);
        // applyVoucher returns { success, message, data: { voucher, discountAmount, finalPrice } }
        if (result.success && result.data) {
          voucher = result.data.voucher;
          discountAmount = result.data.discountAmount;
          finalPrice = result.data.finalPrice;
        }
        // If not success (invalid voucher), ignore voucher and keep original price
      } catch (err) {
        // Ignore voucher, keep original price
      }
    }

    // Create order
    const newOrder = new Orders({
      accountId: userId,
      name,
      addressReceive,
      phone,
      totalPrice,
      voucherId: voucher ? voucher._id : null,
      discountAmount,
      finalPrice,
      orderStatus: 'pending',
      payStatus: 'unpaid',
      paymentMethod,
    });

    const savedOrder = await newOrder.save();

    // Increment usedCount if voucher was applied
    if (voucher) {
      voucher.usedCount += 1;
      await voucher.save();
    }

    // Create order details from items
    const orderDetailsToSave = [];
    const boughtVariantIds = [];
    for (const item of items) {
      const { variantId, unitPrice, Quantity, feedback_details } = item;

      // validate item
      if (!variantId || !unitPrice || !Quantity) {
        return res.status(400).json({ success: false, message: 'Invalid item in order details' });
      }
      if (unitPrice < 0) {
        return res.status(400).json({ success: false, message: 'Unit price cannot be negative' });
      }
      if (Quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
      }
      if (feedback_details && feedback_details.length > 500) {
        return res.status(400).json({ success: false, message: 'Feedback cannot exceed 500 characters' });
      }

      // Atomically check-and-deduct stock in a single operation.
      // If another concurrent checkout already took the last unit, this returns null
      // and we abort with a clear error instead of overselling.
      const updatedVariant = await ProductVariant.findOneAndUpdate(
        { _id: variantId, stockQuantity: { $gte: Quantity } },
        [
          {
            $set: {
              stockQuantity: { $subtract: ['$stockQuantity', Quantity] },
              // Auto-deactivate when stock hits 0
              variantStatus: {
                $cond: [
                  { $eq: [{ $subtract: ['$stockQuantity', Quantity] }, 0] },
                  'inactive',
                  '$variantStatus',
                ],
              },
            },
          },
        ],
        { new: true }
      );

      if (!updatedVariant) {
        // Roll back the order and voucher usage if stock deduction failed
        await savedOrder.deleteOne();
        if (voucher) {
          voucher.usedCount -= 1;
          await voucher.save();
        }
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for variant ${variantId}. The item may have just sold out.`,
        });
      }

      // Stock confirmed and deducted — create the order detail record
      const orderDetail = new OrderDetails({
        orderId: savedOrder._id,
        variantId,
        unitPrice,
        Quantity,
      });
      const savedDetail = await orderDetail.save();
      orderDetailsToSave.push(savedDetail);
      boughtVariantIds.push(variantId.toString());
    } // end for (const item of items)

    // Link order details to the order
    const orderDetailsIds = orderDetailsToSave.map(detail => detail._id);
    savedOrder.orderDetails = orderDetailsIds;
    await savedOrder.save();

    // Remove purchased items from the cart
    const objectUserId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const objectVariantIds = boughtVariantIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);
    await Cart.deleteMany({
      accountId: objectUserId,
      variantId: { $in: objectVariantIds },
    });

    // Emit Socket.IO events for cart update and new order
    const io = req.app.get('io');
    if (io && userId) {
      // Emit cart update
      io.to(`user_${userId.toString()}`).emit('cartUpdated', {
        action: 'cleared',
        accountId: userId
      });

      // Populate order with user details for Socket.IO emission
      const populatedOrder = await Orders.findById(savedOrder._id)
        .populate('accountId', 'username name email phone')
        .lean();

      // Emit new order creation for real-time updates with populated data
      const formattedOrderForSocket = {
        _id: populatedOrder._id,
        accountId: populatedOrder.accountId,
        name: populatedOrder.name,
        addressReceive: populatedOrder.addressReceive,
        phone: populatedOrder.phone,
        totalPrice: populatedOrder.totalPrice,
        voucherId: populatedOrder.voucherId,
        discountAmount: populatedOrder.discountAmount,
        finalPrice: populatedOrder.finalPrice,
        orderStatus: populatedOrder.orderStatus,
        payStatus: populatedOrder.payStatus,
        paymentMethod: populatedOrder.paymentMethod,
        orderDate: populatedOrder.orderDate,
        createdAt: populatedOrder.createdAt,
        updatedAt: populatedOrder.updatedAt || populatedOrder.createdAt,
        orderDetails: orderDetailsIds
      };

      io.to(`user_${userId.toString()}`).emit('orderUpdated', {
        userId: userId.toString(),
        order: formattedOrderForSocket
      });
      // Also notify admins
      io.to('order_admins').emit('orderUpdated', {
        userId: userId.toString(),
        order: formattedOrderForSocket
      });

      console.log(`New order ${savedOrder._id} created, emitted to user_${userId} and order_admins`);

      // Create and emit order creation notification
      try {
        const notification = await createOrderNotification({
          userId: userId.toString(),
          orderId: savedOrder._id.toString(),
          orderStatus: savedOrder.orderStatus,
          payStatus: savedOrder.payStatus,
          messageType: 'created'
        });

        // Emit notification immediately
        emitOrderNotification(io, notification, userId.toString());
      } catch (notifError) {
        console.error('Error creating order creation notification:', notifError);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Order created successfully with details, cart cleared',
      data: {
        order: {
          _id: savedOrder._id,
          accountId: savedOrder.accountId,
          addressReceive: savedOrder.addressReceive,
          phone: savedOrder.phone,
          totalPrice: savedOrder.totalPrice,
          voucherId: savedOrder.voucherId,
          discountAmount: savedOrder.discountAmount,
          finalPrice: savedOrder.finalPrice,
          orderStatus: savedOrder.orderStatus,
          payStatus: savedOrder.payStatus,
          paymentMethod: savedOrder.paymentMethod,
          orderDate: savedOrder.orderDate,
          orderDetails: orderDetailsIds
        },
        orderDetails: orderDetailsToSave.map(detail => ({
          _id: detail._id,
          orderId: detail.orderId,
          variantId: detail.variantId,
          unitPrice: detail.unitPrice,
          Quantity: detail.Quantity,
          feedback: detail.feedback
        })),
        orderDetailsIds: orderDetailsIds,
        voucher: voucher ? {
          _id: voucher._id,
          code: voucher.code,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          minOrderValue: voucher.minOrderValue,
          maxDiscount: voucher.maxDiscount,
          usedCount: voucher.usedCount,
          usageLimit: voucher.usageLimit,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
          isDeleted: voucher.isDeleted
        } : null,
        summary: {
          totalItems: orderDetailsToSave.length,
          totalQuantity: orderDetailsToSave.reduce((sum, detail) => sum + detail.Quantity, 0),
          originalPrice: savedOrder.totalPrice,
          discountAmount: savedOrder.discountAmount,
          finalPrice: savedOrder.finalPrice,
          stockDeducted: orderDetailsToSave.length
        }
      },
    });

  } catch (error) {
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
      .populate('accountId', 'username name')
      .populate('voucherId', 'code discountType discountValue');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check permissions
    if (user.role !== 'admin' && user.role !== 'manager' && order.accountId._id.toString() !== user.id) {
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

    const updatedOrder = await orderService.updateOrderService(
      orderId,
      updateData,
      req.user
    );

    // Emit Socket.IO event for order cancellation
    const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.accountId) {
      const userId = typeof updatedOrder.accountId === 'object' && updatedOrder.accountId._id
        ? updatedOrder.accountId._id.toString()
        : updatedOrder.accountId.toString();

      // Ensure order is properly formatted with all fields
      const formattedOrder = {
        ...updatedOrder.toObject ? updatedOrder.toObject() : updatedOrder,
        accountId: updatedOrder.accountId,
        name: updatedOrder.name,
        orderDate: updatedOrder.orderDate,
        updatedAt: updatedOrder.updatedAt || updatedOrder.createdAt,
        createdAt: updatedOrder.createdAt,
        cancelReason: updatedOrder.cancelReason
      };

      // Emit to specific user room for real-time updates
      io.to(`user_${userId}`).emit('orderUpdated', { userId, order: formattedOrder });
      // Also emit to admin room so dashboard gets updates
      io.to('order_admins').emit('orderUpdated', { userId, order: formattedOrder });

      console.log(`Order ${orderId} cancelled, emitted to user_${userId} and order_admins`);

      // Create and emit order cancellation notification
      try {
        const notification = await createOrderNotification({
          userId,
          orderId: orderId.toString(),
          orderStatus: updatedOrder.orderStatus,
          payStatus: updatedOrder.payStatus,
          messageType: 'cancelled'
        });

        // Small delay to ensure socket connection is established
        setTimeout(() => {
          emitOrderNotification(io, notification, userId);
        }, 100);
      } catch (notifError) {
        console.error('Error creating order cancellation notification:', notifError);
      }
    }

    res.status(200).json({
      message: 'Order cancelled successfully',
      order: updatedOrder,
      voucherRefunded: order.voucherId ? true : false,
      stockRestored: order.orderDetails ? order.orderDetails.length : 0
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

    // Validate input
    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required',
      });
    }

    // Validate IDs
    if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or variant ID' });
    }

    // Validate rating
    if (rating !== undefined) {
      if (typeof rating !== 'number' || !Number.isInteger(rating)) {
        return res.status(400).json({ success: false, message: 'Rating must be an integer' });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      }
    }

    // Validate content
    if (content !== undefined && content !== null) {
      if (typeof content !== 'string') {
        return res.status(400).json({ success: false, message: 'Content must be a string' });
      }
      if (content.length > 500) {
        return res.status(400).json({ success: false, message: 'Feedback cannot exceed 500 characters' });
      }
    }

    // Check order exists and belongs to current user
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only allow feedback when order is delivered
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be added when the order is delivered',
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

    // Create update object
    const updateData = {};
    if (rating !== undefined) {
      updateData['feedback.rating'] = rating;
    }
    if (content !== undefined) {
      updateData['feedback.content'] = content === null ? null : content.trim();
    }
    // Reset isDeleted and set timestamps when creating new feedback
    updateData['feedback.isDeleted'] = false;
    updateData['feedback.createdAt'] = new Date();
    updateData['feedback.updatedAt'] = new Date();

    // Update directly in database
    const savedOrderDetail = await OrderDetails.findByIdAndUpdate(
      orderDetail._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!savedOrderDetail) {
      return res.status(500).json({
        success: false,
        message: 'Failed to save feedback to database'
      });
    }

    // Verify from database
    const verifyOrderDetail = await OrderDetails.findById(orderDetail._id);

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
    res.status(500).json({
      success: false,
      message: error.message || 'Error adding product feedback',
    });
  }
};

exports.editFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;
    const { rating, content } = req.body;

    // Validate input
    if (!rating && !content) {
      return res.status(400).json({
        success: false,
        message: 'Either rating or content (or both) is required',
      });
    }

    // Validate IDs
    if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or variant ID' });
    }

    // Validate rating
    if (rating !== undefined) {
      if (typeof rating !== 'number' || !Number.isInteger(rating)) {
        return res.status(400).json({ success: false, message: 'Rating must be an integer' });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      }
    }

    // Validate content
    if (content !== undefined && content !== null) {
      if (typeof content !== 'string') {
        return res.status(400).json({ success: false, message: 'Content must be a string' });
      }
      if (content.length > 500) {
        return res.status(400).json({ success: false, message: 'Feedback cannot exceed 500 characters' });
      }
    }

    // Check order exists and belongs to current user
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Only allow edit feedback when order is delivered
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be edited when the order is delivered',
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

    // Check if there is existing feedback to edit
    const hasExistingFeedback = orderDetail.feedback && (
      (orderDetail.feedback.rating && orderDetail.feedback.rating !== null) ||
      (orderDetail.feedback.content && orderDetail.feedback.content.trim() !== '')
    );

    if (!hasExistingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'No existing feedback to edit. Use add feedback instead.',
      });
    }

    // Create update object
    const updateData = {};
    if (rating !== undefined) {
      updateData['feedback.rating'] = rating;
    }
    if (content !== undefined) {
      updateData['feedback.content'] = content === null ? null : content.trim();
    }
    // Update updatedAt when editing
    updateData['feedback.updatedAt'] = new Date();

    // Update directly in database
    const savedOrderDetail = await OrderDetails.findByIdAndUpdate(
      orderDetail._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!savedOrderDetail) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update feedback in database'
      });
    }

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
    res.status(500).json({
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