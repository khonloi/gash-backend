const statisticService = require('../services/statisticService');
const Account = require('../models/Accounts');
const ExcelJS = require('exceljs');

exports.viewRevenueByWeek = async (req, res) => {
  try {
    const numWeeks = parseInt(req.query.weeks) || 4;

    // Validate numWeeks
    if (numWeeks < 1 || numWeeks > 52) {
      return res.status(400).json({
        success: false,
        message: 'Number of weeks must be between 1 and 52'
      });
    }

    const result = await statisticService.getRevenueByWeek(numWeeks);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving weekly revenue',
      error: error.message
    });
  }
};

exports.viewRevenueByMonth = async (req, res) => {
  try {
    const numMonths = parseInt(req.query.months) || 24; // Default 24 months (2 years), can pass ?months=6

    // Validate numMonths
    if (numMonths < 1 || numMonths > 24) {
      return res.status(400).json({
        success: false,
        message: 'Number of months must be between 1 and 24'
      });
    }

    const result = await statisticService.getRevenueByMonth(numMonths);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving monthly revenue',
      error: error.message
    });
  }
};

exports.viewRevenueByDay = async (req, res) => {
  try {
    let startDate = req.query.startDate;
    let endDate = req.query.endDate;
    const month = req.query.month; // Format: YYYY-MM
    const year = req.query.year; // Format: YYYY

    // If month is provided, get all days in that month
    if (month) {
      const [year, monthNum] = month.split('-');
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0);
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
        return res.status(400).json({
          success: false,
          message: 'Date range cannot exceed 365 days'
        });
      }
    }

    const result = await statisticService.getRevenueByDay(startDate, endDate);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving daily revenue',
      error: error.message
    });
  }
};

exports.viewRevenueByYear = async (req, res) => {
  try {
    const numYears = parseInt(req.query.years) || 3; // Default 3 years, can pass ?years=5

    // Validate numYears
    if (numYears < 1 || numYears > 10) {
      return res.status(400).json({
        success: false,
        message: 'Number of years must be between 1 and 10'
      });
    }

    const result = await statisticService.getRevenueByYear(numYears);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving yearly revenue',
      error: error.message
    });
  }
};

// API get overview statistics
exports.getCustomerStatistics = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    const results = await Account.aggregate([
      { $match: { role: "user" } },
      {
        $facet: {
          total: [{ $count: "count" }],
          active: [{ $match: { accountStatus: "active" } }, { $count: "count" }],
          inactive: [{ $match: { accountStatus: "inactive" } }, { $count: "count" }],
          new: [{ $match: { createdAt: { $gte: startOfMonth } } }, { $count: "count" }]
        }
      }
    ]);

    const stats = results[0];
    const totalCustomers = stats.total[0] ? stats.total[0].count : 0;
    const activeCustomers = stats.active[0] ? stats.active[0].count : 0;
    const inactiveCustomers = stats.inactive[0] ? stats.inactive[0].count : 0;
    const newCustomers = stats.new[0] ? stats.new[0].count : 0;

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers,
        newCustomers,
      },
    });
  } catch (error) {
    console.error("Error fetching customer stats:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// API Export Excel
exports.exportCustomerStatistics = async (req, res) => {
  try {
    const accounts = await Account.find({ role: "user" });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customer Statistics");

    worksheet.columns = [
      { header: "Username", key: "username", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Status", key: "accountStatus", width: 15 },
      { header: "Role", key: "role", width: 10 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    accounts.forEach((acc) => {
      worksheet.addRow({
        username: acc.username,
        email: acc.email,
        phone: acc.phone || "",
        accountStatus: acc.accountStatus,
        role: acc.role,
        createdAt: new Date(acc.createdAt).toLocaleDateString(),
      });
    });

    // Set response headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=customer_statistics.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting customer statistics:", error);
    res.status(500).json({ success: false, message: "Error exporting Excel" });
  }
};

// API Get top customers (mock data if no real order data yet)
exports.getTopCustomers = async (req, res) => {
  try {
    const period = req.query.period || "month";

    // Determine filter date range
    let dateFilter = {};
    if (period === "month") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
    } else if (period === "year") {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: startOfYear } };
    }

    const topCustomers = await Account.find({ role: "user", ...dateFilter })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username email createdAt");

    // If no order data, use mock data
    const formatted = topCustomers.map((u) => ({
      id: u._id,
      name: u.username,
      email: u.email,
      orders: Math.floor(Math.random() * 10) + 1, // mock order count
      spent: Math.floor(Math.random() * 1000) + 200, // mock expenditure
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching top customers:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// API Sparkline (mock data simulating trend)
exports.getCustomerSparkline = async (req, res) => {
  try {
    const MOCK_SPARK = {
      total: [
        { d: "D-6", v: 120 },
        { d: "D-5", v: 135 },
        { d: "D-4", v: 128 },
        { d: "D-3", v: 140 },
        { d: "D-2", v: 150 },
        { d: "D-1", v: 160 },
        { d: "Today", v: 170 },
      ],
      active: [
        { d: "D-6", v: 80 },
        { d: "D-5", v: 92 },
        { d: "D-4", v: 85 },
        { d: "D-3", v: 95 },
        { d: "D-2", v: 102 },
        { d: "D-1", v: 110 },
        { d: "Today", v: 120 },
      ],
      inactive: [
        { d: "D-6", v: 30 },
        { d: "D-5", v: 28 },
        { d: "D-4", v: 30 },
        { d: "D-3", v: 32 },
        { d: "D-2", v: 34 },
        { d: "D-1", v: 36 },
        { d: "Today", v: 40 },
      ],
      new: [
        { d: "D-6", v: 10 },
        { d: "D-5", v: 15 },
        { d: "D-4", v: 13 },
        { d: "D-3", v: 13 },
        { d: "D-2", v: 14 },
        { d: "D-1", v: 20 },
        { d: "Today", v: 30 },
      ],
    };

    res.status(200).json({ success: true, data: MOCK_SPARK });
  } catch (error) {
    console.error("Error fetching sparkline data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};