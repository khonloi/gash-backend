// orderDetailService.js
const mongoose = require('mongoose');
const OrderDetails = require('../models/OrderDetails');
const Orders = require('../models/Orders');
const ProductVariants = require('../models/ProductVariants');
const Accounts = require('../models/Accounts');

exports.searchOrderDetails = async (queryParams, user) => {
  const {
    order_id,
    variant_id,
    pro_id,
    color_id,
    size_id,
    username,
    startDate,
    endDate,
    feedback,
    q
  } = queryParams;
  const query = {
    is_deleted: false, // Only return non-deleted order details
    feedback_details: { $nin: ['', null] }, // Exclude empty feedback
  };

  // Role-based access
  if (user.role !== 'admin' && user.role !== 'manager') {
    const userOrders = await Orders.find({ acc_id: user.id }).select('_id');
    const userOrderIds = userOrders.map(order => order._id);
    query.order_id = { $in: userOrderIds };
  }

  // Filter by order_id
  if (order_id) {
    if (!mongoose.isValidObjectId(order_id)) {
      const err = new Error("Invalid order ID");
      err.status = 400;
      throw err;
    }
    query.order_id = order_id;
  }

  // Filter by variant_id
  if (variant_id) {
    if (!mongoose.isValidObjectId(variant_id)) {
      const err = new Error("Invalid variant ID");
      err.status = 400;
      throw err;
    }
    query.variant_id = variant_id;
  }

  // Filter by product/color/size via variant
  if (pro_id || color_id || size_id) {
    const variantQuery = {};
    if (pro_id) variantQuery.pro_id = pro_id;
    if (color_id) variantQuery.color_id = color_id;
    if (size_id) variantQuery.size_id = size_id;
    const variants = await ProductVariants.find(variantQuery).select('_id');
    const variantIds = variants.map(v => v._id);
    query.variant_id = { $in: variantIds };
  }

  // Filter by username (account)
  if (username) {
    const userDoc = await Accounts.findOne({ username }).select('_id');
    if (!userDoc) {
      return [];
    }
    const userOrders = await Orders.find({ acc_id: userDoc._id }).select('_id');
    const userOrderIds = userOrders.map(order => order._id);
    query.order_id = query.order_id
      ? { $in: userOrderIds.filter(id => query.order_id.$in ? query.order_id.$in.includes(id) : id === query.order_id) }
      : { $in: userOrderIds };
  }

  // Date range filter (orderDate)
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
    query.order_id = query.order_id
      ? { $in: orderIds.filter(id => query.order_id.$in ? query.order_id.$in.includes(id) : id === query.order_id) }
      : { $in: orderIds };
  }

  // Feedback text filter
  if (feedback) {
    query.feedback_details = { $regex: feedback, $options: 'i' };
  }

  // General search (q)
  if (q && typeof q === 'string' && q.trim() !== '') {
    const trimmedQuery = q.trim();
    query.$or = [
      { feedback_details: { $regex: trimmedQuery, $options: 'i' } },
    ];
  }

  return await OrderDetails.find(query)
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice acc_id feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'pro_id color_id size_id',
      populate: [
        { path: 'pro_id', select: 'pro_name' },
        { path: 'color_id', select: 'color_name' },
        { path: 'size_id', select: 'size_name' },
      ],
    });
};

exports.createOrderDetail = async (data, user) => {
  const { order_id, variant_id, UnitPrice, Quantity, feedback_details } = data;

  // Validate required fields
  if (!order_id || !variant_id || !UnitPrice || !Quantity) {
    return { status: 400, response: { message: 'Missing required fields' } };
  }
  if (UnitPrice < 0) {
    return { status: 400, response: { message: 'Unit price cannot be negative' } };
  }
  if (Quantity < 1) {
    return { status: 400, response: { message: 'Quantity must be at least 1' } };
  }
  if (feedback_details && feedback_details.length > 500) {
    return { status: 400, response: { message: 'Feedback cannot exceed 500 characters' } };
  }

  const order = await Orders.findById(order_id);
  if (!order) {
    return { status: 404, response: { message: 'Order not found' } };
  }
  if (
    user.role !== 'admin' &&
    user.role !== 'manager' &&
    order.acc_id.toString() !== user.id
  ) {
    return { status: 403, response: { message: 'Access denied: Can only create order detail for own order' } };
  }
  const variant = await ProductVariants.findById(variant_id);
  if (!variant) {
    return { status: 404, response: { message: 'Product variant not found' } };
  }
  const orderDetail = new OrderDetails({
    order_id,
    variant_id,
    UnitPrice,
    Quantity,
    feedback_details: feedback_details || '',
    is_deleted: false,
  });
  const savedOrderDetail = await orderDetail.save();
  return { status: 201, response: { message: 'Order detail created successfully', orderDetail: savedOrderDetail } };
};

exports.getAllOrderDetails = async (user, order_id) => {
  const query = { is_deleted: false };
  if (user.role !== 'admin' && user.role !== 'manager') {
    const userOrders = await Orders.find({ acc_id: user.id }).select('_id');
    const orderIds = userOrders.map(order => order._id);
    query.order_id = { $in: orderIds };
  }
  if (order_id) {
    if (!mongoose.isValidObjectId(order_id)) {
      const err = new Error("Invalid order ID");
      err.status = 400;
      throw err;
    }
    query.order_id = order_id;
  }
  return await OrderDetails.find(query)
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'pro_id color_id size_id',
      populate: [
        { path: 'pro_id', select: 'pro_name' },
        { path: 'color_id', select: 'color_name' },
        { path: 'size_id', select: 'size_name' },
      ],
    });
};

exports.getOrderDetailById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid order detail ID");
    err.status = 400;
    throw err;
  }
  return await OrderDetails.findOne({ _id: id, is_deleted: false })
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice acc_id feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'pro_id color_id size_id',
      populate: [
        { path: 'pro_id', select: 'pro_name' },
        { path: 'color_id', select: 'color_name' },
        { path: 'size_id', select: 'size_name' },
      ],
    });
};

exports.updateOrderDetail = async (id, data, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, response: { message: 'Invalid order detail ID' } };
  }
  const orderDetail = await OrderDetails.findOne({ _id: id, is_deleted: false });
  if (!orderDetail) {
    return { status: 404, response: { message: 'Order detail not found or deleted' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    const order = await Orders.findById(orderDetail.order_id);
    if (order.acc_id.toString() !== user.id) {
      return { status: 403, response: { message: 'Access denied: Can only update own order detail' } };
    }
  }
  const { order_id, variant_id, UnitPrice, Quantity, feedback_details, is_deleted } = data;

  // Validate fields
  if (UnitPrice !== undefined && UnitPrice < 0) {
    return { status: 400, response: { message: 'Unit price cannot be negative' } };
  }
  if (Quantity !== undefined && Quantity < 1) {
    return { status: 400, response: { message: 'Quantity must be at least 1' } };
  }
  if (feedback_details && feedback_details.length > 500) {
    return { status: 400, response: { message: 'Feedback cannot exceed 500 characters' } };
  }
  if (order_id) {
    if (!mongoose.isValidObjectId(order_id)) {
      return { status: 400, response: { message: 'Invalid order ID' } };
    }
    const order = await Orders.findById(order_id);
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

  const updatedOrderDetail = await OrderDetails.findByIdAndUpdate(
    id,
    {
      ...(order_id && { order_id }),
      ...(variant_id && { variant_id }),
      ...(UnitPrice !== undefined && { UnitPrice }),
      ...(Quantity !== undefined && { Quantity }),
      ...(feedback_details !== undefined && { feedback_details }),
      ...(is_deleted !== undefined && { is_deleted }),
    },
    { new: true, runValidators: true }
  )
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'pro_id color_id size_id',
      populate: [
        { path: 'pro_id', select: 'pro_name' },
        { path: 'color_id', select: 'color_name' },
        { path: 'size_id', select: 'size_name' },
      ],
    });
  return { status: 200, response: { message: 'Order detail updated successfully', orderDetail: updatedOrderDetail } };
};

exports.deleteOrderDetail = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, response: { message: 'Invalid order detail ID' } };
  }
  const orderDetail = await OrderDetails.findOne({ _id: id, is_deleted: false });
  if (!orderDetail) {
    return { status: 404, response: { message: 'Order detail not found or already deleted' } };
  }
  if (user.role !== 'admin' && user.role !== 'manager') {
    const order = await Orders.findById(orderDetail.order_id);
    if (order.acc_id.toString() !== user.id) {
      return { status: 403, response: { message: 'Access denied: Can only delete own order detail' } };
    }
  }
  orderDetail.is_deleted = true;
  await orderDetail.save();
  return { status: 200, response: { message: 'Order detail soft-deleted successfully' } };
};

exports.getOrderDetailsByProduct = async (pro_id) => {
  if (!mongoose.isValidObjectId(pro_id)) {
    const err = new Error("Invalid product ID");
    err.status = 400;
    throw err;
  }
  const variants = await ProductVariants.find({ pro_id }).select('_id');
  const variantIds = variants.map(variant => variant._id);
  return await OrderDetails.find({
    variant_id: { $in: variantIds },
    feedback_details: { $nin: ['', null] },
    is_deleted: false,
  })
    .populate({
      path: 'order_id',
      select: 'orderDate totalPrice feedback_order',
      populate: { path: 'acc_id', select: 'username image' },
    })
    .populate({
      path: 'variant_id',
      select: 'pro_id color_id size_id',
      populate: [
        { path: 'pro_id', select: 'pro_name' },
        { path: 'color_id', select: 'color_name' },
        { path: 'size_id', select: 'size_name' },
      ],
    });
};