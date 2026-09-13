const Order = require('../models/Order');
const Accounts = require("../models/Account");
const mongoose = require("mongoose");
const OrderDetail = require('../models/OrderDetail');
const ProductVariants = require("../models/ProductVariant");
const NewCart = require('../models/newCartModel');
const { applyVoucher } = require('../controllers/voucherController');

async function getOrderByIdService(id, user) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid order ID");
    err.status = 400;
    throw err;
  }

  const order = await Order.findById(id)
    .populate({
      path: 'acc_id',
      select: 'username name email phone address image'
    })
    .populate({
      path: 'voucher_id',
      select: 'code voucher_name discountType discountValue discount_percentage discount_amount minOrderValue maxDiscountAmount usedCount usageLimit startDate endDate isActive'
    })
    .populate({
      path: 'orderDetails',
      select: 'variant_id UnitPrice Quantity feedback',
      populate: {
        path: 'variant_id',
        select: 'productId productColorId productSizeId variantImage',
        populate: [
          {
            path: 'productId',
            select: 'productName'
          },
          {
            path: 'productColorId',
            select: 'color_name'
          },
          {
            path: 'productSizeId',
            select: 'size_name'
          }
        ]
      }
    });

  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    order.acc_id._id.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only view own order");
    err.status = 403;
    throw err;
  }

  return order;
}

async function updateOrderService(id, updateData, user) {
  const order = await Order.findById(id);
  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    order.acc_id.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only update own order");
    err.status = 403;
    throw err;
  }

  const { acc_id, username, ...rest } = updateData;
  if (acc_id || username) {
    const err = new Error("Updating account info is not allowed");
    err.status = 400;
    throw err;
  }

  // Check if order is finalized
  // Only block updates if:
  // 1. Order is delivered (final state)
  // 2. Order is cancelled AND paid AND refunded (VNPAY only - fully processed)
  // Note: Cancelled + paid orders can still be updated for refund management
  const isFinalized =
    order.order_status === "delivered" ||
    (order.payment_method === "VNPAY" &&
      order.order_status === "cancelled" &&
      order.pay_status === "paid" &&
      order.refund_status === "refunded");

  if (isFinalized) {
    const err = new Error("This order is finalized and cannot be updated");
    err.status = 400;
    throw err;
  }

  const allowedTransitions = {
    pending: ["confirmed", "shipping", "delivered", "cancelled"],
    confirmed: ["shipping", "delivered"],
    shipping: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  // For VNPAY orders, if unpaid, only allow cancellation
  if (order.payment_method === "VNPAY" && order.pay_status === "unpaid") {
    if (rest.order_status && rest.order_status !== "cancelled") {
      const err = new Error("VNPAY unpaid orders can only be cancelled");
      err.status = 400;
      throw err;
    }
  }

  const currentStatus = order.order_status;
  if (
    rest.order_status &&
    !allowedTransitions[currentStatus].includes(rest.order_status)
  ) {
    const err = new Error(
      `Invalid status transition: ${currentStatus} → ${rest.order_status}. Allowed: ${allowedTransitions[currentStatus].join(", ") || "none"}`
    );
    err.status = 400;
    throw err;
  }

  const newStatus = rest.order_status || order.order_status;
  let newPayStatus = rest.pay_status || order.pay_status;
  let newRefund = rest.refund_status || order.refund_status;

  // Validate cancelReason only when transitioning TO cancelled (not when already cancelled)
  // If order is already cancelled and we're only updating refund_proof or refund_status, don't require cancelReason
  const isTransitioningToCancelled = rest.order_status === "cancelled" && order.order_status !== "cancelled";
  const isOnlyUpdatingRefund = !rest.order_status && !rest.pay_status && (rest.refund_status || rest.refund_proof);

  if (isTransitioningToCancelled) {
    // Only require cancelReason when actually cancelling the order
    if (!rest.cancelReason || typeof rest.cancelReason !== 'string' || rest.cancelReason.length > 500) {
      const err = new Error("A valid cancel reason (up to 500 characters) is required when cancelling an order");
      err.status = 400;
      throw err;
    }
  } else if (isOnlyUpdatingRefund) {
    // When only updating refund (proof or status), keep existing cancelReason
    // Don't modify cancelReason
  } else {
    // Ensure cancelReason is set to empty string if not cancelling
    rest.cancelReason = '';
  }

  if (newStatus === "delivered") {
    newPayStatus = "paid";
  }

  if (order.payment_method === "COD") {
    if (
      ["pending", "confirmed", "shipping"].includes(newStatus) &&
      newPayStatus === "paid"
    ) {
      const err = new Error("COD orders cannot be paid before delivery");
      err.status = 400;
      throw err;
    }
  }

  if (order.payment_method === "VNPAY") {
    if (newStatus !== "cancelled" && newPayStatus !== "paid") {
      const err = new Error("VNPAY orders must remain paid unless cancelled");
      err.status = 400;
      throw err;
    }

    if (newStatus === "cancelled" && newPayStatus === "paid") {
      if (order.refund_status === "pending_refund") {
        const keys = Object.keys(rest);
        const allowedKeys = ["refund_status", "refund_proof", "cancelReason"];
        const hasInvalidUpdate = keys.some((k) => !allowedKeys.includes(k));
        if (hasInvalidUpdate) {
          const err = new Error(
            "When order is cancelled+paid (pending_refund), only refund_status, refund_proof, or cancelReason can be updated"
          );
          err.status = 400;
          throw err;
        }
        if (!["pending_refund", "refunded"].includes(newRefund)) {
          const err = new Error(
            "Refund status must be pending_refund or refunded"
          );
          err.status = 400;
          throw err;
        }
      } else {
        if (!["pending_refund", "refunded"].includes(newRefund)) {
          const err = new Error(
            "Cancelled paid VNPAY orders must have refund_status = pending_refund or refunded"
          );
          err.status = 400;
          throw err;
        }
      }
    }
  }

  rest.pay_status = newPayStatus;
  rest.refund_status = newRefund;

  const updatedOrder = await Order.findByIdAndUpdate(
    id,
    { ...rest },
    { new: true, runValidators: true }
  ).populate("acc_id", "username name phone");

  return updatedOrder;
}

async function getAllOrdersForAdminService() {
  const orders = await Order.find()
    .populate("acc_id", "username name email phone")
    .sort({ orderDate: -1 });

  return orders;
}

async function getUserOrdersService(acc_id) {
  if (!mongoose.isValidObjectId(acc_id)) {
    const err = new Error("Invalid account ID");
    err.status = 400;
    throw err;
  }
  const orders = await Order.find({ acc_id })
    .populate({
      path: 'acc_id',
      select: 'username name email phone address image'
    })
    .populate({
      path: 'voucher_id',
      select: 'code voucher_name discountType discountValue discount_percentage discount_amount'
    })
    .populate({
      path: 'orderDetails',
      select: 'variant_id UnitPrice Quantity feedback',
      populate: {
        path: 'variant_id',
        select: 'productId productColorId productSizeId variantImage',
        populate: [
          {
            path: 'productId',
            select: 'productName'
          },
          {
            path: 'productColorId',
            select: 'color_name'
          },
          {
            path: 'productSizeId',
            select: 'size_name'
          }
        ]
      }
    })
    .sort({ orderDate: -1 });
  return orders;
}

async function createOrderService(userId, checkoutData) {
  const { name, addressReceive, phone, totalPrice, payment_method, voucherCode, items } = checkoutData;

  const account = await Accounts.findById(userId);
  if (!account) {
    const err = new Error("Account not found");
    err.statusCode = 404;
    throw err;
  }

  // tính toán voucher (nếu có)
  let voucher = null;
  let discountAmount = 0;
  let finalPrice = totalPrice;

  if (voucherCode) {
    try {
      const result = await applyVoucher(voucherCode, totalPrice);
      if (result.success && result.data) {
        voucher = result.data.voucher;
        discountAmount = result.data.discountAmount;
        finalPrice = result.data.finalPrice;
      }
    } catch (err) {
      // bỏ qua voucher, giữ nguyên giá gốc
    }
  }

  // tạo order
  const newOrder = new Order({
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

  if (voucher) {
    voucher.usedCount += 1;
    await voucher.save();
  }

  // tạo order details từ items
  const orderDetailsToSave = [];
  const boughtVariantIds = [];
  for (const item of items) {
    const { variant_id, UnitPrice, Quantity, feedback_details } = item;

    const variant = await ProductVariants.findById(variant_id);
    if (!variant) {
      const err = new Error(`Product variant not found: ${variant_id}`);
      err.statusCode = 404;
      throw err;
    }

    if (variant.stockQuantity < Quantity) {
      const err = new Error(`Insufficient stock for variant ${variant_id}. Available: ${variant.stockQuantity}, Requested: ${Quantity}`);
      err.statusCode = 400;
      throw err;
    }

    const orderDetail = new OrderDetail({
      order_id: savedOrder._id,
      variant_id,
      UnitPrice,
      Quantity,
      feedback: {
        content: feedback_details || '',
        rating: null,
        created_at: null,
        updated_at: null,
        is_deleted: false
      },
    });
    const savedDetail = await orderDetail.save();
    orderDetailsToSave.push(savedDetail);
    boughtVariantIds.push(variant_id.toString());
  }

  const orderDetailsIds = orderDetailsToSave.map(detail => detail._id);
  savedOrder.orderDetails = orderDetailsIds;
  await savedOrder.save();

  // Trừ số lượng sản phẩm khỏi kho
  for (const item of items) {
    const { variant_id, Quantity } = item;
    const variant = await ProductVariants.findById(variant_id);
    if (variant) {
      variant.stockQuantity -= Quantity;
      await variant.save();
    }
  }

  // XÓA CÁC SẢN PHẨM ĐÃ MUA KHỎI CART
  const objectUserId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  const objectVariantIds = boughtVariantIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

  await NewCart.deleteMany({
    accountId: objectUserId,
    variantId: { $in: objectVariantIds }
  });

  return {
    savedOrder,
    orderDetailsToSave,
    orderDetailsIds,
    voucher
  };
}

module.exports = {
  getAllOrdersForAdminService,
  getOrderByIdService,
  updateOrderService,
  getUserOrdersService,
  createOrderService
};