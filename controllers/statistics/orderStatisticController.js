// controllers/orderStatisticsController.js
const Orders = require("../../models/Orders"); // Adjust path as needed
const NewCart = require("../../models/newCartModel"); // Adjust path as needed

async function getOrderStatistics(req, res) {
  try {
    // Total Orders
    const totalOrders = await Orders.countDocuments();

    // Orders per Day
    const ordersPerDay = await Orders.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Orders per Month
    const ordersPerMonth = await Orders.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Orders per Year
    const ordersPerYear = await Orders.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y", date: "$orderDate" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Order Status Summary
    const statusSummary = await Orders.aggregate([
      {
        $group: {
          _id: "$order_status",
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

    // Average Order Value (AOV)
    const revenueAggregate = await Orders.aggregate([
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

    // Average Processing Time (in hours, for delivered orders)
    const processingTimes = await Orders.aggregate([
      { $match: { order_status: "delivered" } },
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

    // Refund / Return Rate (% of refunded orders)
    const totalRefunded = await Orders.countDocuments({
      refund_status: "refunded",
    });
    const refundRate =
      totalOrders > 0 ? (totalRefunded / totalOrders) * 100 : 0;

    // Top Payment Methods
    const topPaymentMethods = await Orders.aggregate([
      {
        $group: {
          _id: "$payment_method",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // Limit to top 5, adjust as needed
    ]);

    // Top Shipping Regions (grouped by addressReceive, assuming it represents regions/addresses)
    const topShippingRegions = await Orders.aggregate([
      {
        $group: {
          _id: "$addressReceive",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // Top 5
    ]);

    // Cart Abandonment Rate (% of users with carts but no orders)
    const usersWithCarts = await NewCart.distinct("accountId");
    const usersWithOrders = await Orders.distinct("acc_id");
    const abandonedUsers = usersWithCarts.filter(
      (id) => !usersWithOrders.includes(id.toString())
    );
    const totalUsersWithCarts = usersWithCarts.length;
    const cartAbandonmentRate =
      totalUsersWithCarts > 0
        ? (abandonedUsers.length / totalUsersWithCarts) * 100
        : 0;

    // Compile statistics
    const statistics = {
      totalOrders,
      ordersPerDay,
      ordersPerMonth,
      ordersPerYear,
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

    res.json(statistics);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching order statistics",
      error: error.message,
    });
  }
}

module.exports = { getOrderStatistics };
