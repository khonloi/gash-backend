const debugOrderService = require("../services/debugOrderService");

/**
 * Generate random orders for testing/debugging
 * Only available when ENABLE_DEBUG_ORDERS=true
 */
const generateDebugOrders = async (req, res) => {
  try {
    // Check if debug mode is enabled
    if (process.env.ENABLE_DEBUG_ORDERS !== "true") {
      return res.status(403).json({
        success: false,
        message: "Debug order generation is disabled. This feature is only available in development/testing environments with ENABLE_DEBUG_ORDERS=true",
      });
    }

    // Check user role (must be admin or manager)
    if (req.user.role !== "admin" && req.user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators and managers can generate debug orders.",
      });
    }

    const { count } = req.body;

    if (!count || typeof count !== "number" || count < 1 || count > 1000) {
      return res.status(400).json({
        success: false,
        message: "Count must be a number between 1 and 1000",
      });
    }

    const result = await debugOrderService.bulkGenerateOrders(count);

    // Emit socket events for new orders (optional)
    if (req.app.get("io")) {
      req.app.get("io").to("orderRoom").emit("ordersGenerated", {
        count: result.count,
        timestamp: new Date(),
      });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Debug order generation error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate debug orders",
    });
  }
};

module.exports = {
  generateDebugOrders,
};

