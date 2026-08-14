const productStatisticService = require('../services/productStatisticService');

/* ======================================================
   API: Product Statistics Overview (filtered)
   ====================================================== */
exports.getProductStatistics = async (req, res) => {
  try {
    const data = await productStatisticService.getProductStatisticsService(req.query);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching product statistics:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ======================================================
   API: Category Distribution Statistics
   ====================================================== */
exports.getCategoryDistribution = async (req, res) => {
  try {
    const data = await productStatisticService.getCategoryDistributionService();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching category distribution:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category distribution",
    });
  }
};

/* ======================================================
   API: Top Selling Products
   ====================================================== */
exports.getTopProducts = async (req, res) => {
  try {
    const data = await productStatisticService.getTopProductsService(req.query.limit);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching top products",
    });
  }
};

/* ======================================================
   API: Export Product Statistics to Excel
   ====================================================== */
exports.exportProductStatistics = async (req, res) => {
  try {
    const workbook = await productStatisticService.exportProductStatisticsService();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=product_statistics.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting product statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting Excel",
    });
  }
};
