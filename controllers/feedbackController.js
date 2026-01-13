const mongoose = require('mongoose');
const OrderDetails = require('../models/OrderDetails');
const Orders = require('../models/Orders');
const newProducts = require('../models/newProduct');
const newProductVariants = require('../models/newProductVariant');
const ProductColors = require('../models/ProductColors');
const ProductSizes = require('../models/ProductSizes');
const Accounts = require('../models/Accounts');

// Hàm lấy tất cả feedback cho admin và staff
exports.getAllFeedback = async (req, res) => {
  try {
    const {
      sortBy = 'createdAt',
      sortOrder = 'desc',
      rating,
      hasContent,
      isDeleted,
      productId,
      variantId,
      userId,
      orderStatus,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const query = {};

    if (rating !== undefined) {
      const ratingNum = parseInt(rating);
      if (ratingNum >= 1 && ratingNum <= 5) {
        query['feedback.rating'] = ratingNum;
      }
    }

    if (hasContent !== undefined) {
      if (hasContent === 'true') {
        query['feedback.content'] = { $exists: true, $ne: '', $ne: null };
      } else if (hasContent === 'false') {
        query.$or = [
          { 'feedback.content': { $exists: false } },
          { 'feedback.content': '' },
          { 'feedback.content': null }
        ];
      }
    }

    if (isDeleted !== undefined) {
      if (isDeleted === 'true') {
        query['feedback.isDeleted'] = true;
      } else if (isDeleted === 'false') {
        query.$and = [
          {
            $or: [
              { 'feedback.isDeleted': { $exists: false } },
              { 'feedback.isDeleted': false }
            ]
          }
        ];
      }
    }

    if (productId && mongoose.isValidObjectId(productId)) {
      const variants = await newProductVariants.find({ productId }).select('_id');
      const variantIds = variants.map(v => v._id);
      query.variantId = { $in: variantIds };
    }

    if (variantId && mongoose.isValidObjectId(variantId)) {
      query.variantId = variantId;
    }

    if (userId && mongoose.isValidObjectId(userId)) {
      const orders = await Orders.find({ accountId: userId }).select('_id');
      const orderIds = orders.map(o => o._id);
      query.orderId = { $in: orderIds };
    }

    if (orderStatus) {
      const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
      if (validStatuses.includes(orderStatus)) {
        const orders = await Orders.find({ orderStatus: orderStatus }).select('_id');
        const orderIds = orders.map(o => o._id);
        query.orderId = { $in: orderIds };
      }
    }

    if (dateFrom || dateTo) {
      const dateQuery = {};
      if (dateFrom) {
        dateQuery.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateQuery.$lte = new Date(dateTo);
      }
      query['feedback.createdAt'] = dateQuery;
    }

    if (search && search.trim()) {
      query['feedback.content'] = { $regex: search.trim(), $options: 'i' };
    }

    // Filter out feedbacks with no rating and no content
    // Only include feedbacks that have at least rating OR content
    const hasRatingOrContent = {
      $or: [
        { 'feedback.rating': { $exists: true, $ne: null, $gte: 1, $lte: 5 } },
        { 'feedback.content': { $exists: true, $ne: '', $ne: null } }
      ]
    };
    
    if (Object.keys(query).length > 0) {
      // If there are existing conditions, combine them with $and
      if (query.$and) {
        // If $and already exists, add to it
        query.$and.push(hasRatingOrContent);
      } else {
        // Wrap existing conditions in $and
        const existingConditions = { ...query };
        // Clear query and rebuild with $and
        Object.keys(query).forEach(key => delete query[key]);
        query.$and = [
          existingConditions,
          hasRatingOrContent
        ];
      }
    } else {
      // If no existing conditions, just use the rating/content requirement
      Object.assign(query, hasRatingOrContent);
    }

    const sortObj = {};
    const validSortFields = ['createdAt', 'updatedAt', 'rating', 'orderDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    if (sortField === 'orderDate') {
      sortObj['feedback.createdAt'] = sortDirection;
    } else {
      sortObj[`feedback.${sortField}`] = sortDirection;
    }

    const feedbacks = await OrderDetails.find(query)
      .populate({
        path: 'orderId',
        select: 'orderDate orderStatus accountId',
        populate: {
          path: 'accountId',
          select: 'username name email phone image'
        }
      })
      .populate({
        path: 'variantId',
        select: 'productId productColorId productSizeId variantImage variantPrice',
        populate: [
          { path: 'productId', select: 'productName categoryId productStatus' },
          { path: 'productColorId', select: 'productColorName' },
          { path: 'productSizeId', select: 'productSizeName' }
        ]
      })
      .sort(sortObj);

    // Log problematic documents
    feedbacks.forEach(feedback => {
      if (!feedback.orderId) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing orderId`);
      }
      if (feedback.orderId && !feedback.orderId.accountId) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing accountId for orderId ${feedback.orderId._id}`);
      }
      if (!feedback.variantId) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing variantId`);
      }
      if (feedback.variantId && !feedback.variantId.productId) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing productId for variantId ${feedback.variantId._id}`);
      }
    });

    const formattedFeedbacks = feedbacks
      .filter(feedback => {
        // Filter out feedbacks with no rating and no content
        const hasRating = feedback.feedback?.rating !== null && feedback.feedback?.rating !== undefined && feedback.feedback.rating >= 1 && feedback.feedback.rating <= 5;
        const hasContent = feedback.feedback?.content && feedback.feedback.content.trim() !== '';
        return feedback.orderId && feedback.variantId && (hasRating || hasContent);
      })
      .map(feedback => ({
        _id: feedback._id || null,
        order: feedback.orderId
          ? {
            _id: feedback.orderId._id || null,
            orderDate: feedback.orderId.orderDate || null,
            orderStatus: feedback.orderId.orderStatus || null
          }
          : { _id: null, orderDate: null, orderStatus: null },
        customer: feedback.orderId?.accountId
          ? {
            _id: feedback.orderId.accountId._id || null,
            username: feedback.orderId.accountId.username || null,
            name: feedback.orderId.accountId.name || null,
            email: feedback.orderId.accountId.email || null,
            phone: feedback.orderId.accountId.phone || null,
            image: feedback.orderId.accountId.image || null
          }
          : {
            _id: null,
            username: null,
            name: null,
            email: null,
            phone: null,
            image: null
          },
        product: feedback.variantId?.productId
          ? {
            product_id: feedback.variantId.productId._id || null,
            product_name: feedback.variantId.productId.productName || null,
            category_id: feedback.variantId.productId.categoryId || null,
            product_status: feedback.variantId.productId.productStatus || null
          }
          : { product_id: null, product_name: null, category_id: null, product_status: null },
        variant: feedback.variantId
          ? {
            variantId: feedback.variantId._id || null,
            color: feedback.variantId.productColorId ? feedback.variantId.productColorId.productColorName : null,
            size: feedback.variantId.productSizeId ? feedback.variantId.productSizeId.productSizeName : null,
            image: feedback.variantId.variantImage || null,
            price: feedback.variantId.variantPrice || null
          }
          : {
            variantId: null,
            color: null,
            size: null,
            image: null,
            price: null
          },
        feedback: {
          rating: feedback.feedback.rating || null,
          content: feedback.feedback.content || null,
          createdAt: feedback.feedback.createdAt || null,
          updatedAt: feedback.feedback.updatedAt || null,
          isDeleted: feedback.feedback.isDeleted || false,
          has_rating: feedback.feedback.rating !== null && feedback.feedback.rating !== undefined,
          has_content: feedback.feedback.content && feedback.feedback.content.trim() !== ''
        }
      }));

    if (sortField === 'orderDate') {
      formattedFeedbacks.sort((a, b) => {
        const aDate = new Date(a.order.orderDate || 0);
        const bDate = new Date(b.order.orderDate || 0);
        return sortDirection === 1 ? aDate - bDate : bDate - aDate;
      });
    }

    const ratings = feedbacks.filter(f => f.feedback.rating !== null).map(f => f.feedback.rating);
    const totalRatings = ratings.length;
    const totalFeedbacks = feedbacks.length;

    const stats = {
      total_feedbacks: totalFeedbacks,
      total_ratings: totalRatings,
      rating_rate: totalFeedbacks > 0 ? Math.round((totalRatings / totalFeedbacks) * 100) : 0,
      average_rating: totalRatings > 0 ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / totalRatings) * 10) / 10 : 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    ratings.forEach(rating => {
      stats.rating_distribution[rating]++;
    });

    res.status(200).json({
      success: true,
      message: 'Feedbacks retrieved successfully',
      data: {
        feedbacks: formattedFeedbacks,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Get all feedback error:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving feedbacks',
      stack: error.stack
    });
  }
};

// Hàm lấy 1 feedback cụ thể theo ID
exports.getFeedbackById = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    if (!mongoose.isValidObjectId(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback ID'
      });
    }

    const feedback = await OrderDetails.findById(feedbackId)
      .populate({
        path: 'orderId',
        select: 'orderDate orderStatus accountId finalPrice',
        populate: {
          path: 'accountId',
          select: 'username name email phone image'
        }
      })
      .populate({
        path: 'variantId',
        select: 'productId productColorId productSizeId variantImage variantPrice',
        populate: [
          {
            path: 'productId',
            select: 'productName categoryId'
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
      });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Format response
    const formattedFeedback = {
      _id: feedback._id,
      order: {
        _id: feedback.orderId._id,
        orderDate: feedback.orderId.orderDate,
        orderStatus: feedback.orderId.orderStatus,
        finalPrice: feedback.orderId.finalPrice || null
      },
      customer: {
        _id: feedback.orderId.accountId._id,
        username: feedback.orderId.accountId.username,
        name: feedback.orderId.accountId.name,
        email: feedback.orderId.accountId.email,
        phone: feedback.orderId.accountId.phone,
        image: feedback.orderId.accountId.image
      },
      product: {
        product_id: feedback.variantId.productId._id,
        product_name: feedback.variantId.productId.productName,
        category_id: feedback.variantId.productId.categoryId
      },
      variant: {
        variantId: feedback.variantId._id,
        color: feedback.variantId.productColorId ? feedback.variantId.productColorId.productColorName : null,
        size: feedback.variantId.productSizeId ? feedback.variantId.productSizeId.productSizeName : null,
        image: feedback.variantId.variantImage || null,
        price: feedback.variantId.variantPrice
      },
      feedback: {
        rating: feedback.feedback.rating,
        content: feedback.feedback.content,
        createdAt: feedback.feedback.createdAt,
        updatedAt: feedback.feedback.updatedAt,
        isDeleted: feedback.feedback.isDeleted,
        has_rating: feedback.feedback.rating !== null && feedback.feedback.rating !== undefined,
        has_content: feedback.feedback.content && feedback.feedback.content.trim() !== ''
      }
    };

    res.status(200).json({
      success: true,
      message: 'Feedback retrieved successfully',
      data: formattedFeedback
    });

  } catch (error) {
    console.error('Get feedback by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving feedback'
    });
  }
};

// Hàm lấy thống kê feedback tổng quan
exports.getFeedbackStatistics = async (req, res) => {
  try {
    const { dateFrom, dateTo, productId } = req.query;

    // Build base query
    const baseQuery = {};

    // Filter by date range
    if (dateFrom || dateTo) {
      const dateQuery = {};
      if (dateFrom) {
        dateQuery.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateQuery.$lte = new Date(dateTo);
      }
      baseQuery['feedback.createdAt'] = dateQuery;
    }

    // Filter by product
    if (productId && mongoose.isValidObjectId(productId)) {
      const variants = await newProductVariants.find({ productId }).select('_id');
      const variantIds = variants.map(v => v._id);
      baseQuery.variantId = { $in: variantIds };
    }

    // Get all feedbacks for statistics
    const allFeedbacks = await OrderDetails.find(baseQuery);

    // Calculate comprehensive statistics
    const stats = {
      overview: {
        total_feedbacks: allFeedbacks.length,
        active_feedbacks: allFeedbacks.filter(f => !f.feedback.isDeleted).length,
        deleted_feedbacks: allFeedbacks.filter(f => f.feedback.isDeleted).length,
        with_rating: allFeedbacks.filter(f => f.feedback.rating !== null).length,
        with_content: allFeedbacks.filter(f => f.feedback.content && f.feedback.content.trim() !== '').length,
        rating_only: allFeedbacks.filter(f => f.feedback.rating !== null && (!f.feedback.content || f.feedback.content.trim() === '')).length,
        content_only: allFeedbacks.filter(f => (!f.feedback.rating || f.feedback.rating === null) && f.feedback.content && f.feedback.content.trim() !== '').length,
        both_rating_content: allFeedbacks.filter(f => f.feedback.rating !== null && f.feedback.content && f.feedback.content.trim() !== '').length
      },
      rating_stats: {
        average_rating: 0,
        total_ratings: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        percentage_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      },
      recent_activity: {
        last_7_days: 0,
        last_30_days: 0,
        last_90_days: 0
      }
    };

    // Calculate rating statistics
    const ratings = allFeedbacks.filter(f => f.feedback.rating !== null).map(f => f.feedback.rating);
    if (ratings.length > 0) {
      stats.rating_stats.total_ratings = ratings.length;
      stats.rating_stats.average_rating = Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;

      // Distribution
      ratings.forEach(rating => {
        stats.rating_stats.distribution[rating]++;
      });

      // Percentage distribution
      Object.keys(stats.rating_stats.distribution).forEach(rating => {
        stats.rating_stats.percentage_distribution[rating] = Math.round((stats.rating_stats.distribution[rating] / ratings.length) * 100);
      });
    }

    // Calculate recent activity
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    stats.recent_activity.last_7_days = allFeedbacks.filter(f => f.feedback.createdAt && f.feedback.createdAt >= last7Days).length;
    stats.recent_activity.last_30_days = allFeedbacks.filter(f => f.feedback.createdAt && f.feedback.createdAt >= last30Days).length;
    stats.recent_activity.last_90_days = allFeedbacks.filter(f => f.feedback.createdAt && f.feedback.createdAt >= last90Days).length;

    res.status(200).json({
      success: true,
      message: 'Feedback statistics retrieved successfully',
      data: {
        statistics: stats,
        filters_applied: {
          dateFrom,
          dateTo,
          productId
        },
        generated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Get feedback statistics error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving feedback statistics'
    });
  }
};

// Hàm xóa feedback (soft delete) cho admin
exports.deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    if (!mongoose.isValidObjectId(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback ID'
      });
    }

    const feedback = await OrderDetails.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Soft delete
    feedback.feedback.isDeleted = true;
    feedback.feedback.updatedAt = new Date();
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully',
      data: {
        feedback_id: feedback._id,
        isDeleted: true,
        deleted_at: feedback.feedback.updatedAt
      }
    });

  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting feedback'
    });
  }
};

// Hàm khôi phục feedback đã xóa cho admin
exports.restoreFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    if (!mongoose.isValidObjectId(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feedback ID'
      });
    }

    const feedback = await OrderDetails.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Restore
    feedback.feedback.isDeleted = false;
    feedback.feedback.updatedAt = new Date();
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Feedback restored successfully',
      data: {
        feedback_id: feedback._id,
        isDeleted: false,
        restored_at: feedback.feedback.updatedAt
      }
    });

  } catch (error) {
    console.error('Restore feedback error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error restoring feedback'
    });
  }
};
