const statisticService = require('../services/statisticService');
const catchAsync = require('./utils/catchAsync');
const AppError = require('../utils/AppError');

exports.viewRevenueByWeek = catchAsync(async (req, res) => {
  const numWeeks = parseInt(req.query.weeks) || 4;

  // Validate numWeeks
  if (numWeeks < 1 || numWeeks > 52) {
    throw new AppError('Number of weeks must be between 1 and 52', 400);
  }

  const result = await statisticService.getRevenueByWeek(numWeeks);
  res.status(200).json(result);
});

exports.viewRevenueByMonth = catchAsync(async (req, res) => {
  const numMonths = parseInt(req.query.months) || 24; // Default 24 months (2 years), can pass ?months=6

  // Validate numMonths
  if (numMonths < 1 || numMonths > 24) {
    throw new AppError('Number of months must be between 1 and 24', 400);
  }

  const result = await statisticService.getRevenueByMonth(numMonths);
  res.status(200).json(result);
});

exports.viewRevenueByDay = catchAsync(async (req, res) => {
  let startDate = req.query.startDate;
  let endDate = req.query.endDate;
  const month = req.query.month; // Format: YYYY-MM
  const year = req.query.year; // Format: YYYY

  // If month is provided, get all days in that month
  if (month) {
    const [yearVal, monthNum] = month.split('-');
    startDate = new Date(yearVal, monthNum - 1, 1);
    endDate = new Date(yearVal, monthNum, 0);
  }
  // If year is provided, get all days in that year
  else if (year) {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
  }
  // If no specific date range, default to current month
  else if (!startDate || !endDate) {
    const now = new Date();
    // Start: First day of current month at 00:00:00
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    // End: Last day of current month at 23:59:59
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  // Validate date range
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

    if (daysDiff > 365) {
      throw new AppError('Date range cannot exceed 365 days', 400);
    }
  }

  const result = await statisticService.getRevenueByDay(startDate, endDate);
  res.status(200).json(result);
});

exports.viewRevenueByYear = catchAsync(async (req, res) => {
  const numYears = parseInt(req.query.years) || 3; // Default 3 years, can pass ?years=5

  // Validate numYears
  if (numYears < 1 || numYears > 10) {
    throw new AppError('Number of years must be between 1 and 10', 400);
  }

  const result = await statisticService.getRevenueByYear(numYears);
  res.status(200).json(result);
});

// API get overview statistics
exports.getCustomerStatistics = catchAsync(async (req, res) => {
  const data = await statisticService.getCustomerStatistics();
  res.status(200).json({
    success: true,
    data,
  });
});

// API Export Excel
exports.exportCustomerStatistics = catchAsync(async (req, res) => {
  const workbook = await statisticService.generateCustomerExcel();

  // Set response headers for file download
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=customer_statistics.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

// API Get top customers (mock data if no real order data yet)
exports.getTopCustomers = catchAsync(async (req, res) => {
  const period = req.query.period || "month";
  const data = await statisticService.getTopCustomers(period);
  res.status(200).json({ success: true, data });
});

// API Sparkline (mock data simulating trend)
exports.getCustomerSparkline = catchAsync(async (req, res) => {
  const data = await statisticService.getCustomerSparkline();
  res.status(200).json({ success: true, data });
});