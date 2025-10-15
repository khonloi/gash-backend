const Orders = require('../models/Orders');
const Accounts = require('../models/Accounts');
const mongoose = require('mongoose');

// Helper function to format Vietnamese currency
const formatVND = (amount) => {
  return `${amount.toLocaleString('vi-VN')}`;
};

exports.getCustomerStats = async () => {
  const totalCustomers = await Accounts.countDocuments();
  const activeCustomers = await Accounts.countDocuments({ acc_status: 'active' });
  const inactiveCustomers = await Accounts.countDocuments({ acc_status: 'inactive' });
  const suspendedCustomers = await Accounts.countDocuments({ acc_status: 'suspended' });
  const roleCounts = await Accounts.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);
  return {
    totalCustomers,
    activeCustomers,
    inactiveCustomers,
    suspendedCustomers,
    roleCounts
  };
};

exports.getRevenueStats = async () => {
  const totalRevenue = await Orders.aggregate([
    { $match: { pay_status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } }
  ]);
  const averageOrderValue = await Orders.aggregate([
    { $match: { pay_status: 'paid' } },
    { $group: { _id: null, avg: { $avg: '$totalPrice' } } }
  ]);
  return {
    totalRevenue: totalRevenue[0]?.total || 0,
    averageOrderValue: averageOrderValue[0]?.avg || 0
  };
};

exports.getOrderStats = async () => {
  const totalOrders = await Orders.countDocuments();
  const statusCounts = await Orders.aggregate([
    { $group: { _id: '$order_status', count: { $sum: 1 } } }
  ]);
  const payStatusCounts = await Orders.aggregate([
    { $group: { _id: '$pay_status', count: { $sum: 1 } } }
  ]);
  const shippingStatusCounts = await Orders.aggregate([
    { $group: { _id: '$shipping_status', count: { $sum: 1 } } }
  ]);
  return {
    totalOrders,
    statusCounts,
    payStatusCounts,
    shippingStatusCounts
  };
};

exports.getRevenueByWeek = async (numWeeks = 4) => {
  const now = new Date();
  const allWeeksData = [];

  // Iterate from the oldest week to the current week
  for (let i = numWeeks - 1; i >= 0; i--) {
    const currentWeekStart = new Date(now);
    // Calculate the Sunday of the target week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    currentWeekStart.setDate(now.getDate() - (now.getDay() + (7 * i)));
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // Go to Saturday
    currentWeekEnd.setHours(23, 59, 59, 999);

    const weekRevenue = await Orders.aggregate([
      {
        $match: {
          pay_status: 'paid',
          orderDate: { $gte: currentWeekStart, $lte: currentWeekEnd }
        }
      },
      {
        $group: {
          _id: null, // Group all documents for the week
          totalRevenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    const totalRevenue = weekRevenue.length > 0 ? weekRevenue[0].totalRevenue : 0;

    allWeeksData.push({
      weekIndex: numWeeks - i, // 1 for the oldest, N for the current
      startDate: currentWeekStart,
      endDate: currentWeekEnd,
      totalRevenue: totalRevenue,
      orderCount: weekRevenue.length > 0 ? weekRevenue[0].orderCount : 0
    });
  }

  // Calculate comparison to previous week and format the output
  const formattedWeeks = allWeeksData.map((week, index) => {
    let comparison = '-';
    if (index > 0) {
      const previousWeekRevenue = allWeeksData[index - 1].totalRevenue;
      if (previousWeekRevenue > 0) {
        const change = ((week.totalRevenue - previousWeekRevenue) / previousWeekRevenue) * 100;
        comparison = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
      } else if (week.totalRevenue > 0) {
        comparison = '+100%'; // Revenue from 0 to something
      } else {
        comparison = '-'; // Still 0
      }
    }

    const startDay = week.startDate.getDate().toString().padStart(2, '0');
    const endDay = week.endDate.getDate().toString().padStart(2, '0');
    const month = (week.startDate.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed

    return {
      week: `Week ${week.weekIndex}`,
      timeRange: `${startDay}-${endDay}/${month}`,
      totalRevenue: week.totalRevenue,
      comparedToPreviousWeek: comparison
    };
  });

  // Calculate summary statistics
  const currentWeek = formattedWeeks[formattedWeeks.length - 1]; // Last week (current)
  const previousWeek = formattedWeeks[formattedWeeks.length - 2]; // Second last week

  // Total Revenue (This Week)
  const totalRevenueThisWeek = currentWeek ? currentWeek.totalRevenue : 0;

  // Change vs Last Week
  let changeVsLastWeek = '-';
  if (previousWeek && previousWeek.totalRevenue > 0) {
    const change = ((currentWeek.totalRevenue - previousWeek.totalRevenue) / previousWeek.totalRevenue) * 100;
    changeVsLastWeek = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  } else if (currentWeek && currentWeek.totalRevenue > 0) {
    changeVsLastWeek = '+100%';
  }

  // Best Week (in period)
  const bestWeek = formattedWeeks.reduce((max, week) =>
    week.totalRevenue > max.totalRevenue ? week : max,
    { totalRevenue: 0, week: 'Week 1', timeRange: '01-07/10' }
  );
  const bestWeekDisplay = bestWeek.totalRevenue > 0
    ? `${bestWeek.week} (${bestWeek.timeRange}) - ${bestWeek.totalRevenue.toLocaleString('vi-VN')}`
    : 'No data';

  return {
    success: true,
    message: 'Weekly revenue statistics retrieved successfully',
    data: {
      summary: {
        totalRevenueThisWeek: totalRevenueThisWeek,
        totalRevenueThisWeekFormatted: formatVND(totalRevenueThisWeek),
        changeVsLastWeek: changeVsLastWeek,
        bestWeekInPeriod: bestWeekDisplay
      },
      weeklyData: formattedWeeks.map(week => ({
        ...week,
        totalRevenueFormatted: formatVND(week.totalRevenue)
      }))
    }
  };
};

exports.getRevenueByMonth = async (numMonths = 12) => {
  const now = new Date();
  const allMonthsData = [];

  // Iterate from the oldest month to the current month
  for (let i = numMonths - 1; i >= 0; i--) {
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    currentMonthEnd.setHours(23, 59, 59, 999);

    const monthRevenue = await Orders.aggregate([
      {
        $match: {
          pay_status: 'paid',
          orderDate: { $gte: currentMonthStart, $lte: currentMonthEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    const totalRevenue = monthRevenue.length > 0 ? monthRevenue[0].totalRevenue : 0;

    allMonthsData.push({
      monthIndex: numMonths - i,
      startDate: currentMonthStart,
      endDate: currentMonthEnd,
      totalRevenue: totalRevenue,
      orderCount: monthRevenue.length > 0 ? monthRevenue[0].orderCount : 0
    });
  }

  // Calculate comparison to previous month and format the output
  const formattedMonths = allMonthsData.map((month, index) => {
    let comparison = '-';
    if (index > 0) {
      const previousMonthRevenue = allMonthsData[index - 1].totalRevenue;
      if (previousMonthRevenue > 0) {
        const change = ((month.totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
        comparison = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
      } else if (month.totalRevenue > 0) {
        comparison = '+100%';
      } else {
        comparison = '-';
      }
    }

    const monthName = month.startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return {
      month: `Month ${month.monthIndex}`,
      timeRange: monthName,
      totalRevenue: month.totalRevenue,
      comparedToPreviousMonth: comparison
    };
  });

  // Calculate summary statistics
  const currentMonth = formattedMonths[formattedMonths.length - 1];
  const previousMonth = formattedMonths[formattedMonths.length - 2];

  const totalRevenueThisMonth = currentMonth ? currentMonth.totalRevenue : 0;

  let changeVsLastMonth = '-';
  if (previousMonth && previousMonth.totalRevenue > 0) {
    const change = ((currentMonth.totalRevenue - previousMonth.totalRevenue) / previousMonth.totalRevenue) * 100;
    changeVsLastMonth = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  } else if (currentMonth && currentMonth.totalRevenue > 0) {
    changeVsLastMonth = '+100%';
  }

  const bestMonth = formattedMonths.reduce((max, month) =>
    month.totalRevenue > max.totalRevenue ? month : max,
    { totalRevenue: 0, month: 'Month 1', timeRange: 'Jan 2024' }
  );
  const bestMonthDisplay = bestMonth.totalRevenue > 0
    ? `${bestMonth.month} (${bestMonth.timeRange}) - ${bestMonth.totalRevenue.toLocaleString('vi-VN')}`
    : 'No data';

  return {
    success: true,
    message: 'Monthly revenue statistics retrieved successfully',
    data: {
      summary: {
        totalRevenueThisMonth: totalRevenueThisMonth,
        totalRevenueThisMonthFormatted: formatVND(totalRevenueThisMonth),
        changeVsLastMonth: changeVsLastMonth,
        bestMonthInPeriod: bestMonthDisplay
      },
      monthlyData: formattedMonths.map(month => ({
        ...month,
        totalRevenueFormatted: formatVND(month.totalRevenue)
      }))
    }
  };
};

exports.getRevenueByYear = async (numYears = 3) => {
  const now = new Date();
  const allYearsData = [];

  // Iterate from the oldest year to the current year
  for (let i = numYears - 1; i >= 0; i--) {
    const currentYearStart = new Date(now.getFullYear() - i, 0, 1);
    currentYearStart.setHours(0, 0, 0, 0);

    const currentYearEnd = new Date(now.getFullYear() - i, 11, 31);
    currentYearEnd.setHours(23, 59, 59, 999);

    const yearRevenue = await Orders.aggregate([
      {
        $match: {
          pay_status: 'paid',
          orderDate: { $gte: currentYearStart, $lte: currentYearEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    const totalRevenue = yearRevenue.length > 0 ? yearRevenue[0].totalRevenue : 0;

    allYearsData.push({
      yearIndex: numYears - i,
      startDate: currentYearStart,
      endDate: currentYearEnd,
      totalRevenue: totalRevenue,
      orderCount: yearRevenue.length > 0 ? yearRevenue[0].orderCount : 0
    });
  }

  // Calculate comparison to previous year and format the output
  const formattedYears = allYearsData.map((year, index) => {
    let comparison = '-';
    if (index > 0) {
      const previousYearRevenue = allYearsData[index - 1].totalRevenue;
      if (previousYearRevenue > 0) {
        const change = ((year.totalRevenue - previousYearRevenue) / previousYearRevenue) * 100;
        comparison = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
      } else if (year.totalRevenue > 0) {
        comparison = '+100%';
      } else {
        comparison = '-';
      }
    }

    const yearName = year.startDate.getFullYear().toString();

    return {
      year: `Year ${year.yearIndex}`,
      timeRange: yearName,
      totalRevenue: year.totalRevenue,
      comparedToPreviousYear: comparison
    };
  });

  // Calculate summary statistics
  const currentYear = formattedYears[formattedYears.length - 1];
  const previousYear = formattedYears[formattedYears.length - 2];

  const totalRevenueThisYear = currentYear ? currentYear.totalRevenue : 0;

  let changeVsLastYear = '-';
  if (previousYear && previousYear.totalRevenue > 0) {
    const change = ((currentYear.totalRevenue - previousYear.totalRevenue) / previousYear.totalRevenue) * 100;
    changeVsLastYear = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  } else if (currentYear && currentYear.totalRevenue > 0) {
    changeVsLastYear = '+100%';
  }

  const bestYear = formattedYears.reduce((max, year) =>
    year.totalRevenue > max.totalRevenue ? year : max,
    { totalRevenue: 0, year: 'Year 1', timeRange: '2022' }
  );
  const bestYearDisplay = bestYear.totalRevenue > 0
    ? `${bestYear.year} (${bestYear.timeRange}) - ${bestYear.totalRevenue.toLocaleString('vi-VN')}`
    : 'No data';

  return {
    success: true,
    message: 'Yearly revenue statistics retrieved successfully',
    data: {
      summary: {
        totalRevenueThisYear: totalRevenueThisYear,
        totalRevenueThisYearFormatted: formatVND(totalRevenueThisYear),
        changeVsLastYear: changeVsLastYear,
        bestYearInPeriod: bestYearDisplay
      },
      yearlyData: formattedYears.map(year => ({
        ...year,
        totalRevenueFormatted: formatVND(year.totalRevenue)
      }))
    }
  };
};