const mongoose = require('mongoose');
const OrderDetail = require('../models/OrderDetail');
const Order = require('../models/Order');
const ProductVariants = require('../models/ProductVariant');
const Accounts = require('../models/Accounts');

exports.searchOrderDetails = async (queryParams, user) => {
  const {
    order_id,
    variant_id,
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
    const userOrders = await Order.find({ acc_id: user.id }).select('_id');
    const userOrderIds = userOrder.map(order => order._id);
    query.order_id = { $in: userOrderIds };
  }

  if (order_id) {
    if (!mongoose.isValidObjectId(order_id)) {
      const err = new Error("Invalid order ID");
      err.status = 400;
      throw err;
    }
    query.order_id = order_id;
  }

  if (variant_id) {
    if (!mongoose.isValidObjectId(variant_id)) {
      const err = new Error("Invalid variant ID");
      err.status = 400;
      throw err;
    }
    query.variant_id = variant_id;
  }

  if (productId || productColorId || productSizeId) {
    const variantQuery = {};
    if (productId) variantQuery.productId = productId;
    if (productColorId) variantQuery.productColorId = productColorId;
    if (productSizeId) variantQuery.productSizeId = productSizeId;
    const variants = await ProductVariants.find(variantQuery).select('_id');
    const variantIds = variants.map(v => v._id);
    query.variant_id = { $in: variantIds };
  }

  if (username) {
    const userDoc = await Accounts.findOne({ username }).select('_id');
    if (!userDoc) return [];
    const userOrders = await Order.find({ acc_id: userDoc._id }).select('_id');
    const userOrderIds = userOrder.map(order => order._id);
    query.order_id = query.order_id
      ? { $in: userOrderIds.filter(id => query.order_id.$in ? query.order_id.$in.includes(id) : id === query.order_id) }
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
    const orders = await Order.find({ orderDate: dateQuery }).select('_id');
    const orderIds = orders.map(order => order._id);
    query.order_id = query.order_id
      ? { $in: orderIds.filter(id => query.order_id.$in ? query.order_id.$in.includes(id) : id === query.order_id) }
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

  return await OrderDetail.find(query)
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice acc_id feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'color_name' },
        { path: 'productSizeId', select: 'size_name' },
      ],
    });
};

exports.createOrderDetail = async (data, user) => {
  const { order_id, variant_id, UnitPrice, Quantity, feedback } = data;

  if (!order_id || !variant_id || !UnitPrice || !Quantity) {
    return { status: 400, response: { message: 'Missing required fields' } };
  }
  if (UnitPrice < 0) {
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

  const order = await Order.findById(order_id);
  if (!order) {
    return { status: 404, response: { message: 'Order not found' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager' && order.acc_id.toString() !== user.id) {
    return { status: 403, response: { message: 'Access denied: Can only create order detail for own order' } };
  }
  const variant = await ProductVariants.findById(variant_id);
  if (!variant) {
    return { status: 404, response: { message: 'Product variant not found' } };
  }
  const orderDetail = new OrderDetail({
    order_id,
    variant_id,
    UnitPrice,
    Quantity,
    feedback: {
      content: feedback?.content || '',
      rating: feedback?.rating || null,
      created_at: feedback?.created_at || null,
      updated_at: feedback?.updated_at || null,
      is_deleted: false
    }
  });
  const savedOrderDetail = await orderDetail.save();
  return { status: 201, response: { message: 'Order detail created successfully', orderDetail: savedOrderDetail } };
};

exports.getAllOrderDetails = async (user, order_id) => {
  const query = {};

  if (user.role !== 'admin' && user.role !== 'manager') {
    const userOrders = await Order.find({ acc_id: user.id }).select('_id');
    const userOrderIds = userOrder.map(order => order._id);
    query.order_id = { $in: userOrderIds };
  }

  if (order_id) {
    if (!mongoose.isValidObjectId(order_id)) {
      const err = new Error("Invalid order ID");
      err.status = 400;
      throw err;
    }
    query.order_id = order_id;
  }

  return await OrderDetail.find(query)
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'color_name' },
        { path: 'productSizeId', select: 'size_name' },
      ],
    });
};

exports.updateOrderDetail = async (id, data, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, response: { message: 'Invalid order detail ID' } };
  }
  const orderDetail = await OrderDetail.findOne({ _id: id });
  if (!orderDetail) {
    return { status: 404, response: { message: 'Order detail not found' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    const order = await Order.findById(orderDetail.order_id);
    if (order.acc_id.toString() !== user.id) {
      return { status: 403, response: { message: 'Access denied: Can only update own order detail' } };
    }
  }
  const { order_id, variant_id, UnitPrice, Quantity, feedback } = data;

  if (UnitPrice !== undefined && UnitPrice < 0) {
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
  if (order_id) {
    if (!mongoose.isValidObjectId(order_id)) {
      return { status: 400, response: { message: 'Invalid order ID' } };
    }
    const order = await Order.findById(order_id);
    if (!order) {
      return { status: 404, response: { message: 'Order not found' } };
    }
  }
  if (variant_id) {
    if (!mongoose.isValidObjectId(variant_id)) {
      return { status: 400, response: { message: 'Invalid variant ID' } };
    }
    const variant = await ProductVariants.findById(variant_id);
    if (!variant) {
      return { status: 404, response: { message: 'Product variant not found' } };
    }
  }

  const updateData = {};
  if (order_id) updateData.order_id = order_id;
  if (variant_id) updateData.variant_id = variant_id;
  if (UnitPrice !== undefined) updateData.UnitPrice = UnitPrice;
  if (Quantity !== undefined) updateData.Quantity = Quantity;
  if (feedback) {
    if (feedback.content !== undefined) updateData['feedback.content'] = feedback.content;
    if (feedback.rating !== undefined) updateData['feedback.rating'] = feedback.rating;
    if (feedback.created_at !== undefined) updateData['feedback.created_at'] = feedback.created_at;
    if (feedback.updated_at !== undefined) updateData['feedback.updated_at'] = feedback.updated_at;
    if (feedback.is_deleted !== undefined) updateData['feedback.is_deleted'] = feedback.is_deleted;
  }

  const updatedOrderDetail = await OrderDetail.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'color_name' },
        { path: 'productSizeId', select: 'size_name' },
      ],
    });
  return { status: 200, response: { message: 'Order detail updated successfully', orderDetail: updatedOrderDetail } };
};

exports.deleteOrderDetail = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, response: { message: 'Invalid order detail ID' } };
  }
  const orderDetail = await OrderDetail.findOne({ _id: id });
  if (!orderDetail) {
    return { status: 404, response: { message: 'Order detail not found' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    const order = await Order.findById(orderDetail.order_id);
    if (order.acc_id.toString() !== user.id) {
      return { status: 403, response: { message: 'Access denied: Can only delete own order detail' } };
    }
  }
  await OrderDetail.findByIdAndDelete(id);
  return { status: 200, response: { message: 'Order detail deleted successfully' } };
};

exports.getOrderDetailsByProduct = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) {
    const err = new Error("Invalid product ID");
    err.status = 400;
    throw err;
  }
  const variants = await ProductVariants.find({ productId }).select('_id');
  const variantIds = variants.map(variant => variant._id);
  return await OrderDetail.find({
    variant_id: { $in: variantIds },
    'feedback.content': { $nin: ['', null] },
  })
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'productId productColorId productSizeId',
      populate: [
        {
          path: 'productId',
          select: 'productName imageURL',
          options: { toJSON: { virtuals: true }, toObject: { virtuals: true } }
        },
        { path: 'productColorId', select: 'color_name' },
        { path: 'productSizeId', select: 'size_name' },
      ],
    });
};
exports.addFeedbackService = async (orderId, variantId, rating, content, user) => {
  const orderService = require('./orderService');
  const order = await orderService.getOrderByIdService(orderId, user);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }
  if (order.order_status !== 'delivered') {
    const err = new Error('Feedback can only be added when the order is delivered');
    err.statusCode = 400;
    throw err;
  }
  const orderDetail = await OrderDetail.findOne({ order_id: orderId, variant_id: variantId });
  if (!orderDetail) {
    const err = new Error('Product not found in this order');
    err.statusCode = 404;
    throw err;
  }
  const updateData = {};
  if (rating !== undefined) updateData['feedback.rating'] = rating;
  if (content !== undefined) updateData['feedback.content'] = content === null ? null : content.trim();
  updateData['feedback.is_deleted'] = false;
  updateData['feedback.created_at'] = new Date();
  updateData['feedback.updated_at'] = new Date();

  const savedOrderDetail = await OrderDetail.findByIdAndUpdate(
    orderDetail._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );
  return { savedOrderDetail, order };
};

exports.editFeedbackService = async (orderId, variantId, rating, content, user) => {
  const orderService = require('./orderService');
  const order = await orderService.getOrderByIdService(orderId, user);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }
  if (order.order_status !== 'delivered') {
    const err = new Error('Feedback can only be edited when the order is delivered');
    err.statusCode = 400;
    throw err;
  }
  const orderDetail = await OrderDetail.findOne({ order_id: orderId, variant_id: variantId });
  if (!orderDetail) {
    const err = new Error('Product not found in this order');
    err.statusCode = 404;
    throw err;
  }
  if (orderDetail.feedback && orderDetail.feedback.is_deleted === true) {
    const err = new Error('Cannot edit deleted feedback');
    err.statusCode = 404;
    throw err;
  }

  const updateData = {};
  if (rating !== undefined) updateData['feedback.rating'] = rating;
  if (content !== undefined) updateData['feedback.content'] = content === null ? null : content.trim();
  updateData['feedback.updated_at'] = new Date();

  const savedOrderDetail = await OrderDetail.findByIdAndUpdate(
    orderDetail._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );
  return { savedOrderDetail, order };
};

exports.deleteFeedbackService = async (orderId, variantId, user) => {
  const orderService = require('./orderService');
  const order = await orderService.getOrderByIdService(orderId, user);
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }
  const orderDetail = await OrderDetail.findOne({ order_id: orderId, variant_id: variantId });
  if (!orderDetail) {
    const err = new Error('Product not found in this order');
    err.statusCode = 404;
    throw err;
  }
  if (!orderDetail.feedback || !orderDetail.feedback.rating) {
    const err = new Error('Feedback not found');
    err.statusCode = 404;
    throw err;
  }

  const savedOrderDetail = await OrderDetail.findByIdAndUpdate(
    orderDetail._id,
    {
      $set: {
        'feedback.content': '',
        'feedback.rating': null,
        'feedback.is_deleted': true,
        'feedback.updated_at': new Date(),
      },
    },
    { new: true }
  );
  return { savedOrderDetail, order };
};
