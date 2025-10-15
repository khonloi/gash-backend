const statisticService = require('../services/statisticService');

exports.viewCustomerStats = async (req, res) => {
  try {
    const stats = await statisticService.getCustomerStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving customer statistics', error: error.message });
  }
};

exports.viewRevenueStats = async (req, res) => {
  try {
    const stats = await statisticService.getRevenueStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving revenue statistics', error: error.message });
  }
};

exports.viewOrderStats = async (req, res) => {
  try {
    const stats = await statisticService.getOrderStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving order statistics', error: error.message });
  }
};

exports.viewRevenueByWeek = async (req, res) => {
  try {
    const numWeeks = parseInt(req.query.weeks) || 4; // Default 4 weeks, có thể truyền ?weeks=6

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
    const numMonths = parseInt(req.query.months) || 12; // Default 12 months, có thể truyền ?months=6

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