// controllers/orderStatisticsController.js
const Orders = require("../../models/Orders"); // Adjust path as needed
const Cart = require("../../models/Cart"); // Adjust path as needed

async function getOrderStatistics(req, res) {
  try {
    const period = req.query.period || 'day'; // Get period from query: 'day', 'week', 'month', 'year'
    const now = new Date();
    
    // Calculate date range based on period
    let startDate, endDate;
    switch (period) {
      case 'week':
        // Last 12 weeks
        startDate = new Date(now);
        startDate.setDate(now.getDate() - (now.getDay() + (7 * 11))); // 12 weeks ago
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setDate(now.getDate() - now.getDay() + 6); // End of current week
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Last 12 months
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        // Last 10 years
        startDate = new Date(now.getFullYear() - 9, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      default: // 'day'
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    // Base match filter for all queries
    const baseMatch = {
      orderDate: { $gte: startDate, $lte: endDate }
    };

    // Total Orders (within period)
    const totalOrders = await Orders.countDocuments(baseMatch);

    // Orders per Week (for week period)
    let ordersPerWeek = [];
    if (period === 'week') {
      // Get daily orders first, then group by week in JavaScript
      // This is more reliable across MongoDB versions
      const dailyOrders = await Orders.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Group daily orders into weeks (Monday to Sunday)
      const weekMap = new Map();
      dailyOrders.forEach(day => {
        const date = new Date(day._id + 'T00:00:00');
        // Get Monday of the week (day 0 = Monday)
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday-based (0 = Monday)
        const monday = new Date(date);
        monday.setDate(date.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        const weekKey = monday.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, 0);
        }
        weekMap.set(weekKey, weekMap.get(weekKey) + day.count);
      });
      
      // Convert to array format
      ordersPerWeek = Array.from(weekMap.entries())
        .map(([_id, count]) => ({ _id, count }))
        .sort((a, b) => a._id.localeCompare(b._id));
    }

    // Orders per Month (for month period)
    let ordersPerMonth = [];
    if (period === 'month') {
      ordersPerMonth = await Orders.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    // Orders per Year (for year period)
    let ordersPerYear = [];
    if (period === 'year') {
      ordersPerYear = await Orders.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y", date: "$orderDate" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    // Orders per Day (for day period)
    let ordersPerDay = [];
    if (period === 'day') {
      ordersPerDay = await Orders.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    // Order Status Summary (within period)
    const statusSummary = await Orders.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    let pendingOrders = 0;
    let completedOrders = 0; // Assuming 'delivered' as completed
    let cancelledOrders = 0;

    statusSummary.forEach((status) => {
      if (status._id === "pending") pendingOrders = status.count;
      if (status._id === "delivered") completedOrders = status.count;
      if (status._id === "cancelled") cancelledOrders = status.count;
    });

    // Average Order Value (AOV) - within period
    const revenueAggregate = await Orders.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$finalPrice" },
        },
      },
    ]);
    const totalRevenue =
      revenueAggregate.length > 0 ? revenueAggregate[0].totalRevenue : 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Average Processing Time (in hours, for delivered orders within period)
    const processingTimes = await Orders.aggregate([
      { 
        $match: { 
          orderStatus: "delivered",
          orderDate: { $gte: startDate, $lte: endDate }
        } 
      },
      {
        $project: {
          duration: {
            $divide: [{ $subtract: ["$updatedAt", "$orderDate"] }, 3600000], // milliseconds to hours
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$duration" },
        },
      },
    ]);
    const averageProcessingTime =
      processingTimes.length > 0 ? processingTimes[0].avgDuration : 0;

    // Refund / Return Rate (% of refunded orders within period)
    const totalRefunded = await Orders.countDocuments({
      refundStatus: "refunded",
      ...baseMatch
    });
    const refundRate =
      totalOrders > 0 ? (totalRefunded / totalOrders) * 100 : 0;

    // Top Payment Methods (within period)
    const topPaymentMethods = await Orders.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // Limit to top 5, adjust as needed
    ]);

    // Top Shipping Regions (grouped by addressReceive, within period)
    const topShippingRegions = await Orders.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$addressReceive",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // Top 5
    ]);

    // Cart Abandonment Rate (% of users with carts but no orders within period)
    // Calculate: Users who added items to cart within period but never placed an order in that period
    // A cart is considered "abandoned" if:
    // 1. Cart was created within the period
    // 2. No order was placed by that user within the period
    
    // Get all unique users who have carts created within the period
    const usersWithCartsInPeriod = await Cart.distinct("accountId", {
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Get all unique users who placed orders within the period
    const usersWithOrdersInPeriod = await Orders.distinct("accountId", baseMatch);
    
    // Convert both to strings for proper comparison (ObjectId comparison can be tricky)
    const usersWithOrdersSet = new Set(
      usersWithOrdersInPeriod.map(id => id.toString())
    );
    
    // Find users with carts created in period but no orders placed in period
    const abandonedUsers = usersWithCartsInPeriod.filter(
      (cartUserId) => {
        const cartUserIdStr = cartUserId.toString();
        // Check if this user placed any order in the period
        return !usersWithOrdersSet.has(cartUserIdStr);
      }
    );
    
    const totalUsersWithCarts = usersWithCartsInPeriod.length;
    const cartAbandonmentRate =
      totalUsersWithCarts > 0
        ? (abandonedUsers.length / totalUsersWithCarts) * 100
        : 0;

    // Compile statistics based on period
    const statistics = {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      averageOrderValue,
      averageProcessingTime,
      refundRate,
      topPaymentMethods,
      topShippingRegions,
      cartAbandonmentRate,
    };

    // Add period-specific data
    if (period === 'day') {
      statistics.ordersPerDay = ordersPerDay;
    } else if (period === 'week') {
      statistics.ordersPerWeek = ordersPerWeek;
    } else if (period === 'month') {
      statistics.ordersPerMonth = ordersPerMonth;
    } else if (period === 'year') {
      statistics.ordersPerYear = ordersPerYear;
    }

    res.json(statistics);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching order statistics",
      error: error.message,
    });
  }
}

module.exports = { getOrderStatistics };
