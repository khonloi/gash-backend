const Orders = require('../models/Orders');
const Accounts = require('../models/Accounts');
const mongoose = require('mongoose');
const OrderDetails = require('../models/OrderDetails');
const ProductVariants = require('../models/ProductVariants');
const Products = require('../models/Products');

async function createOrderService(orderData, user) {
  const { acc_id, addressReceive, phone, totalPrice, order_status, pay_status, shipping_status, feedback_order } = orderData;
  if (user.role !== 'admin' && user.role !== 'manager' && user.id !== acc_id.toString()) {
    const err = new Error('Access denied: Can only create order for own account');
    err.status = 403;
    throw err;
  }
  const account = await Accounts.findById(acc_id);
  if (!account) {
    const err = new Error('Account not found');
    err.status = 404;
    throw err;
  }
  const order = new Orders({
    acc_id,
    addressReceive,
    phone,
    totalPrice,
    order_status: order_status || 'pending',
    pay_status: pay_status || 'unpaid',
    shipping_status: shipping_status || 'not_shipped',
    feedback_order: feedback_order || 'None'
  });
  return await order.save();
}

async function getAllOrdersService(user) {
  if (user.role === 'admin' || user.role === 'manager') {
    return await Orders.find().populate('acc_id', 'username name');
  } else {
    return await Orders.find({ acc_id: user.id }).populate('acc_id', 'username name');
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
    maxPrice
  } = queryParams;
  let query = {};
  if (user.role !== 'admin' && user.role !== 'manager') {
    query.acc_id = user.id;
  } else if (acc_id) {
    if (!mongoose.isValidObjectId(acc_id)) {
      const err = new Error('Invalid account ID');
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
    if (minPrice && !isNaN(parseFloat(minPrice))) query.totalPrice.$gte = parseFloat(minPrice);
    if (maxPrice && !isNaN(parseFloat(maxPrice))) query.totalPrice.$lte = parseFloat(maxPrice);
    if (Object.keys(query.totalPrice).length === 0) delete query.totalPrice;
  }
  let orderIdsByProduct = [];
  if (q && typeof q === 'string' && q.trim() !== '') {
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
      path: 'variant_id',
      populate: {
        path: 'pro_id',
        model: 'Products',
        match: { pro_name: { $regex: trimmedQuery, $options: 'i' } }
      }
    });
    orderIdsByProduct = matchingDetails
      .filter(d => d.variant_id && d.variant_id.pro_id)
      .map(d => d.order_id.toString());
    query.$or = [
      { order_status: { $regex: trimmedQuery, $options: 'i' } },
      { pay_status: { $regex: trimmedQuery, $options: 'i' } },
      { shipping_status: { $regex: trimmedQuery, $options: 'i' } },
      { addressReceive: { $regex: trimmedQuery, $options: 'i' } },
      { phone: { $regex: trimmedQuery, $options: 'i' } }
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
  return await Orders.find(query).populate('acc_id', 'username name');
}

async function getOrderByIdService(id, user) {
  const order = await Orders.findById(id).populate('acc_id', 'username name');
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  if (user.role !== 'admin' && user.role !== 'manager' && order.acc_id._id.toString() !== user.id) {
    const err = new Error('Access denied: Can only view own order');
    err.status = 403;
    throw err;
  }
  return order;
}

async function updateOrderService(id, updateData, user) {
  const order = await Orders.findById(id);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  if (user.role !== 'admin' && user.role !== 'manager' && order.acc_id.toString() !== user.id) {
    const err = new Error('Access denied: Can only update own order');
    err.status = 403;
    throw err;
  }
  const { acc_id, username, ...rest } = updateData;
  if (acc_id || username) {
    const account = await Accounts.findById(acc_id || order.acc_id);
    if (!account) {
      const err = new Error('Account not found');
      err.status = 404;
      throw err;
    }
  }
  
  // If payment status is set to failed, automatically set order status to cancelled
  if (rest.pay_status === 'failed' && (!rest.order_status || rest.order_status !== 'cancelled')) {
    rest.order_status = 'cancelled';
  }
  
  const updatedOrder = await Orders.findByIdAndUpdate(
    id,
    { ...rest, ...(acc_id && { acc_id }), ...(username && { username }) },
    { new: true, runValidators: true }
  ).populate('acc_id', 'username name');
  return updatedOrder;
}

async function deleteOrderService(id, user) {
  const order = await Orders.findById(id);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  if (user.role !== 'admin' && user.role !== 'manager' && order.acc_id.toString() !== user.id) {
    const err = new Error('Access denied: Can only delete own order');
    err.status = 403;
    throw err;
  }
  await Orders.findByIdAndDelete(id);
  return { message: 'Order deleted successfully' };
}

module.exports = {
  createOrderService,
  getAllOrdersService,
  searchOrdersService,
  getOrderByIdService,
  updateOrderService,
  deleteOrderService
}; 