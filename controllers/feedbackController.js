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
      sortBy = 'created_at',
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
        query['feedback.is_deleted'] = true;
      } else if (isDeleted === 'false') {
        query.$and = [
          {
            $or: [
              { 'feedback.is_deleted': { $exists: false } },
              { 'feedback.is_deleted': false }
            ]
          }
        ];
      }
    }

    if (productId && mongoose.isValidObjectId(productId)) {
      const variants = await newProductVariants.find({ productId }).select('_id');
      const variantIds = variants.map(v => v._id);
      query.variant_id = { $in: variantIds };
    }

    if (variantId && mongoose.isValidObjectId(variantId)) {
      query.variant_id = variantId;
    }

    if (userId && mongoose.isValidObjectId(userId)) {
      const orders = await Orders.find({ acc_id: userId }).select('_id');
      const orderIds = orders.map(o => o._id);
      query.order_id = { $in: orderIds };
    }

    if (orderStatus) {
      const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
      if (validStatuses.includes(orderStatus)) {
        const orders = await Orders.find({ order_status: orderStatus }).select('_id');
        const orderIds = orders.map(o => o._id);
        query.order_id = { $in: orderIds };
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
      query['feedback.created_at'] = dateQuery;
    }

    if (search && search.trim()) {
      query['feedback.content'] = { $regex: search.trim(), $options: 'i' };
    }

    const sortObj = {};
    const validSortFields = ['created_at', 'updated_at', 'rating', 'orderDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    if (sortField === 'orderDate') {
      sortObj['feedback.created_at'] = sortDirection;
    } else {
      sortObj[`feedback.${sortField}`] = sortDirection;
    }

    const feedbacks = await OrderDetails.find(query)
      .populate({
        path: 'order_id',
        select: 'orderDate order_status acc_id',
        populate: {
          path: 'acc_id',
          select: 'username name email phone image'
        }
      })
      .populate({
        path: 'variant_id',
        select: 'productId productColorId productSizeId variantImage variantPrice',
        populate: [
          { path: 'productId', select: 'productName categoryId' },
          { path: 'productColorId', select: 'color_name' },
          { path: 'productSizeId', select: 'size_name' }
        ]
      })
      .sort(sortObj);

    // Log problematic documents
    feedbacks.forEach(feedback => {
    if (!feedback.order_id) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing order_id`);
    }
    if (feedback.order_id && !feedback.order_id.acc_id) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing acc_id for order_id ${feedback.order_id._id}`);
    }
    if (!feedback.variant_id) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing variant_id`);
    }
    if (feedback.variant_id && !feedback.variant_id.productId) {
        console.warn(`OrderDetails document _id: ${feedback._id} has missing productId for variant_id ${feedback.variant_id._id}`);
    }
    });

    const formattedFeedbacks = feedbacks
      .filter(feedback => feedback.order_id && feedback.variant_id)
      .map(feedback => ({
        _id: feedback._id || null,
        order: feedback.order_id
          ? {
              _id: feedback.order_id._id || null,
              orderDate: feedback.order_id.orderDate || null,
              order_status: feedback.order_id.order_status || null
            }
          : { _id: null, orderDate: null, order_status: null },
        customer: feedback.order_id?.acc_id
          ? {
              _id: feedback.order_id.acc_id._id || null,
              username: feedback.order_id.acc_id.username || null,
              name: feedback.order_id.acc_id.name || null,
              email: feedback.order_id.acc_id.email || null,
              phone: feedback.order_id.acc_id.phone || null,
              image: feedback.order_id.acc_id.image || null
            }
          : {
              _id: null,
              username: null,
              name: null,
              email: null,
              phone: null,
              image: null
            },
        product: feedback.variant_id?.productId
          ? {
              product_id: feedback.variant_id.productId._id || null,
              product_name: feedback.variant_id.productId.productName || null,
              category_id: feedback.variant_id.productId.categoryId || null
            }
          : { product_id: null, product_name: null, category_id: null },
        variant: feedback.variant_id
          ? {
              variant_id: feedback.variant_id._id || null,
              color: feedback.variant_id.productColorId ? feedback.variant_id.productColorId.color_name : null,
              size: feedback.variant_id.productSizeId ? feedback.variant_id.productSizeId.size_name : null,
              image: feedback.variant_id.variantImage || null,
              price: feedback.variant_id.variantPrice || null
            }
          : {
              variant_id: null,
              color: null,
              size: null,
              image: null,
              price: null
            },
        feedback: {
          rating: feedback.feedback.rating || null,
          content: feedback.feedback.content || null,
          created_at: feedback.feedback.created_at || null,
          updated_at: feedback.feedback.updated_at || null,
          is_deleted: feedback.feedback.is_deleted || false,
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
                path: 'order_id',
                select: 'orderDate order_status acc_id',
                populate: {
                    path: 'acc_id',
                    select: 'username name email phone image'
                }
            })
            .populate({
                path: 'variant_id',
                select: 'productId productColorId productSizeId variantImage variantPrice',
                populate: [
                    {
                        path: 'productId',
                        select: 'productName categoryId'
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
                _id: feedback.order_id._id,
                orderDate: feedback.order_id.orderDate,
                order_status: feedback.order_id.order_status
            },
            customer: {
                _id: feedback.order_id.acc_id._id,
                username: feedback.order_id.acc_id.username,
                name: feedback.order_id.acc_id.name,
                email: feedback.order_id.acc_id.email,
                phone: feedback.order_id.acc_id.phone,
                image: feedback.order_id.acc_id.image
            },
            product: {
                product_id: feedback.variant_id.productId._id,
                product_name: feedback.variant_id.productId.productName,
                category_id: feedback.variant_id.productId.categoryId
            },
            variant: {
                variant_id: feedback.variant_id._id,
                color: feedback.variant_id.productColorId ? feedback.variant_id.productColorId.color_name : null,
                size: feedback.variant_id.productSizeId ? feedback.variant_id.productSizeId.size_name : null,
                image: feedback.variant_id.variantImage || null,
                price: feedback.variant_id.variantPrice
            },
            feedback: {
                rating: feedback.feedback.rating,
                content: feedback.feedback.content,
                created_at: feedback.feedback.created_at,
                updated_at: feedback.feedback.updated_at,
                is_deleted: feedback.feedback.is_deleted,
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
            baseQuery['feedback.created_at'] = dateQuery;
        }

        // Filter by product
        if (productId && mongoose.isValidObjectId(productId)) {
            const variants = await newProductVariants.find({ productId }).select('_id');
            const variantIds = variants.map(v => v._id);
            baseQuery.variant_id = { $in: variantIds };
        }

        // Get all feedbacks for statistics
        const allFeedbacks = await OrderDetails.find(baseQuery);

        // Calculate comprehensive statistics
        const stats = {
            overview: {
                total_feedbacks: allFeedbacks.length,
                active_feedbacks: allFeedbacks.filter(f => !f.feedback.is_deleted).length,
                deleted_feedbacks: allFeedbacks.filter(f => f.feedback.is_deleted).length,
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

        stats.recent_activity.last_7_days = allFeedbacks.filter(f => f.feedback.created_at && f.feedback.created_at >= last7Days).length;
        stats.recent_activity.last_30_days = allFeedbacks.filter(f => f.feedback.created_at && f.feedback.created_at >= last30Days).length;
        stats.recent_activity.last_90_days = allFeedbacks.filter(f => f.feedback.created_at && f.feedback.created_at >= last90Days).length;

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
        feedback.feedback.is_deleted = true;
        feedback.feedback.updated_at = new Date();
        await feedback.save();

        res.status(200).json({
            success: true,
            message: 'Feedback deleted successfully',
            data: {
                feedback_id: feedback._id,
                is_deleted: true,
                deleted_at: feedback.feedback.updated_at
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
        feedback.feedback.is_deleted = false;
        feedback.feedback.updated_at = new Date();
        await feedback.save();

        res.status(200).json({
            success: true,
            message: 'Feedback restored successfully',
            data: {
                feedback_id: feedback._id,
                is_deleted: false,
                restored_at: feedback.feedback.updated_at
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
