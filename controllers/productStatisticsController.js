const productStatisticService = require('../services/productStatisticService');
const catchAsync = require('./utils/catchAsync');

/* ======================================================
   API: Product Statistics Overview (filtered)
   ====================================================== */
exports.getProductStatistics = catchAsync(async (req, res) => {
  const data = await productStatisticService.getProductStatisticsService(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

/* ======================================================
   API: Category Distribution Statistics
   ====================================================== */
exports.getCategoryDistribution = catchAsync(async (req, res) => {
  const data = await productStatisticService.getCategoryDistributionService();

  res.status(200).json({
    success: true,
    data,
  });
});

/* ======================================================
   API: Top Selling Products
   ====================================================== */
exports.getTopProducts = catchAsync(async (req, res) => {
  const data = await productStatisticService.getTopProductsService(req.query.limit);

  res.status(200).json({ success: true, data });
});

/* ======================================================
   API: Export Product Statistics to Excel
   ====================================================== */
exports.exportProductStatistics = catchAsync(async (req, res) => {
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
});
