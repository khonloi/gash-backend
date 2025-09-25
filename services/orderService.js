// orderService.js
const Orders = require("../models/Orders");
const Accounts = require("../models/Accounts");
const mongoose = require("mongoose");
const OrderDetails = require("../models/OrderDetails");
const ProductVariants = require("../models/ProductVariants");

async function createOrderService(orderData, user) {
  const {
    acc_id,
    addressReceive,
    phone,
    totalPrice,
    order_status,
    pay_status,
    payment_method,
    refund_status,
    feedback_order,
  } = orderData;

  // Validate required fields and enums
  if (!acc_id || !addressReceive || !phone || !totalPrice || !payment_method) {
    const err = new Error("Missing required fields");
    err.status = 400;
    throw err;
  }
  if (!['COD', 'VNPAY'].includes(payment_method)) {
    const err = new Error("Invalid payment method");
    err.status = 400;
    throw err;
  }
  if (order_status && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(order_status)) {
    const err = new Error("Invalid order status");
    err.status = 400;
    throw err;
  }
  if (pay_status && !['unpaid', 'paid'].includes(pay_status)) {
    const err = new Error("Invalid pay status");
    err.status = 400;
    throw err;
  }
  if (refund_status && !['not_applicable', 'pending_refund', 'refunded'].includes(refund_status)) {
    const err = new Error("Invalid refund status");
    err.status = 400;
    throw err;
  }

  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    user.id !== acc_id.toString()
  ) {
    const err = new Error("Access denied: Can only create order for own account");
    err.status = 403;
    throw err;
  }
  const account = await Accounts.findById(acc_id);
  if (!account) {
    const err = new Error("Account not found");
    err.status = 404;
    throw err;
  }
  const order = new Orders({
    acc_id,
    addressReceive,
    phone,
    totalPrice,
    order_status: order_status || "pending",
    pay_status: pay_status || "unpaid",
    payment_method,
    refund_status: refund_status || "not_applicable",
    feedback_order: feedback_order || "",
  });
  return await order.save();
}

async function getAllOrdersService(user) {
  if (user.role === "admin" || user.role === "manager") {
    return await Orders.find().populate("acc_id", "username name");
  } else {
    return await Orders.find({ acc_id: user.id }).populate("acc_id", "username name");
  }
}

async function searchOrdersService(queryParams, user) {
  const {
    q,
    acc_id,
    order_status,
    pay_status,
    dateFrom,
    dateTo,
    minPrice,
    maxPrice,
  } = queryParams;
  let query = {};
  if (user.role !== "admin" && user.role !== "manager") {
    query.acc_id = user.id;
  } else if (acc_id) {
    if (!mongoose.isValidObjectId(acc_id)) {
      const err = new Error("Invalid account ID");
      err.status = 400;
      throw err;
    }
    query.acc_id = acc_id;
  }
  if (order_status && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(order_status)) {
    const err = new Error("Invalid order status");
    err.status = 400;
    throw err;
  }
  if (pay_status && !['unpaid', 'paid'].includes(pay_status)) {
    const err = new Error("Invalid pay status");
    err.status = 400;
    throw err;
  }
  if (order_status) query.order_status = order_status;
  if (pay_status) query.pay_status = pay_status;
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
        path: "variant_id",
        populate: {
          path: "pro_id",
          model: "Products",
          match: { pro_name: { $regex: trimmedQuery, $options: "i" } },
        },
      });
      orderIdsByProduct = matchingDetails
        .filter((d) => d.variant_id && d.variant_id.pro_id)
        .map((d) => d.order_id.toString());
      query.$or = [
        { order_status: { $regex: trimmedQuery, $options: "i" } },
        { pay_status: { $regex: trimmedQuery, $options: "i" } },
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
  return await Orders.find(query).populate("acc_id", "username name");
}

async function getOrderByIdService(id, user) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid order ID");
    err.status = 400;
    throw err;
  }
  const order = await Orders.findById(id).populate("acc_id", "username name");
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
  const order = await Orders.findById(id).populate("acc_id");
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
    const err = new Error("Access denied: Can only update own order");
    err.status = 403;
    throw err;
  }

  const { order_status, pay_status, refund_status, feedback_order } = updateData;

  // Validate enums
  if (order_status && !['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(order_status)) {
    const err = new Error("Invalid order status");
    err.status = 400;
    throw err;
  }
  if (pay_status && !['unpaid', 'paid'].includes(pay_status)) {
    const err = new Error("Invalid pay status");
    err.status = 400;
    throw err;
  }
  if (refund_status && !['not_applicable', 'pending_refund', 'refunded'].includes(refund_status)) {
    const err = new Error("Invalid refund status");
    err.status = 400;
    throw err;
  }

  // Prevent updates to immutable fields
  if (updateData.acc_id || updateData.addressReceive || updateData.phone || updateData.totalPrice || updateData.payment_method) {
    const err = new Error("Updating account info or payment method is not allowed");
    err.status = 400;
    throw err;
  }

  // Validate order status transitions
  const allowedTransitions = {
    pending: ["confirmed", "shipping", "delivered", "cancelled"],
    confirmed: ["shipping", "delivered"],
    shipping: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  const currentStatus = order.order_status;
  if (order_status && !allowedTransitions[currentStatus].includes(order_status)) {
    const err = new Error(
      `Invalid status transition: ${currentStatus} → ${order_status}. Allowed: ${allowedTransitions[currentStatus].join(", ") || "none"}`
    );
    err.status = 400;
    throw err;
  }

  // Business rules
  let newStatus = order_status || order.order_status;
  let newPayStatus = pay_status || order.pay_status;
  let newRefund = refund_status || order.refund_status;

  // Auto-set refund_status for VNPAY cancelled orders
  if (order.payment_method === "VNPAY" && newStatus === "cancelled" && newPayStatus === "paid") {
    if (!["pending_refund", "refunded"].includes(newRefund)) {
      newRefund = "pending_refund";
    }
  }

  // Auto-set pay_status to paid when delivered
  if (newStatus === "delivered") {
    newPayStatus = "paid";
  }

  // COD rules
  if (order.payment_method === "COD") {
    if (["pending", "confirmed", "shipping"].includes(newStatus) && newPayStatus === "paid") {
      const err = new Error("COD orders cannot be paid before delivery");
      err.status = 400;
      throw err;
    }
  }

  // VNPAY rules
  if (order.payment_method === "VNPAY") {
    if (newStatus !== "cancelled" && newPayStatus !== "paid") {
      const err = new Error("VNPAY orders must remain paid unless cancelled");
      err.status = 400;
      throw err;
    }
    if (newStatus === "cancelled" && newPayStatus === "paid") {
      if (order.refund_status === "pending_refund") {
        const keys = Object.keys(updateData);
        const allowedKeys = ["refund_status", "refund_proof"];
        const hasInvalidUpdate = keys.some((k) => !allowedKeys.includes(k));
        if (hasInvalidUpdate) {
          const err = new Error("When order is cancelled+paid (pending_refund), only refund_status/proof can be updated");
          err.status = 400;
          throw err;
        }
      }
    }
  }

  // Update order
  const updatedOrder = await Orders.findByIdAndUpdate(
    id,
    { order_status: newStatus, pay_status: newPayStatus, refund_status: newRefund, feedback_order },
    { new: true, runValidators: true }
  ).populate("acc_id", "username name phone");

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
    order.acc_id.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only delete own order");
    err.status = 403;
    throw err;
  }
  if (order.order_status !== 'pending') {
    const err = new Error("Orders can only be deleted when the status is pending");
    err.status = 400;
    throw err;
  }
  await Orders.findByIdAndDelete(id);
  return { message: "Order deleted successfully" };
}

module.exports = {
  createOrderService,
  getAllOrdersService,
  searchOrdersService,
  getOrderByIdService,
  updateOrderService,
  deleteOrderService,
};