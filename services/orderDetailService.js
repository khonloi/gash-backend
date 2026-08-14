const mongoose = require('mongoose');
const OrderDetails = require('../models/OrderDetails');
const Orders = require('../models/Orders');
const ProductVariant = require('../models/ProductVariant');
const Accounts = require('../models/Accounts');

exports.searchOrderDetails = async (queryParams, user) => {
  const {
    orderId,
    variantId,
    productId,
    productColorId,
    productSizeId,
    username,
    startDate,
    endDate,
    feedback,
    q
  } = queryParams;
  const query = {
    'feedback.content': { $nin: ['', null] },
  };

  if (user.role !== 'admin' && user.role !== 'manager') {
    const userOrders = await Orders.find({ accountId: user.id }).select('_id');
    const userOrderIds = userOrders.map(order => order._id);
    query.orderId = { $in: userOrderIds };
  }

  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      const err = new Error("Invalid order ID");
      err.status = 400;
      throw err;
    }
    query.orderId = orderId;
  }

  if (variantId) {
    if (!mongoose.isValidObjectId(variantId)) {
      const err = new Error("Invalid variant ID");
      err.status = 400;
      throw err;
    }
    query.variantId = variantId;
  }

  if (productId || productColorId || productSizeId) {
    const variantQuery = {};
    if (productId) variantQuery.productId = productId;
    if (productColorId) variantQuery.productColorId = productColorId;
    if (productSizeId) variantQuery.productSizeId = productSizeId;
    const variants = await ProductVariant.find(variantQuery).select('_id');
    const variantIds = variants.map(v => v._id);
    query.variantId = { $in: variantIds };
  }

  if (username) {
    const userDoc = await Accounts.findOne({ username }).select('_id');
    if (!userDoc) return [];
    const userOrders = await Orders.find({ accountId: userDoc._id }).select('_id');
    const userOrderIds = userOrders.map(order => order._id);
    query.orderId = query.orderId
      ? { $in: userOrderIds.filter(id => query.orderId.$in ? query.orderId.$in.includes(id) : id === query.orderId) }
      : { $in: userOrderIds };
  }

  if (startDate || endDate) {
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) {
      const toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999);
      dateQuery.$lte = toDate;
    }
    const orders = await Orders.find({ orderDate: dateQuery }).select('_id');
    const orderIds = orders.map(order => order._id);
    query.orderId = query.orderId
      ? { $in: orderIds.filter(id => query.orderId.$in ? query.orderId.$in.includes(id) : id === query.orderId) }
      : { $in: orderIds };
  }

  if (feedback) {
    query['feedback.content'] = { $regex: feedback, $options: 'i' };
  }

  if (q && typeof q === 'string' && q.trim() !== '') {
    const trimmedQuery = q.trim();
    query.$or = [
      { 'feedback.content': { $regex: trimmedQuery, $options: 'i' } },
    ];
  }

  return await OrderDetails.find(query)
    .populate({
      path: 'orderId',
      select: 'orderDate totalPrice accountId feedback_order',
      populate: { path: 'accountId', select: 'username image' },
    })
    .populate({
      path: 'variantId',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'productColorName' },
        { path: 'productSizeId', select: 'productSizeName' },
      ],
    });
};

exports.createOrderDetail = async (data, user) => {
  const { orderId, variantId, unitPrice, Quantity, feedback } = data;

  if (!orderId || !variantId || !unitPrice || !Quantity) {
    return { status: 400, response: { message: 'Missing required fields' } };
  }
  if (unitPrice < 0) {
    return { status: 400, response: { message: 'Unit price cannot be negative' } };
  }
  if (Quantity < 1) {
    return { status: 400, response: { message: 'Quantity must be at least 1' } };
  }
  if (feedback && feedback.content && feedback.content.length > 500) {
    return { status: 400, response: { message: 'Feedback content cannot exceed 500 characters' } };
  }
  if (feedback && feedback.rating && (feedback.rating < 1 || feedback.rating > 5)) {
    return { status: 400, response: { message: 'Rating must be between 1 and 5' } };
  }

  const order = await Orders.findById(orderId);
  if (!order) {
    return { status: 404, response: { message: 'Order not found' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager' && order.accountId.toString() !== user.id) {
    return { status: 403, response: { message: 'Access denied: Can only create order detail for own order' } };
  }
  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    return { status: 404, response: { message: 'Product variant not found' } };
  }
  const orderDetail = new OrderDetails({
    orderId,
    variantId,
    unitPrice,
    Quantity,
    feedback: {
      content: feedback?.content || '',
      rating: feedback?.rating || null,
      createdAt: feedback?.createdAt || null,
      updatedAt: feedback?.updatedAt || null,
      isDeleted: false
    }
  });
  const savedOrderDetail = await orderDetail.save();
  return { status: 201, response: { message: 'Order detail created successfully', orderDetail: savedOrderDetail } };
};

exports.getAllOrderDetails = async (user, orderId) => {
  const query = {};

  if (user.role !== 'admin' && user.role !== 'manager') {
    const userOrders = await Orders.find({ accountId: user.id }).select('_id');
    const userOrderIds = userOrders.map(order => order._id);
    query.orderId = { $in: userOrderIds };
  }

  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      const err = new Error("Invalid order ID");
      err.status = 400;
      throw err;
    }
    query.orderId = orderId;
  }

  return await OrderDetails.find(query)
    .populate({
      path: 'orderId',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'accountId', select: 'username image' },
    })
    .populate({
      path: 'variantId',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'productColorName' },
        { path: 'productSizeId', select: 'productSizeName' },
      ],
    });
};

exports.updateOrderDetail = async (id, data, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, response: { message: 'Invalid order detail ID' } };
  }
  const orderDetail = await OrderDetails.findOne({ _id: id });
  if (!orderDetail) {
    return { status: 404, response: { message: 'Order detail not found' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    const order = await Orders.findById(orderDetail.orderId);
    if (order.accountId.toString() !== user.id) {
      return { status: 403, response: { message: 'Access denied: Can only update own order detail' } };
    }
  }
  const { orderId, variantId, unitPrice, Quantity, feedback } = data;

  if (unitPrice !== undefined && unitPrice < 0) {
    return { status: 400, response: { message: 'Unit price cannot be negative' } };
  }
  if (Quantity !== undefined && Quantity < 1) {
    return { status: 400, response: { message: 'Quantity must be at least 1' } };
  }
  if (feedback && feedback.content && feedback.content.length > 500) {
    return { status: 400, response: { message: 'Feedback content cannot exceed 500 characters' } };
  }
  if (feedback && feedback.rating && (feedback.rating < 1 || feedback.rating > 5)) {
    return { status: 400, response: { message: 'Rating must be between 1 and 5' } };
  }
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      return { status: 400, response: { message: 'Invalid order ID' } };
    }
    const order = await Orders.findById(orderId);
    if (!order) {
      return { status: 404, response: { message: 'Order not found' } };
    }
  }
  if (variantId) {
    if (!mongoose.isValidObjectId(variantId)) {
      return { status: 400, response: { message: 'Invalid variant ID' } };
    }
    const variant = await ProductVariant.findById(variantId);
    if (!variant) {
      return { status: 404, response: { message: 'Product variant not found' } };
    }
  }

  const updateData = {};
  if (orderId) updateData.orderId = orderId;
  if (variantId) updateData.variantId = variantId;
  if (unitPrice !== undefined) updateData.unitPrice = unitPrice;
  if (Quantity !== undefined) updateData.Quantity = Quantity;
  if (feedback) {
    if (feedback.content !== undefined) updateData['feedback.content'] = feedback.content;
    if (feedback.rating !== undefined) updateData['feedback.rating'] = feedback.rating;
    if (feedback.createdAt !== undefined) updateData['feedback.createdAt'] = feedback.createdAt;
    if (feedback.updatedAt !== undefined) updateData['feedback.updatedAt'] = feedback.updatedAt;
    if (feedback.isDeleted !== undefined) updateData['feedback.isDeleted'] = feedback.isDeleted;
  }

  const updatedOrderDetail = await OrderDetails.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate({
      path: 'orderId',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'accountId', select: 'username image' },
    })
    .populate({
      path: 'variantId',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'productColorName' },
        { path: 'productSizeId', select: 'productSizeName' },
      ],
    });
  return { status: 200, response: { message: 'Order detail updated successfully', orderDetail: updatedOrderDetail } };
};

exports.deleteOrderDetail = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, response: { message: 'Invalid order detail ID' } };
  }
  const orderDetail = await OrderDetails.findOne({ _id: id });
  if (!orderDetail) {
    return { status: 404, response: { message: 'Order detail not found' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    const order = await Orders.findById(orderDetail.orderId);
    if (order.accountId.toString() !== user.id) {
      return { status: 403, response: { message: 'Access denied: Can only delete own order detail' } };
    }
  }
  await OrderDetails.findByIdAndDelete(id);
  return { status: 200, response: { message: 'Order detail deleted successfully' } };
};

exports.getOrderDetailsByProduct = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    const err = new Error("Invalid product ID");
    err.status = 400;
    throw err;
  }
  const variants = await ProductVariant.find({ productId }).select('_id');
  const variantIds = variants.map(variant => variant._id);
  return await OrderDetails.find({
    variantId: { $in: variantIds },
    'feedback.content': { $nin: ['', null] },
  })
    .populate({
      path: 'orderId',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'accountId', select: 'username image' },
    })
    .populate({
      path: 'variantId',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'productColorName' },
        { path: 'productSizeId', select: 'productSizeName' },
      ],
    });
};