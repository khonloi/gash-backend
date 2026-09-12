const statisticService = require('../services/statisticService');

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
    const numMonths = parseInt(req.query.months) || 24; // Default 24 months (2 years), có thể truyền ?months=6

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
    const numYears = parseInt(req.query.years) || 3; // Default 3 years, có thể truyền ?years=5

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