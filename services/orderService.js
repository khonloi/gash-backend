const Orders = require("../models/Orders");
const Accounts = require("../models/Accounts");
const mongoose = require("mongoose");
const OrderDetails = require("../models/OrderDetails");
const ProductVariants = require("../models/ProductVariants");
const Products = require("../models/Products");

async function createOrderService(orderData, user) {
  const {
    acc_id,
    addressReceive,
    phone,
    totalPrice,
    order_status,
    pay_status,
    shipping_status,
    feedback_order,
  } = orderData;
  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    user.id !== acc_id.toString()
  ) {
    const err = new Error(
      "Access denied: Can only create order for own account"
    );
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
    shipping_status: shipping_status || "not_shipped",
    feedback_order: feedback_order || "None",
  });
  return await order.save();
}

async function getAllOrdersService(user) {
  if (user.role === "admin" || user.role === "manager") {
    return await Orders.find().populate("acc_id", "username name");
  } else {
    return await Orders.find({ acc_id: user.id }).populate(
      "acc_id",
      "username name"
    );
  }
}

async function searchOrdersService(queryParams, user) {
  const {
    q,
    acc_id,
    order_status,
    pay_status,
    shipping_status,
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
  if (order_status) query.order_status = order_status;
  if (pay_status) query.pay_status = pay_status;
  if (shipping_status) query.shipping_status = shipping_status;
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
    // Check if q matches DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateMatch = trimmedQuery.match(dateRegex);
    if (dateMatch) {
      // Parse date
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-based
      const year = parseInt(dateMatch[3], 10);
      const startDate = new Date(year, month, day, 0, 0, 0, 0);
      const endDate = new Date(year, month, day, 23, 59, 59, 999);
      query.orderDate = { $gte: startDate, $lte: endDate };
    } else {
      // Search OrderDetails for product name
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
        { shipping_status: { $regex: trimmedQuery, $options: "i" } },
        { addressReceive: { $regex: trimmedQuery, $options: "i" } },
        { phone: { $regex: trimmedQuery, $options: "i" } },
      ];
      if (mongoose.isValidObjectId(trimmedQuery)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(trimmedQuery) });
      }
      // If any orderIdsByProduct found, add to $or
      if (orderIdsByProduct.length > 0) {
        query.$or.push({ _id: { $in: orderIdsByProduct } });
      }
    }
  }
  return await Orders.find(query).populate("acc_id", "username name");
}

async function getOrderByIdService(id, user) {
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
  const order = await Orders.findById(id);
  if (!order) {
    const err = new Error("Order not found");
    err.status = 404;
    throw err;
  }

  /**
   * 1. Chỉ admin/manager hoặc chính chủ acc_id được phép update order
   */
  if (
    user.role !== "admin" &&
    user.role !== "manager" &&
    order.acc_id.toString() !== user.id
  ) {
    const err = new Error("Access denied: Can only update own order");
    err.status = 403;
    throw err;
  }

  /**
   * 2. Không cho phép update thông tin tài khoản (acc_id, username)
   */
  const { acc_id, username, ...rest } = updateData;
  if (acc_id || username) {
    const err = new Error("Updating account info is not allowed");
    err.status = 400;
    throw err;
  }

  /**
   * 3. Không cho phép update khi order đã hoàn tất (finalized)
   *  - COD: delivered+paid hoặc cancelled+unpaid
   *  - VNPAY: delivered+paid hoặc cancelled+refunded
   */
  if (
    (order.payment_method === "COD" &&
      order.order_status === "delivered" &&
      order.pay_status === "paid") ||
    (order.payment_method === "COD" &&
      order.order_status === "cancelled" &&
      order.pay_status === "unpaid") ||
    (order.payment_method === "VNPAY" &&
      order.order_status === "delivered" &&
      order.pay_status === "paid") ||
    (order.payment_method === "VNPAY" &&
      order.order_status === "cancelled" &&
      order.refund_status === "refunded")
  ) {
    const err = new Error("This order is finalized and cannot be updated");
    err.status = 400;
    throw err;
  }

  /**
   * 4. Validate allowed order_status transition
   */
  const allowedTransitions = {
    pending: ["confirmed", "shipping", "delivered", "cancelled"],
    confirmed: ["shipping", "delivered"],
    shipping: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  const currentStatus = order.order_status;
  if (
    rest.order_status &&
    !allowedTransitions[currentStatus].includes(rest.order_status)
  ) {
    const err = new Error(
      `Invalid status transition: ${currentStatus} → ${rest.order_status}. Allowed: ${
        allowedTransitions[currentStatus].join(", ") || "none"
      }`
    );
    err.status = 400;
    throw err;
  }

  /**
   * 5. Business rules + Auto handling pay_status & refund_status
   */
  const newStatus = rest.order_status || order.order_status;
  let newPayStatus = rest.pay_status || order.pay_status;
  let newRefund = rest.refund_status || order.refund_status;

  // 🚀 Auto: Khi delivered → luôn set pay_status = paid
  if (newStatus === "delivered") {
    newPayStatus = "paid";
  }

  /**
   * 6. COD rules
   *  - pending/confirmed/shipping → không thể paid
   *  - chỉ khi delivered mới được paid
   */
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

  /**
   * 7. VNPAY rules
   *  - Các trạng thái khác cancelled → luôn phải paid
   *  - Nếu cancelled + paid → refund_status phải pending_refund hoặc refunded
   *  - Nếu đang ở pending_refund → chỉ được update refund_status/proof
   */
  if (order.payment_method === "VNPAY") {
    if (newStatus !== "cancelled" && newPayStatus !== "paid") {
      const err = new Error("VNPAY orders must remain paid unless cancelled");
      err.status = 400;
      throw err;
    }

    if (newStatus === "cancelled" && newPayStatus === "paid") {
      if (order.refund_status === "pending_refund") {
        const keys = Object.keys(rest);
        const allowedKeys = ["refund_status", "refund_proof"];
        const hasInvalidUpdate = keys.some((k) => !allowedKeys.includes(k));
        if (hasInvalidUpdate) {
          const err = new Error(
            "When order is cancelled+paid (pending_refund), only refund_status/proof can be updated"
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

  /**
   * 8. Ghi đè lại pay_status & refund_status vào object update
   */
  rest.pay_status = newPayStatus;
  rest.refund_status = newRefund;

  /**
   * 9. Thực hiện update vào DB
   */
  const updatedOrder = await Orders.findByIdAndUpdate(
    id,
    { ...rest },
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
    const err = new Error("Orders can only be deleted when the status is pending.");
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
