const Orders = require("../models/Orders");
const Accounts = require("../models/Accounts");
const mongoose = require("mongoose");
const OrderDetails = require("../models/OrderDetails");

async function searchOrdersService(queryParams, user) {
  const {
    q,
    accountId,
    orderStatus,
    payStatus,
    dateFrom,
    dateTo,
    minPrice,
    maxPrice,
  } = queryParams;
  let query = {};
  if (user.role !== "admin" && user.role !== "manager") {
    query.accountId = user.id;
  } else if (accountId) {
    if (!mongoose.isValidObjectId(accountId)) {
      const err = new Error("Invalid account ID");
      err.status = 400;
      throw err;
    }
    query.accountId = accountId;
  }
  if (orderStatus && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(orderStatus)) {
    const err = new Error("Invalid order status");
    err.status = 400;
    throw err;
  }
  if (payStatus && !['unpaid', 'paid'].includes(payStatus)) {
    const err = new Error("Invalid pay status");
    err.status = 400;
    throw err;
  }
  if (orderStatus) query.orderStatus = orderStatus;
  if (payStatus) query.payStatus = payStatus;
  if (dateFrom || dateTo) {
    query.orderDate = {};
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate)) query.orderDate.$gte = fromDate;
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate)) {
        toDate.setHours(23, 59, 59, 999);
        query.orderDate.$lte = toDate;
      }
    }
    if (Object.keys(query.orderDate).length === 0) delete query.orderDate;
  }
  if (minPrice || maxPrice) {
    query.totalPrice = {};
    if (minPrice && !isNaN(parseFloat(minPrice)))
      query.totalPrice.$gte = parseFloat(minPrice);
    if (maxPrice && !isNaN(parseFloat(maxPrice)))
      query.totalPrice.$lte = parseFloat(maxPrice);
    if (Object.keys(query.totalPrice).length === 0) delete query.totalPrice;
  }
  let orderIdsByProduct = [];
  if (q && typeof q === "string" && q.trim() !== "") {
    const trimmedQuery = q.trim();
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateMatch = trimmedQuery.match(dateRegex);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const year = parseInt(dateMatch[3], 10);
      const startDate = new Date(year, month, day, 0, 0, 0, 0);
      const endDate = new Date(year, month, day, 23, 59, 59, 999);
      query.orderDate = { $gte: startDate, $lte: endDate };
    } else {
      const matchingDetails = await OrderDetails.find().populate({
        path: "variantId",
        populate: {
          path: "productId",
          model: "newProducts",
          match: { productName: { $regex: trimmedQuery, $options: "i" } },
        },
      });
      orderIdsByProduct = matchingDetails
        .filter((d) => d.variantId && d.variantId.productId)
        .map((d) => d.orderId.toString());
      query.$or = [
        { orderStatus: { $regex: trimmedQuery, $options: "i" } },
        { payStatus: { $regex: trimmedQuery, $options: "i" } },
        { addressReceive: { $regex: trimmedQuery, $options: "i" } },
        { phone: { $regex: trimmedQuery, $options: "i" } },
      ];
      if (mongoose.isValidObjectId(trimmedQuery)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(trimmedQuery) });
      }
      if (orderIdsByProduct.length > 0) {
        query.$or.push({ _id: { $in: orderIdsByProduct.map(id => new mongoose.Types.ObjectId(id)) } });
      }
    }
  }
  return await Orders.find(query).populate("accountId", "username name");
}

async function getOrderByIdService(id, user) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid order ID");
    err.status = 400;
    throw err;
  }

  const order = await Orders.findById(id)
    .populate({
      path: 'accountId',
      select: 'username name email phone address image'
    })
    .populate({
      path: 'voucherId',
      select: 'code voucher_name discountType discountValue discount_percentage discount_amount minOrderValue maxDiscountAmount usedCount usageLimit startDate endDate isActive'
    })
    .populate({
      path: 'orderDetails',
      select: 'variantId unitPrice Quantity feedback',
      populate: {
        path: 'variantId',
        select: 'productId productColorId productSizeId variantImage',
        // Include all variants (discontinued, inactive, etc.) so customers can view their order history
        match: {}, // No filter - include all variants regardless of status
        populate: [
          {
            path: 'productId',
            select: 'productName',
            // Include all products (discontinued, inactive, etc.) so customers can view their order history
            match: {} // No filter - include all products regardless of status
          },
          {
            path: 'productColorId',
            select: 'productColorName'
          },
          {
            path: 'productSizeId',
            select: 'productSizeName'
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
    order.accountId._id.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only view own order");
    err.status = 403;
    throw err;
  }

  return order;
}

async function updateOrderService(id, updateData, user) {
  const order = await Orders.findById(id);
  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    order.accountId.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only update own order");
    err.status = 403;
    throw err;
  }

  const { accountId, username, ...rest } = updateData;
  if (accountId || username) {
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
    order.orderStatus === "delivered" ||
    (order.paymentMethod === "VNPAY" &&
      order.orderStatus === "cancelled" &&
      order.payStatus === "paid" &&
      order.refundStatus === "refunded");

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
  if (order.paymentMethod === "VNPAY" && order.payStatus === "unpaid") {
    if (rest.orderStatus && rest.orderStatus !== "cancelled") {
      const err = new Error("VNPAY unpaid orders can only be cancelled");
      err.status = 400;
      throw err;
    }
  }

  const currentStatus = order.orderStatus;
  if (
    rest.orderStatus &&
    !allowedTransitions[currentStatus].includes(rest.orderStatus)
  ) {
    const err = new Error(
      `Invalid status transition: ${currentStatus} → ${rest.orderStatus}. Allowed: ${allowedTransitions[currentStatus].join(", ") || "none"}`
    );
    err.status = 400;
    throw err;
  }

  const newStatus = rest.orderStatus || order.orderStatus;
  let newPayStatus = rest.payStatus || order.payStatus;
  let newRefund = rest.refundStatus || order.refundStatus;

  // Validate cancelReason only when transitioning TO cancelled (not when already cancelled)
  // If order is already cancelled and we're only updating refundProof or refundStatus, don't require cancelReason
  const isTransitioningToCancelled = rest.orderStatus === "cancelled" && order.orderStatus !== "cancelled";
  const isOnlyUpdatingRefund = !rest.orderStatus && !rest.payStatus && (rest.refundStatus || rest.refundProof);

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

  if (order.paymentMethod === "COD") {
    if (
      ["pending", "confirmed", "shipping"].includes(newStatus) &&
      newPayStatus === "paid"
    ) {
      const err = new Error("COD orders cannot be paid before delivery");
      err.status = 400;
      throw err;
    }
  }

  if (order.paymentMethod === "VNPAY") {
    if (newStatus !== "cancelled" && newPayStatus !== "paid") {
      const err = new Error("VNPAY orders must remain paid unless cancelled");
      err.status = 400;
      throw err;
    }

    if (newStatus === "cancelled" && newPayStatus === "paid") {
      if (order.refundStatus === "pending_refund") {
        const keys = Object.keys(rest);
        const allowedKeys = ["refundStatus", "refundProof", "cancelReason"];
        const hasInvalidUpdate = keys.some((k) => !allowedKeys.includes(k));
        if (hasInvalidUpdate) {
          const err = new Error(
            "When order is cancelled+paid (pending_refund), only refundStatus, refundProof, or cancelReason can be updated"
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
            "Cancelled paid VNPAY orders must have refundStatus = pending_refund or refunded"
          );
          err.status = 400;
          throw err;
        }
      }
    }
  }

  rest.payStatus = newPayStatus;
  rest.refundStatus = newRefund;

  const updatedOrder = await Orders.findByIdAndUpdate(
    id,
    { ...rest },
    { new: true, runValidators: true }
  ).populate("accountId", "username name phone");

  return updatedOrder;
}

async function deleteOrderService(id, user) {
  const order = await Orders.findById(id);
  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }
  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    order.accountId.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only delete own order");
    err.status = 403;
    throw err;
  }
  if (order.orderStatus !== 'pending') {
    const err = new Error("Orders can only be deleted when the status is pending");
    err.status = 400;
    throw err;
  }
  await Orders.findByIdAndDelete(id);
  return { message: "Order deleted successfully" };
}

async function getAllOrdersForAdminService() {
  const orders = await Orders.find()
    .populate("accountId", "username name email phone")
    .sort({ orderDate: -1 });

  return orders;
}

async function getUserOrdersService(accountId) {
  if (!mongoose.isValidObjectId(accountId)) {
    const err = new Error("Invalid account ID");
    err.status = 400;
    throw err;
  }
  const orders = await Orders.find({ accountId })
    .populate({
      path: 'accountId',
      select: 'username name email phone address image'
    })
    .populate({
      path: 'voucherId',
      select: 'code voucher_name discountType discountValue discount_percentage discount_amount'
    })
    .populate({
      path: 'orderDetails',
      select: 'variantId unitPrice Quantity feedback',
      populate: {
        path: 'variantId',
        select: 'productId productColorId productSizeId variantImage',
        // Include all variants (discontinued, inactive, etc.) so customers can view their order history
        match: {}, // No filter - include all variants regardless of status
        populate: [
          {
            path: 'productId',
            select: 'productName',
            // Include all products (discontinued, inactive, etc.) so customers can view their order history
            match: {} // No filter - include all products regardless of status
          },
          {
            path: 'productColorId',
            select: 'productColorName'
          },
          {
            path: 'productSizeId',
            select: 'productSizeName'
          }
        ]
      }
    })
    .sort({ orderDate: -1 });
  return orders;
}

module.exports = {
  getAllOrdersForAdminService,
  searchOrdersService,
  getOrderByIdService,
  updateOrderService,
  deleteOrderService,
  getUserOrdersService
};