// orderController.js
const orderService = require('../services/orderService');
const vnpayService = require('../services/vnpayService');



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
      order_status: order.order_status,
      pay_status: order.pay_status,
      payment_method: order.payment_method,
      refund_status: order.refund_status,
      refund_proof: order.refund_proof,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      // Customer information
      customer: {
        _id: order.acc_id._id,
        username: order.acc_id.username,
        name: order.acc_id.name,
        email: order.acc_id.email,
        phone: order.acc_id.phone,
        address: order.acc_id.address,
        image: order.acc_id.image
      },

      // Voucher information (if exists)
      voucher: order.voucher_id ? {
        _id: order.voucher_id._id,
        code: order.voucher_id.code,
        voucher_name: order.voucher_id.voucher_name,
        discountType: order.voucher_id.discountType,
        discountValue: order.voucher_id.discountValue,
        discount_percentage: order.voucher_id.discount_percentage,
        discount_amount: order.voucher_id.discount_amount,
      } : null,

      // Order details with product information
      orderDetails: order.orderDetails ? order.orderDetails.map(detail => ({
        _id: detail._id,
        variant: detail.variant_id ? {
          _id: detail.variant_id._id,
          product: detail.variant_id.productId ? {
            _id: detail.variant_id.productId._id,
            name: detail.variant_id.productId.productName
          } : null,
          color: detail.variant_id.productColorId ? {
            _id: detail.variant_id.productColorId._id,
            name: detail.variant_id.productColorId.color_name
          } : null,
          size: detail.variant_id.productSizeId ? {
            _id: detail.variant_id.productSizeId._id,
            name: detail.variant_id.productSizeId.size_name
          } : null,
          image: detail.variant_id.variantImage || null
        } : null,
        unitPrice: detail.UnitPrice,
        quantity: detail.Quantity,
        totalPrice: detail.UnitPrice * detail.Quantity,
        feedback: detail.feedback ? {
          rating: detail.feedback.rating,
          content: detail.feedback.content,
          created_at: detail.feedback.created_at,
          updated_at: detail.feedback.updated_at,
          is_deleted: detail.feedback.is_deleted,
          has_rating: detail.feedback.rating !== null && detail.feedback.rating !== undefined,
          has_content: detail.feedback.content && detail.feedback.content.trim() !== ''
        } : null
      })) : [],


      // Summary
      summary: {
        totalItems: order.orderDetails ? order.orderDetails.length : 0,
        totalQuantity: order.orderDetails ? order.orderDetails.reduce((sum, detail) => sum + detail.Quantity, 0) : 0,
        hasVoucher: !!order.voucher_id,
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
    // Chỉ admin và staff mới có thể cập nhật đơn hàng
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Access denied: Admin/Staff role required' });
    }

    // Validate orderId
    const { orderId } = req.params;
    if (!orderId || !orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid order ID format' });
    }

    const { order_status, pay_status, refund_status, refund_proof } = req.body;

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

    // Chỉ cho phép cập nhật các trường cơ bản, không bao gồm feedback
    const allowedFields = { order_status, pay_status, refund_status, refund_proof };
    const filteredData = Object.fromEntries(
      Object.entries(allowedFields).filter(([key, value]) => value !== undefined)
    );

    const updatedOrder = await orderService.updateOrderService(orderId, filteredData, req.user);
    const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) {
      const userId = typeof updatedOrder.acc_id === 'object' && updatedOrder.acc_id._id
        ? updatedOrder.acc_id._id.toString()
        : updatedOrder.acc_id.toString();
      io.emit('orderUpdated', { userId, order: updatedOrder });
    }
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
const newProductVariants = require("../models/newProductVariant");
const newProducts = require("../models/newProduct");
const newProductImages = require("../models/newProductImage");
const ProductColors = require("../models/ProductColors");
const ProductSizes = require("../models/ProductSizes");
const Voucher = require("../models/Voucher");
const NewCart = require('../models/newCartModel');
const { applyVoucher } = require('./voucherController');

exports.checkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, addressReceive, phone, totalPrice, payment_method, voucherCode, items } = req.body;

    // validate input - name is the recipient's name (who will receive the order)
    if (!name || !addressReceive || !phone || !totalPrice || !payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, addressReceive, phone, totalPrice, payment_method, items' });
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
        // bỏ qua voucher, giữ nguyên giá gốc
      }
    }

    // tạo order
    const newOrder = new Orders({
      acc_id: userId,
      name,
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

      const variant = await newProductVariants.findById(variant_id);
      if (!variant) {
        return res.status(404).json({ success: false, message: `Product variant not found: ${variant_id}` });
      }

      // Kiểm tra số lượng tồn kho
      if (variant.stockQuantity < Quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for variant ${variant_id}. Available: ${variant.stockQuantity}, Requested: ${Quantity}`
        });
      }

      const orderDetail = new OrderDetails({
        order_id: savedOrder._id,
        variant_id,
        UnitPrice,
        Quantity,
        feedback_details: feedback_details || '',
      });
      const savedDetail = await orderDetail.save();
      orderDetailsToSave.push(savedDetail);
      boughtVariantIds.push(variant_id.toString());
    }

    // Lấy orderDetailsId từ saved order details
    const orderDetailsIds = orderDetailsToSave.map(detail => detail._id);

    // Lưu orderDetailsId vào order.orderDetails
    savedOrder.orderDetails = orderDetailsIds;
    await savedOrder.save();

    // Trừ số lượng sản phẩm khỏi kho
    for (const item of items) {
      const { variant_id, Quantity } = item;
      const variant = await newProductVariants.findById(variant_id);
      if (variant) {
        variant.stockQuantity -= Quantity;
        await variant.save();
      }
    }

    // XÓA CÁC SẢN PHẨM ĐÃ MUA KHỎI CART (chỉ xóa đúng sản phẩm đã mua của user)
    const objectUserId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const objectVariantIds = boughtVariantIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

    await NewCart.deleteMany({
      accountId: objectUserId,
      variantId: { $in: objectVariantIds }
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully with details, cart cleared',
      data: {
        order: {
          _id: savedOrder._id,
          acc_id: savedOrder.acc_id,
          addressReceive: savedOrder.addressReceive,
          phone: savedOrder.phone,
          totalPrice: savedOrder.totalPrice,
          voucher_id: savedOrder.voucher_id,
          discountAmount: savedOrder.discountAmount,
          finalPrice: savedOrder.finalPrice,
          order_status: savedOrder.order_status,
          pay_status: savedOrder.pay_status,
          payment_method: savedOrder.payment_method,
          orderDate: savedOrder.orderDate,
          orderDetails: orderDetailsIds
        },
        orderDetails: orderDetailsToSave.map(detail => ({
          _id: detail._id,
          order_id: detail.order_id,
          variant_id: detail.variant_id,
          UnitPrice: detail.UnitPrice,
          Quantity: detail.Quantity,
          feedback: detail.feedback
        })),
        orderDetailsIds: orderDetailsIds,
        voucher: voucher ? {
          _id: voucher._id,
          code: voucher.code,
          voucher_name: voucher.voucher_name,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          discount_percentage: voucher.discount_percentage,
          discount_amount: voucher.discount_amount,
          minOrderValue: voucher.minOrderValue,
          maxDiscountAmount: voucher.maxDiscountAmount,
          usedCount: voucher.usedCount,
          usageLimit: voucher.usageLimit,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
          isActive: voucher.isActive
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
    return res.status(500).json({ success: false, message: error.message || 'Error retrieving order' });
  }
};


exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Lấy thông tin order hiện tại với voucher
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Chỉ cho phép hủy khi trạng thái là pending
    if (order.order_status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    // Xử lý voucher nếu order có sử dụng voucher
    if (order.voucher_id) {

      const voucher = await Voucher.findById(order.voucher_id);

      if (voucher) {
        // Giảm usedCount của voucher (hoàn lại số lần sử dụng)
        if (voucher.usedCount > 0) {
          voucher.usedCount -= 1;
          await voucher.save();
        }
      }
    }

    // Hoàn lại số lượng sản phẩm vào kho
    if (order.orderDetails && order.orderDetails.length > 0) {
      for (const orderDetail of order.orderDetails) {
        if (orderDetail.variant_id) {
          const variant = await newProductVariants.findById(orderDetail.variant_id);
          if (variant) {
            // Cộng lại số lượng đã mua vào stock
            variant.stockQuantity += orderDetail.Quantity;
            await variant.save();
          }
        }
      }
    }

    // Cập nhật trạng thái sang cancelled
    const updatedOrder = await orderService.updateOrderService(
      orderId,
      { order_status: 'cancelled' },
      req.user
    );

    res.status(200).json({
      message: 'Order cancelled successfully',
      order: updatedOrder,
      voucherRefunded: order.voucher_id ? true : false,
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

    // Kiểm tra order tồn tại và thuộc user hiện tại
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }


    // Chỉ cho phép feedback khi đơn hàng đã giao
    if (order.order_status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be added when the order is delivered',
      });
    }

    // Tìm chi tiết sản phẩm trong đơn hàng
    const orderDetail = await OrderDetails.findOne({
      order_id: orderId,
      variant_id: variantId,
    });

    if (!orderDetail) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in this order',
      });
    }

    // Tạo update object
    const updateData = {};
    if (rating !== undefined) {
      updateData['feedback.rating'] = rating;
    }
    if (content !== undefined) {
      updateData['feedback.content'] = content === null ? null : content.trim();
    }
    // Reset is_deleted và set timestamps khi tạo feedback mới
    updateData['feedback.is_deleted'] = false;
    updateData['feedback.created_at'] = new Date();
    updateData['feedback.updated_at'] = new Date();

    // Cập nhật trực tiếp vào database
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

    // Verify từ database
    const verifyOrderDetail = await OrderDetails.findById(orderDetail._id);


    res.status(200).json({
      success: true,
      message: 'Product feedback added successfully',
      feedback: savedOrderDetail.feedback,
      orderDetail: {
        _id: savedOrderDetail._id,
        order_id: savedOrderDetail.order_id,
        variant_id: savedOrderDetail.variant_id,
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



// Hàm sửa feedback của user cho một sản phẩm cụ thể trong một order cụ thể
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

    // Kiểm tra order tồn tại và thuộc user hiện tại
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Chỉ cho phép edit feedback khi đơn hàng đã giao
    if (order.order_status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be edited when the order is delivered',
      });
    }

    // Tìm chi tiết sản phẩm trong đơn hàng
    const orderDetail = await OrderDetails.findOne({
      order_id: orderId,
      variant_id: variantId,
    });

    if (!orderDetail) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in this order',
      });
    }

    // Kiểm tra feedback có bị xóa không
    if (orderDetail.feedback && orderDetail.feedback.is_deleted === true) {
      return res.status(404).json({
        success: false,
        message: 'Feedback has been deleted',
      });
    }

    // Kiểm tra xem có feedback để edit không
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

    // Tạo update object
    const updateData = {};
    if (rating !== undefined) {
      updateData['feedback.rating'] = rating;
    }
    if (content !== undefined) {
      updateData['feedback.content'] = content === null ? null : content.trim();
    }
    // Cập nhật updated_at khi edit
    updateData['feedback.updated_at'] = new Date();

    // Cập nhật trực tiếp vào database
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
        order_id: savedOrderDetail.order_id,
        variant_id: savedOrderDetail.variant_id,
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

// Hàm xóa feedback của user cho một sản phẩm cụ thể trong một order cụ thể
exports.deleteFeedbackProduct = async (req, res) => {
  try {
    const { orderId, variantId } = req.params;

    // Validate IDs
    if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or variant ID' });
    }

    // Kiểm tra order tồn tại và thuộc user hiện tại
    const order = await orderService.getOrderByIdService(orderId, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Chỉ cho phép xóa feedback khi đơn hàng đã giao
    if (order.order_status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be deleted when the order is delivered',
      });
    }

    // Tìm chi tiết sản phẩm trong đơn hàng
    const orderDetail = await OrderDetails.findOne({
      order_id: orderId,
      variant_id: variantId,
    });

    if (!orderDetail) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in this order',
      });
    }

    // Kiểm tra feedback có bị xóa không
    if (orderDetail.feedback && orderDetail.feedback.is_deleted === true) {
      return res.status(404).json({
        success: false,
        message: 'Feedback has been deleted',
      });
    }

    // Kiểm tra xem có feedback để xóa không
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

    // Soft delete feedback (set is_deleted = true)
    console.log('Deleting feedback for orderDetail:', orderDetail._id);
    const savedOrderDetail = await OrderDetails.findByIdAndUpdate(
      orderDetail._id,
      {
        $set: {
          'feedback.is_deleted': true,
          'feedback.updated_at': new Date()
        }
      },
      { new: true, runValidators: true }
    );
    console.log('Feedback deleted, is_deleted:', savedOrderDetail.feedback.is_deleted);

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
        created_at: savedOrderDetail.feedback.created_at,
        updated_at: savedOrderDetail.feedback.updated_at,
        is_deleted: true
      },
      orderDetail: {
        _id: savedOrderDetail._id,
        order_id: savedOrderDetail.order_id,
        variant_id: savedOrderDetail.variant_id,
        feedback: {
          rating: savedOrderDetail.feedback.rating,
          content: savedOrderDetail.feedback.content,
          created_at: savedOrderDetail.feedback.created_at,
          updated_at: savedOrderDetail.feedback.updated_at,
          is_deleted: true
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

// Hàm lấy tất cả feedback của một sản phẩm (tất cả variants của product) để hiển thị trên trang product
exports.getAllFeedbackOfProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const currentUserId = req.user ? req.user.id : null; // Lấy user hiện tại nếu có

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

    // Kiểm tra product có tồn tại không
    const product = await newProducts.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Lấy tất cả variants của product này
    const allVariantsOfProduct = await newProductVariants.find({
      productId: productId
    }).select('_id');

    const variantIds = allVariantsOfProduct.map(v => v._id);

    // Tìm tất cả feedback của tất cả variants thuộc product này
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

    // Lấy tất cả feedback trước để sắp xếp custom
    const allFeedbacks = await OrderDetails.find(query)
      .populate({
        path: 'order_id',
        select: 'orderDate order_status acc_id',
        populate: {
          path: 'acc_id',
          select: 'username name image email phone'
        }
      })
      .populate({
        path: 'variant_id',
        select: 'productColorId productSizeId variantImage',
        populate: [
          {
            path: 'productColorId',
            select: 'color_name'
          },
          {
            path: 'productSizeId',
            select: 'size_name'
          }
        ]
      })
      .sort({ 'order_id.orderDate': -1 }); // Sắp xếp theo thời gian trước

    // Custom sorting: feedback của user hiện tại lên đầu, sau đó theo thời gian
    const sortedFeedbacks = allFeedbacks.sort((a, b) => {
      // Nếu có user hiện tại đăng nhập
      if (currentUserId) {
        const aIsCurrentUser = a.order_id.acc_id._id.toString() === currentUserId;
        const bIsCurrentUser = b.order_id.acc_id._id.toString() === currentUserId;

        // Ưu tiên 1: Feedback của user hiện tại lên đầu tiên
        if (aIsCurrentUser && !bIsCurrentUser) return -1;  // a lên đầu
        if (bIsCurrentUser && !aIsCurrentUser) return 1;   // b lên đầu

        // Ưu tiên 2: Sắp xếp theo thời gian (mới nhất trước)
        const aDate = new Date(a.order_id.orderDate);
        const bDate = new Date(b.order_id.orderDate);
        return bDate - aDate; // Mới nhất trước
      }

      // Nếu không có user đăng nhập -> chỉ sắp xếp theo thời gian
      const aDate = new Date(a.order_id.orderDate);
      const bDate = new Date(b.order_id.orderDate);
      return bDate - aDate; // Mới nhất trước
    });

    // Lấy tổng số feedback
    const totalFeedbacks = sortedFeedbacks.length;

    // Tính toán thống kê với rating
    const feedbacksWithRating = allFeedbacks.filter(f => f.feedback.rating && f.feedback.rating !== null);
    const totalRatings = feedbacksWithRating.length;
    const averageRating = totalRatings > 0
      ? feedbacksWithRating.reduce((sum, feedback) => sum + feedback.feedback.rating, 0) / totalRatings
      : 0;

    // Tính % rating thay vì count
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
      order_id: feedback.order_id._id,
      order_date: feedback.order_id.orderDate,
      order_status: feedback.order_id.order_status,
      customer: {
        user_id: feedback.order_id.acc_id._id,
        username: feedback.order_id.acc_id.username,
        name: feedback.order_id.acc_id.name,
        image: feedback.order_id.acc_id.image,
        email: feedback.order_id.acc_id.email,
        phone: feedback.order_id.acc_id.phone,
        is_current_user: currentUserId ? feedback.order_id.acc_id._id.toString() === currentUserId : false
      },
      variant: feedback.variant_id ? {
        variant_id: feedback.variant_id._id,
        color: feedback.variant_id.productColorId ? feedback.variant_id.productColorId.color_name : null,
        size: feedback.variant_id.productSizeId ? feedback.variant_id.productSizeId.size_name : null,
        image: feedback.variant_id.variantImage || null
      } : null,
      feedback: {
        rating: feedback.feedback.rating,
        content: feedback.feedback.content,
        created_at: feedback.feedback.created_at,
        updated_at: feedback.feedback.updated_at,
        is_deleted: feedback.feedback.is_deleted,
        has_rating: feedback.feedback.rating !== null,
        has_content: feedback.feedback.content && feedback.feedback.content.trim() !== ''
      },
      unit_price: feedback.UnitPrice,
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
    // Chỉ admin và manager mới có thể truy cập
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