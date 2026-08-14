const mongoose = require("mongoose");
const OrderDetails = require("../models/OrderDetails");
const Orders = require("../models/Orders");
const ProductVariant = require("../models/ProductVariant");

exports.getAllFeedback = async (filters) => {
  const {
    sortBy = "createdAt",
    sortOrder = "desc",
    rating,
    hasContent,
    isDeleted,
    productId,
    variantId,
    userId,
    orderStatus,
    dateFrom,
    dateTo,
    search,
  } = filters;

  const query = {};

  if (rating !== undefined) {
    const ratingNum = parseInt(rating);
    if (ratingNum >= 1 && ratingNum <= 5) {
      query["feedback.rating"] = ratingNum;
    }
  }

  if (hasContent !== undefined) {
    if (hasContent === "true") {
      query["feedback.content"] = { $exists: true, $nin: ["", null] };
    } else if (hasContent === "false") {
      query.$or = [
        { "feedback.content": { $exists: false } },
        { "feedback.content": "" },
        { "feedback.content": null },
      ];
    }
  }

  if (isDeleted !== undefined) {
    if (isDeleted === "true") {
      query["feedback.isDeleted"] = true;
    } else if (isDeleted === "false") {
      query.$and = [
        {
          $or: [
            { "feedback.isDeleted": { $exists: false } },
            { "feedback.isDeleted": false },
          ],
        },
      ];
    }
  }

  if (productId && mongoose.isValidObjectId(productId)) {
    const variants = await ProductVariant.find({ productId }).select("_id");
    const variantIds = variants.map((v) => v._id);
    query.variantId = { $in: variantIds };
  }

  if (variantId && mongoose.isValidObjectId(variantId)) {
    query.variantId = variantId;
  }

  const orderQuery = {};
  if (userId && mongoose.isValidObjectId(userId)) {
    orderQuery.accountId = userId;
  }
  if (orderStatus) {
    const validStatuses = [
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
    ];
    if (validStatuses.includes(orderStatus)) {
      orderQuery.orderStatus = orderStatus;
    }
  }
  if (Object.keys(orderQuery).length > 0) {
    const orders = await Orders.find(orderQuery).select("_id");
    const orderIds = orders.map((o) => o._id);
    query.orderId = { $in: orderIds };
  }

  if (dateFrom || dateTo) {
    const dateQuery = {};
    if (dateFrom) {
      dateQuery.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      dateQuery.$lte = new Date(dateTo);
    }
    query["feedback.createdAt"] = dateQuery;
  }

  if (search && search.trim()) {
    query["feedback.content"] = { $regex: search.trim(), $options: "i" };
  }

  const hasRatingOrContent = {
    $or: [
      { "feedback.rating": { $exists: true, $ne: null, $gte: 1, $lte: 5 } },
      { "feedback.content": { $exists: true, $nin: ["", null] } },
    ],
  };

  if (Object.keys(query).length > 0) {
    if (query.$and) {
      query.$and.push(hasRatingOrContent);
    } else {
      const existingConditions = { ...query };
      Object.keys(query).forEach((key) => delete query[key]);
      query.$and = [existingConditions, hasRatingOrContent];
    }
  } else {
    Object.assign(query, hasRatingOrContent);
  }

  const sortObj = {};
  const validSortFields = ["createdAt", "updatedAt", "rating", "orderDate"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  if (sortField === "orderDate") {
    sortObj["feedback.createdAt"] = sortDirection;
  } else {
    sortObj[`feedback.${sortField}`] = sortDirection;
  }

  const feedbacks = await OrderDetails.find(query)
    .populate({
      path: "orderId",
      select: "orderDate orderStatus accountId",
      populate: {
        path: "accountId",
        select: "username name email phone image",
      },
    })
    .populate({
      path: "variantId",
      select:
        "productId productColorId productSizeId variantImage variantPrice",
      populate: [
        { path: "productId", select: "productName categoryId productStatus" },
        { path: "productColorId", select: "productColorName" },
        { path: "productSizeId", select: "productSizeName" },
      ],
    })
    .sort(sortObj);

  feedbacks.forEach((feedback) => {
    if (!feedback.orderId)
      console.warn(`OrderDetails _id: ${feedback._id} missing orderId`);
    if (feedback.orderId && !feedback.orderId.accountId)
      console.warn(
        `OrderDetails _id: ${feedback._id} missing accountId for orderId ${feedback.orderId._id}`,
      );
    if (!feedback.variantId)
      console.warn(`OrderDetails _id: ${feedback._id} missing variantId`);
    if (feedback.variantId && !feedback.variantId.productId)
      console.warn(
        `OrderDetails _id: ${feedback._id} missing productId for variantId ${feedback.variantId._id}`,
      );
  });

  const formattedFeedbacks = feedbacks
    .filter((feedback) => {
      const hasRating =
        feedback.feedback?.rating !== null &&
        feedback.feedback?.rating !== undefined &&
        feedback.feedback.rating >= 1 &&
        feedback.feedback.rating <= 5;
      const hasContent =
        feedback.feedback?.content && feedback.feedback.content.trim() !== "";
      return (
        feedback.orderId && feedback.variantId && (hasRating || hasContent)
      );
    })
    .map((feedback) => ({
      _id: feedback._id || null,
      order: feedback.orderId
        ? {
            _id: feedback.orderId._id || null,
            orderDate: feedback.orderId.orderDate || null,
            orderStatus: feedback.orderId.orderStatus || null,
          }
        : { _id: null, orderDate: null, orderStatus: null },
      customer: feedback.orderId?.accountId
        ? {
            _id: feedback.orderId.accountId._id || null,
            username: feedback.orderId.accountId.username || null,
            name: feedback.orderId.accountId.name || null,
            email: feedback.orderId.accountId.email || null,
            phone: feedback.orderId.accountId.phone || null,
            image: feedback.orderId.accountId.image || null,
          }
        : {
            _id: null,
            username: null,
            name: null,
            email: null,
            phone: null,
            image: null,
          },
      product: feedback.variantId?.productId
        ? {
            product_id: feedback.variantId.productId._id || null,
            product_name: feedback.variantId.productId.productName || null,
            category_id: feedback.variantId.productId.categoryId || null,
            product_status: feedback.variantId.productId.productStatus || null,
          }
        : {
            product_id: null,
            product_name: null,
            category_id: null,
            product_status: null,
          },
      variant: feedback.variantId
        ? {
            variantId: feedback.variantId._id || null,
            color: feedback.variantId.productColorId
              ? feedback.variantId.productColorId.productColorName
              : null,
            size: feedback.variantId.productSizeId
              ? feedback.variantId.productSizeId.productSizeName
              : null,
            image: feedback.variantId.variantImage || null,
            price: feedback.variantId.variantPrice || null,
          }
        : {
            variantId: null,
            color: null,
            size: null,
            image: null,
            price: null,
          },
      feedback: {
        rating: feedback.feedback.rating || null,
        content: feedback.feedback.content || null,
        createdAt: feedback.feedback.createdAt || null,
        updatedAt: feedback.feedback.updatedAt || null,
        isDeleted: feedback.feedback.isDeleted || false,
        has_rating:
          feedback.feedback.rating !== null &&
          feedback.feedback.rating !== undefined,
        has_content:
          feedback.feedback.content && feedback.feedback.content.trim() !== "",
      },
    }));

  if (sortField === "orderDate") {
    formattedFeedbacks.sort((a, b) => {
      const aDate = new Date(a.order.orderDate || 0);
      const bDate = new Date(b.order.orderDate || 0);
      return sortDirection === 1 ? aDate - bDate : bDate - aDate;
    });
  }

  const ratings = feedbacks
    .filter((f) => f.feedback.rating !== null)
    .map((f) => f.feedback.rating);
  const totalRatings = ratings.length;
  const totalFeedbacks = feedbacks.length;

  const stats = {
    total_feedbacks: totalFeedbacks,
    total_ratings: totalRatings,
    rating_rate:
      totalFeedbacks > 0
        ? Math.round((totalRatings / totalFeedbacks) * 100)
        : 0,
    average_rating:
      totalRatings > 0
        ? Math.round(
            (ratings.reduce((sum, rating) => sum + rating, 0) / totalRatings) *
              10,
          ) / 10
        : 0,
    rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  ratings.forEach((rating) => {
    stats.rating_distribution[rating]++;
  });

  return { feedbacks: formattedFeedbacks, statistics: stats };
};

exports.getFeedbackById = async (feedbackId) => {
  if (!mongoose.isValidObjectId(feedbackId))
    throw new Error("Invalid feedback ID");

  const feedback = await OrderDetails.findById(feedbackId)
    .populate({
      path: "orderId",
      select: "orderDate orderStatus accountId finalPrice",
      populate: {
        path: "accountId",
        select: "username name email phone image",
      },
    })
    .populate({
      path: "variantId",
      select:
        "productId productColorId productSizeId variantImage variantPrice",
      populate: [
        { path: "productId", select: "productName categoryId" },
        { path: "productColorId", select: "productColorName" },
        { path: "productSizeId", select: "productSizeName" },
      ],
    });

  if (!feedback) throw new Error("Feedback not found");

  return {
    _id: feedback._id,
    order: {
      _id: feedback.orderId._id,
      orderDate: feedback.orderId.orderDate,
      orderStatus: feedback.orderId.orderStatus,
      finalPrice: feedback.orderId.finalPrice || null,
    },
    customer: {
      _id: feedback.orderId.accountId._id,
      username: feedback.orderId.accountId.username,
      name: feedback.orderId.accountId.name,
      email: feedback.orderId.accountId.email,
      phone: feedback.orderId.accountId.phone,
      image: feedback.orderId.accountId.image,
    },
    product: {
      product_id: feedback.variantId.productId._id,
      product_name: feedback.variantId.productId.productName,
      category_id: feedback.variantId.productId.categoryId,
    },
    variant: {
      variantId: feedback.variantId._id,
      color: feedback.variantId.productColorId
        ? feedback.variantId.productColorId.productColorName
        : null,
      size: feedback.variantId.productSizeId
        ? feedback.variantId.productSizeId.productSizeName
        : null,
      image: feedback.variantId.variantImage || null,
      price: feedback.variantId.variantPrice,
    },
    feedback: {
      rating: feedback.feedback.rating,
      content: feedback.feedback.content,
      createdAt: feedback.feedback.createdAt,
      updatedAt: feedback.feedback.updatedAt,
      isDeleted: feedback.feedback.isDeleted,
      has_rating:
        feedback.feedback.rating !== null &&
        feedback.feedback.rating !== undefined,
      has_content:
        feedback.feedback.content && feedback.feedback.content.trim() !== "",
    },
  };
};

exports.getFeedbackSummary = async (filters) => {
  const { dateFrom, dateTo, productId } = filters;
  const baseQuery = {};

  if (dateFrom || dateTo) {
    const dateQuery = {};
    if (dateFrom) dateQuery.$gte = new Date(dateFrom);
    if (dateTo) dateQuery.$lte = new Date(dateTo);
    baseQuery["feedback.createdAt"] = dateQuery;
  }

  if (productId && mongoose.isValidObjectId(productId)) {
    const variants = await ProductVariant.find({ productId }).select("_id");
    const variantIds = variants.map((v) => v._id);
    baseQuery.variantId = { $in: variantIds };
  }

  const allFeedbacks = await OrderDetails.find(baseQuery);

  const stats = {
    overview: {
      total_feedbacks: allFeedbacks.length,
      active_feedbacks: allFeedbacks.filter((f) => !f.feedback.isDeleted)
        .length,
      deleted_feedbacks: allFeedbacks.filter((f) => f.feedback.isDeleted)
        .length,
      with_rating: allFeedbacks.filter((f) => f.feedback.rating !== null)
        .length,
      with_content: allFeedbacks.filter(
        (f) => f.feedback.content && f.feedback.content.trim() !== "",
      ).length,
      rating_only: allFeedbacks.filter(
        (f) =>
          f.feedback.rating !== null &&
          (!f.feedback.content || f.feedback.content.trim() === ""),
      ).length,
      content_only: allFeedbacks.filter(
        (f) =>
          (!f.feedback.rating || f.feedback.rating === null) &&
          f.feedback.content &&
          f.feedback.content.trim() !== "",
      ).length,
      both_rating_content: allFeedbacks.filter(
        (f) =>
          f.feedback.rating !== null &&
          f.feedback.content &&
          f.feedback.content.trim() !== "",
      ).length,
    },
    rating_stats: {
      average_rating: 0,
      total_ratings: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      percentage_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    recent_activity: {
      last_7_days: 0,
      last_30_days: 0,
      last_90_days: 0,
    },
  };

  const ratings = allFeedbacks
    .filter((f) => f.feedback.rating !== null)
    .map((f) => f.feedback.rating);
  if (ratings.length > 0) {
    stats.rating_stats.total_ratings = ratings.length;
    stats.rating_stats.average_rating =
      Math.round(
        (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10,
      ) / 10;
    ratings.forEach((r) => stats.rating_stats.distribution[r]++);
    Object.keys(stats.rating_stats.distribution).forEach((r) => {
      stats.rating_stats.percentage_distribution[r] = Math.round(
        (stats.rating_stats.distribution[r] / ratings.length) * 100,
      );
    });
  }

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  stats.recent_activity.last_7_days = allFeedbacks.filter(
    (f) => f.feedback.createdAt && f.feedback.createdAt >= last7Days,
  ).length;
  stats.recent_activity.last_30_days = allFeedbacks.filter(
    (f) => f.feedback.createdAt && f.feedback.createdAt >= last30Days,
  ).length;
  stats.recent_activity.last_90_days = allFeedbacks.filter(
    (f) => f.feedback.createdAt && f.feedback.createdAt >= last90Days,
  ).length;

  return {
    statistics: stats,
    filters_applied: { dateFrom, dateTo, productId },
    generated_at: new Date(),
  };
};

exports.deleteFeedback = async (feedbackId) => {
  if (!mongoose.isValidObjectId(feedbackId)) {
    const error = new Error("Invalid feedback ID");
    error.status = 400;
    throw error;
  }
  const feedback = await OrderDetails.findById(feedbackId);
  if (!feedback) {
    const error = new Error("Feedback not found");
    error.status = 404;
    throw error;
  }

  feedback.feedback.isDeleted = true;
  feedback.feedback.updatedAt = new Date();
  await feedback.save();

  return {
    feedback_id: feedback._id,
    isDeleted: true,
    deleted_at: feedback.feedback.updatedAt,
  };
};

exports.restoreFeedback = async (feedbackId) => {
  if (!mongoose.isValidObjectId(feedbackId)) {
    const error = new Error("Invalid feedback ID");
    error.status = 400;
    throw error;
  }
  const feedback = await OrderDetails.findById(feedbackId);
  if (!feedback) {
    const error = new Error("Feedback not found");
    error.status = 404;
    throw error;
  }

  feedback.feedback.isDeleted = false;
  feedback.feedback.updatedAt = new Date();
  await feedback.save();

  return {
    feedback_id: feedback._id,
    isDeleted: false,
    restored_at: feedback.feedback.updatedAt,
  };
};

const orderService = require("./orderService");

exports.addFeedbackProductService = async (orderId, variantId, rating, content, user) => {
  if (rating !== undefined) {
    if (typeof rating !== 'number' || !Number.isInteger(rating)) throw new Error('Rating must be an integer');
    if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
  }

  if (content !== undefined && content !== null) {
    if (typeof content !== 'string') throw new Error('Content must be a string');
    if (content.length > 500) throw new Error('Feedback cannot exceed 500 characters');
  }

  const order = await orderService.getOrderByIdService(orderId, user);
  if (!order) {
    const err = new Error('Order not found'); err.status = 404; throw err;
  }

  if (order.orderStatus !== 'delivered') {
    const err = new Error('Feedback can only be added when the order is delivered'); err.status = 400; throw err;
  }

  const orderDetail = await OrderDetails.findOne({ orderId, variantId });
  if (!orderDetail) {
    const err = new Error('Product not found in this order'); err.status = 404; throw err;
  }

  const updateData = {};
  if (rating !== undefined) updateData['feedback.rating'] = rating;
  if (content !== undefined) updateData['feedback.content'] = content === null ? null : content.trim();
  updateData['feedback.isDeleted'] = false;
  updateData['feedback.createdAt'] = new Date();
  updateData['feedback.updatedAt'] = new Date();

  const savedOrderDetail = await OrderDetails.findByIdAndUpdate(
    orderDetail._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return { savedOrderDetail, order };
};

exports.editFeedbackProductService = async (orderId, variantId, rating, content, user) => {
  if (!rating && !content) {
    const err = new Error('Either rating or content (or both) is required'); err.status = 400; throw err;
  }

  if (rating !== undefined) {
    if (typeof rating !== 'number' || !Number.isInteger(rating)) throw new Error('Rating must be an integer');
    if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
  }

  if (content !== undefined && content !== null) {
    if (typeof content !== 'string') throw new Error('Content must be a string');
    if (content.length > 500) throw new Error('Feedback cannot exceed 500 characters');
  }

  const order = await orderService.getOrderByIdService(orderId, user);
  if (!order) {
    const err = new Error('Order not found'); err.status = 404; throw err;
  }

  if (order.orderStatus !== 'delivered') {
    const err = new Error('Feedback can only be edited when the order is delivered'); err.status = 400; throw err;
  }

  const orderDetail = await OrderDetails.findOne({ orderId, variantId });
  if (!orderDetail) {
    const err = new Error('Product not found in this order'); err.status = 404; throw err;
  }

  if (orderDetail.feedback && orderDetail.feedback.isDeleted === true) {
    const err = new Error('Feedback has been deleted'); err.status = 404; throw err;
  }

  const hasExistingFeedback = orderDetail.feedback && (
    (orderDetail.feedback.rating && orderDetail.feedback.rating !== null) ||
    (orderDetail.feedback.content && orderDetail.feedback.content.trim() !== '')
  );

  if (!hasExistingFeedback) {
    const err = new Error('No existing feedback to edit. Use add feedback instead.'); err.status = 400; throw err;
  }

  const updateData = {};
  if (rating !== undefined) updateData['feedback.rating'] = rating;
  if (content !== undefined) updateData['feedback.content'] = content === null ? null : content.trim();
  updateData['feedback.updatedAt'] = new Date();

  const savedOrderDetail = await OrderDetails.findByIdAndUpdate(
    orderDetail._id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return { savedOrderDetail, order };
};
