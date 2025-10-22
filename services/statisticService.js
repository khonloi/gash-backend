const Orders = require('../models/Orders');
const Accounts = require('../models/Accounts');
const mongoose = require('mongoose');

// Helper function to format Vietnamese currency
const formatVND = (amount) => {
  return `${amount.toLocaleString('vi-VN')}`;
};

// Helper to map month number (1-12) to full English month names
// Returns labels like "January", "February", ...
const getMonthName = (monthNumber) => {
  const index = parseInt(monthNumber, 10) - 1;
  const labels = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (index >= 0 && index < labels.length) return labels[index];
  return '';
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

  // Calculate date range for all weeks
  const oldestWeekStart = new Date(now);
  oldestWeekStart.setDate(now.getDate() - (now.getDay() + (7 * (numWeeks - 1))));
  oldestWeekStart.setHours(0, 0, 0, 0);

  const currentWeekEnd = new Date(now);
  currentWeekEnd.setDate(now.getDate() - now.getDay() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);

  // ✅ Query ALL data once with daily grouping
  const dailyRevenue = await Orders.aggregate([
    {
      $match: {
        pay_status: 'paid',
        orderDate: { $gte: oldestWeekStart, $lte: currentWeekEnd }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$orderDate' }
        },
        totalRevenue: { $sum: '$totalPrice' }
      }
    }
  ]);

  // Create revenue map for fast lookup
  const revenueMap = new Map();
  dailyRevenue.forEach(item => {
    revenueMap.set(item._id, item.totalRevenue);
  });

  // Build weeks data from the map
  const allWeeksData = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - (now.getDay() + (7 * i)));
    currentWeekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Sum revenue for all days in this week
    let totalRevenue = 0;
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(currentWeekStart);
      dayDate.setDate(currentWeekStart.getDate() + d);
      const dateKey = dayDate.toISOString().split('T')[0];
      totalRevenue += revenueMap.get(dateKey) || 0;
    }

    allWeeksData.push({
      weekIndex: numWeeks - i,
      startDate: currentWeekStart,
      endDate: weekEnd,
      totalRevenue: totalRevenue
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

  // Calculate period metrics
  const averageWeeklyRevenue = allWeeksData.length > 0
    ? allWeeksData.reduce((total, week) => total + week.totalRevenue, 0) / allWeeksData.length
    : 0;

  // Calculate comparison with 4 weeks average (trend)
  let trend = 'stable';
  let trendDescription = 'Stable';
  let changePercentage = '0%';

  if (allWeeksData.length >= 4) {
    const last4Weeks = allWeeksData.slice(-5, -1); // Last 4 weeks (excluding current week)
    const average4Weeks = last4Weeks.reduce((total, week) => total + week.totalRevenue, 0) / 4;
    if (average4Weeks > 0) {
      const change = ((totalRevenueThisWeek - average4Weeks) / average4Weeks) * 100;
      changePercentage = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

      // Determine trend based on change percentage
      if (change > 20) {
        trend = 'increasing';
        trendDescription = 'Strong Growth';
      } else if (change > 10) {
        trend = 'increasing';
        trendDescription = 'Moderate Growth';
      } else if (change < -20) {
        trend = 'decreasing';
        trendDescription = 'Strong Decline';
      } else if (change < -10) {
        trend = 'decreasing';
        trendDescription = 'Moderate Decline';
      } else {
        trend = 'stable';
        trendDescription = 'Stable';
      }
    } else if (totalRevenueThisWeek > 0) {
      changeVs4WeeksAverage = '+100%';
      changePercentage = '+100%';
      trend = 'increasing';
      trendDescription = 'Strong Growth';
    }
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
        // Doanh thu tuần này
        currentWeekRevenue: totalRevenueThisWeek,
        currentWeekRevenueFormatted: formatVND(totalRevenueThisWeek) + ' VND',

        // % so với tuần trước
        changeVsLastWeek: changeVsLastWeek,

        // Xu hướng doanh thu (so với trung bình 4 tuần trước)
        trend: {
          status: trend,
          description: trendDescription,
          changePercentage: changePercentage,
          comparedTo: '4-week average'
        },

        // Doanh thu trung bình 1 tuần
        averageWeeklyRevenue: Math.round(averageWeeklyRevenue),
        averageWeeklyRevenueFormatted: formatVND(Math.round(averageWeeklyRevenue)) + ' VND',

        // Tuần có doanh thu cao nhất
        bestWeek: bestWeekDisplay + ' VND',
      },
      weeklyData: formattedWeeks.map(week => ({
        ...week,
        totalRevenueFormatted: formatVND(week.totalRevenue)
      }))
    }
  };
};

exports.getRevenueByMonth = async (numMonths = 24) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  // Get data from January of previous year to current month
  const startYear = previousYear;
  const startMonth = 0; // January
  const endYear = currentYear;
  const endMonth = now.getMonth(); // Current month

  // Calculate total months to process
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

  // Calculate date range
  const startDate = new Date(startYear, startMonth, 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(endYear, endMonth + 1, 0);
  endDate.setHours(23, 59, 59, 999);

  // ✅ Query ALL data once with monthly grouping
  const monthlyRevenue = await Orders.aggregate([
    {
      $match: {
        pay_status: 'paid',
        orderDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' }
        },
        totalRevenue: { $sum: '$totalPrice' }
      }
    }
  ]);

  // Create revenue map for fast lookup
  const revenueMap = new Map();
  monthlyRevenue.forEach(item => {
    const key = `${item._id.year}-${item._id.month}`;
    revenueMap.set(key, item.totalRevenue);
  });

  // Build months data from the map
  const allMonthsData = [];
  for (let i = 0; i < totalMonths; i++) {
    const targetYear = startYear + Math.floor((startMonth + i) / 12);
    const targetMonth = (startMonth + i) % 12 + 1; // 1-12

    const key = `${targetYear}-${targetMonth}`;
    const totalRevenue = revenueMap.get(key) || 0;

    allMonthsData.push({
      month: targetMonth,
      year: targetYear,
      totalRevenue: totalRevenue
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

    const monthNumber = month.month.toString().padStart(2, '0');

    return {
      month: getMonthName(monthNumber),
      year: month.year,
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

  // Find best month in the period
  const bestMonth = formattedMonths.reduce((max, month) =>
    month.totalRevenue > max.totalRevenue ? month : max,
    { totalRevenue: 0, month: 'January', year: new Date().getFullYear() }
  );
  const bestMonthDisplay = bestMonth.totalRevenue > 0
    ? `${bestMonth.month} ${bestMonth.year} - ${bestMonth.totalRevenue.toLocaleString('vi-VN')} VND`
    : 'No data';

  // Calculate period metrics
  const averageMonthlyRevenue = allMonthsData.length > 0
    ? allMonthsData.reduce((total, month) => total + month.totalRevenue, 0) / allMonthsData.length
    : 0;

  // Calculate comparison with 3 months average (trend)
  let trend = 'stable';
  let trendDescription = 'Stable';
  let changePercentage = '0%';

  if (allMonthsData.length >= 3) {
    const last3Months = allMonthsData.slice(-4, -1); // Last 3 months (excluding current month)
    const average3Months = last3Months.reduce((total, month) => total + month.totalRevenue, 0) / 3;
    if (average3Months > 0) {
      const change = ((totalRevenueThisMonth - average3Months) / average3Months) * 100;
      changePercentage = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

      // Determine trend based on change percentage
      if (change > 20) {
        trend = 'increasing';
        trendDescription = 'Strong Growth';
      } else if (change > 10) {
        trend = 'increasing';
        trendDescription = 'Moderate Growth';
      } else if (change < -20) {
        trend = 'decreasing';
        trendDescription = 'Strong Decline';
      } else if (change < -10) {
        trend = 'decreasing';
        trendDescription = 'Moderate Decline';
      } else {
        trend = 'stable';
        trendDescription = 'Stable';
      }
    } else if (totalRevenueThisMonth > 0) {
      changePercentage = '+100%';
      trend = 'increasing';
      trendDescription = 'Strong Growth';
    }
  }

  // Calculate year-over-year comparison
  let changeVsSamePeriodLastYear = '-';
  if (allMonthsData.length >= 12) {
    const currentYearRevenue = allMonthsData.slice(-12).reduce((total, month) => total + month.totalRevenue, 0);
    const lastYearRevenue = allMonthsData.slice(-24, -12).reduce((total, month) => total + month.totalRevenue, 0);
    if (lastYearRevenue > 0) {
      const change = ((currentYearRevenue - lastYearRevenue) / lastYearRevenue) * 100;
      changeVsSamePeriodLastYear = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    } else if (currentYearRevenue > 0) {
      changeVsSamePeriodLastYear = '+100%';
    }
  }

  return {
    success: true,
    message: 'Monthly revenue statistics retrieved successfully',
    data: {
      summary: {
        // Doanh thu tháng này
        currentMonthRevenue: totalRevenueThisMonth,
        currentMonthRevenueFormatted: formatVND(totalRevenueThisMonth) + ' VND',

        // % so với tháng trước
        changeVsLastMonth: changeVsLastMonth,

        // Xu hướng doanh thu (so với trung bình 3 tháng trước)
        trend: {
          status: trend,
          description: trendDescription,
          changePercentage: changePercentage,
          comparedTo: '3-month average'
        },

        // % so với cùng kỳ năm trước
        changeVsSamePeriodLastYear: changeVsSamePeriodLastYear,

        // Doanh thu trung bình 1 tháng
        averageMonthlyRevenue: Math.round(averageMonthlyRevenue),
        averageMonthlyRevenueFormatted: formatVND(Math.round(averageMonthlyRevenue)) + ' VND',

        // Tháng có doanh thu cao nhất
        bestMonth: bestMonthDisplay
      },
      monthlyData: formattedMonths.map(month => ({
        ...month,
        totalRevenueFormatted: formatVND(month.totalRevenue) + ' VND'
      }))
    }
  };
};

exports.getRevenueByDay = async (startDate, endDate) => {
  // If no dates provided, default to current month
  if (!startDate || !endDate) {
    const now = new Date();
    // Start: First day of current month at 00:00:00
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    // End: Last day of current month at 23:59:59
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  // Convert to Date objects if strings
  if (typeof startDate === 'string') startDate = new Date(startDate);
  if (typeof endDate === 'string') endDate = new Date(endDate);

  // Set time boundaries
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // Calculate number of days
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;

  // Calculate date 7 days before startDate to get data for comparison
  const extendedStartDate = new Date(startDate.getTime() - (7 * 24 * 60 * 60 * 1000));
  extendedStartDate.setHours(0, 0, 0, 0);

  // ✅ Query ALL data once with daily grouping (including 7 days before for comparison)
  const dailyRevenue = await Orders.aggregate([
    {
      $match: {
        pay_status: 'paid',
        orderDate: { $gte: extendedStartDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$orderDate' }
        },
        totalRevenue: { $sum: '$totalPrice' }
      }
    }
  ]);

  // Create revenue map for fast lookup
  const revenueMap = new Map();
  dailyRevenue.forEach(item => {
    revenueMap.set(item._id, item.totalRevenue);
  });

  // Build days data from the map
  const allDaysData = [];
  for (let i = 0; i < daysDiff; i++) {
    const currentDay = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
    const dateKey = currentDay.toISOString().split('T')[0];
    const totalRevenue = revenueMap.get(dateKey) || 0;

    allDaysData.push({
      date: currentDay,
      totalRevenue: totalRevenue
    });
  }

  // Calculate comparison to previous day and format the output
  const formattedDays = allDaysData.map((day, index) => {
    // Compare to previous day
    let comparison = '-';
    if (index > 0) {
      const previousDayRevenue = allDaysData[index - 1].totalRevenue;
      if (previousDayRevenue > 0) {
        const change = ((day.totalRevenue - previousDayRevenue) / previousDayRevenue) * 100;
        comparison = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
      } else if (day.totalRevenue > 0) {
        comparison = '+100%';
      } else {
        comparison = '-';
      }
    }

    // Compare to same day last week (7 days ago)
    let comparisonVsSameDayLastWeek = '-';
    const sameDayLastWeekDate = new Date(day.date.getTime() - (7 * 24 * 60 * 60 * 1000));
    const sameDayLastWeekKey = sameDayLastWeekDate.toISOString().split('T')[0];
    const sameDayLastWeekRevenue = revenueMap.get(sameDayLastWeekKey) || 0;

    if (sameDayLastWeekRevenue > 0) {
      const change = ((day.totalRevenue - sameDayLastWeekRevenue) / sameDayLastWeekRevenue) * 100;
      comparisonVsSameDayLastWeek = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    } else if (day.totalRevenue > 0) {
      comparisonVsSameDayLastWeek = '+100%';
    }

    const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = day.date.getDate().toString().padStart(2, '0');
    const month = (day.date.getMonth() + 1).toString().padStart(2, '0');
    const year = day.date.getFullYear();

    // Format fullDate correctly without timezone issues
    const fullDate = `${year}-${month}-${dayNumber}`;

    return {
      day: dayName,
      date: `${dayNumber}/${month}/${year}`,
      fullDate: fullDate,
      totalRevenue: day.totalRevenue,
      comparedToPreviousDay: comparison,
      comparedToSameDayLastWeek: comparisonVsSameDayLastWeek
    };
  });

  // Calculate summary statistics
  // Find the most recent day with data, or use the last day if none have data
  let currentDay = formattedDays[formattedDays.length - 1];
  let currentDayIndex = formattedDays.length - 1;
  for (let i = formattedDays.length - 1; i >= 0; i--) {
    if (formattedDays[i].totalRevenue > 0) {
      currentDay = formattedDays[i];
      currentDayIndex = i;
      break;
    }
  }

  // Find the previous day with data before currentDay
  let previousDay = null;
  for (let i = currentDayIndex - 1; i >= 0; i--) {
    if (formattedDays[i].totalRevenue > 0) {
      previousDay = formattedDays[i];
      break;
    }
  }

  const totalRevenueToday = currentDay ? currentDay.totalRevenue : 0;

  let changeVsLastDay = '-';
  if (previousDay && previousDay.totalRevenue > 0) {
    const change = ((currentDay.totalRevenue - previousDay.totalRevenue) / previousDay.totalRevenue) * 100;
    changeVsLastDay = `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  } else if (currentDay && currentDay.totalRevenue > 0) {
    changeVsLastDay = '+100%';
  }

  // Calculate period metrics
  const averageDailyRevenue = allDaysData.length > 0
    ? allDaysData.reduce((total, day) => total + day.totalRevenue, 0) / allDaysData.length
    : 0;

  // Get comparison with same day last week from the most recent day with data
  const changeVsSameDayLastWeek = currentDay ? currentDay.comparedToSameDayLastWeek : '-';

  // Calculate comparison with 7 days average (trend)
  let trend = 'stable';
  let trendDescription = 'Stable';
  let changePercentage = '0%';

  if (currentDayIndex >= 7) {
    // Get 7 days before currentDay (not including currentDay)
    const last7Days = allDaysData.slice(currentDayIndex - 7, currentDayIndex);
    const average7Days = last7Days.reduce((total, day) => total + day.totalRevenue, 0) / 7;
    if (average7Days > 0) {
      const change = ((totalRevenueToday - average7Days) / average7Days) * 100;
      changePercentage = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

      // Determine trend based on change percentage
      if (change > 20) {
        trend = 'increasing';
        trendDescription = 'Strong Growth';
      } else if (change > 10) {
        trend = 'increasing';
        trendDescription = 'Moderate Growth';
      } else if (change < -20) {
        trend = 'decreasing';
        trendDescription = 'Strong Decline';
      } else if (change < -10) {
        trend = 'decreasing';
        trendDescription = 'Moderate Decline';
      } else {
        trend = 'stable';
        trendDescription = 'Stable';
      }
    } else if (totalRevenueToday > 0) {
      changePercentage = '+100%';
      trend = 'increasing';
      trendDescription = 'Strong Growth';
    }
  }

  // Find best day in the period
  const bestDay = formattedDays.reduce((max, day) =>
    day.totalRevenue > max.totalRevenue ? day : max,
    { totalRevenue: 0, day: 'Mon', date: '01/01/2025', fullDate: '2025-01-01' }
  );

  // Format best day display with date and revenue
  let bestDayDisplay = 'No data';
  if (bestDay.totalRevenue > 0) {
    const bestDayDate = new Date(bestDay.fullDate);
    const dayNumber = bestDayDate.getDate().toString().padStart(2, '0');
    const month = (bestDayDate.getMonth() + 1).toString().padStart(2, '0');
    const year = bestDayDate.getFullYear();

    bestDayDisplay = `${dayNumber}/${month}/${year} - ${bestDay.totalRevenue.toLocaleString('vi-VN')} VND`;
  }

  return {
    success: true,
    message: 'Daily revenue statistics retrieved successfully',
    data: {
      summary: {
        // Current day metrics (most recent day with data)
        currentDay: currentDay ? currentDay.date : '-',
        currentDayFullDate: currentDay ? currentDay.fullDate : '-',
        totalRevenueToday: totalRevenueToday,
        totalRevenueTodayFormatted: formatVND(totalRevenueToday) + ' VND',
        changeVsLastDay: changeVsLastDay,
        changeVsSameDayLastWeek: changeVsSameDayLastWeek,

        // Xu hướng doanh thu (so với trung bình 7 ngày trước)
        trend: {
          status: trend,
          description: trendDescription,
          changePercentage: changePercentage,
          comparedTo: '7-day average'
        },

        // Period overview metrics
        averageDailyRevenue: Math.round(averageDailyRevenue),
        averageDailyRevenueFormatted: formatVND(Math.round(averageDailyRevenue)) + ' VND',

        // Best performance
        bestDayInPeriod: bestDayDisplay,

        // Date range
        dateRange: {
          startDate: allDaysData.length > 0 ?
            `${allDaysData[0].date.getFullYear()}-${(allDaysData[0].date.getMonth() + 1).toString().padStart(2, '0')}-${allDaysData[0].date.getDate().toString().padStart(2, '0')}` :
            startDate.toISOString().split('T')[0],
          endDate: allDaysData.length > 0 ?
            `${allDaysData[allDaysData.length - 1].date.getFullYear()}-${(allDaysData[allDaysData.length - 1].date.getMonth() + 1).toString().padStart(2, '0')}-${allDaysData[allDaysData.length - 1].date.getDate().toString().padStart(2, '0')}` :
            endDate.toISOString().split('T')[0],
          totalDays: allDaysData.length
        }
      },
      dailyData: formattedDays.map(day => ({
        ...day,
        totalRevenueFormatted: formatVND(day.totalRevenue)
      }))
    }
  };
};

exports.getRevenueByYear = async (numYears = 3) => {
  const now = new Date();

  // Calculate date range
  const oldestYear = now.getFullYear() - (numYears - 1);
  const startDate = new Date(oldestYear, 0, 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(now.getFullYear(), 11, 31);
  endDate.setHours(23, 59, 59, 999);

  // ✅ Query ALL data once with yearly grouping
  const yearlyRevenue = await Orders.aggregate([
    {
      $match: {
        pay_status: 'paid',
        orderDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $year: '$orderDate' },
        totalRevenue: { $sum: '$totalPrice' }
      }
    }
  ]);

  // Create revenue map for fast lookup
  const revenueMap = new Map();
  yearlyRevenue.forEach(item => {
    revenueMap.set(item._id, item.totalRevenue);
  });

  // Build years data from the map
  const allYearsData = [];
  for (let i = numYears - 1; i >= 0; i--) {
    const year = now.getFullYear() - i;
    const totalRevenue = revenueMap.get(year) || 0;

    allYearsData.push({
      year: year,
      totalRevenue: totalRevenue
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

    return {
      year: year.year.toString(),
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
    { totalRevenue: 0, year: new Date().getFullYear().toString() }
  );
  const bestYearDisplay = bestYear.totalRevenue > 0
    ? `${bestYear.year} - ${bestYear.totalRevenue.toLocaleString('vi-VN')} VND`
    : 'No data';

  // Calculate average yearly revenue
  const averageYearlyRevenue = allYearsData.length > 0
    ? allYearsData.reduce((total, year) => total + year.totalRevenue, 0) / allYearsData.length
    : 0;

  // Calculate comparison with 2 years average (trend)
  let trend = 'stable';
  let trendDescription = 'Stable';
  let changePercentage = '0%';

  if (allYearsData.length >= 2) {
    const last2Years = allYearsData.slice(-3, -1); // Last 2 years (excluding current year)
    const average2Years = last2Years.reduce((total, year) => total + year.totalRevenue, 0) / 2;
    if (average2Years > 0) {
      const change = ((totalRevenueThisYear - average2Years) / average2Years) * 100;
      changePercentage = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

      // Determine trend based on change percentage
      if (change > 20) {
        trend = 'increasing';
        trendDescription = 'Strong Growth';
      } else if (change > 10) {
        trend = 'increasing';
        trendDescription = 'Moderate Growth';
      } else if (change < -20) {
        trend = 'decreasing';
        trendDescription = 'Strong Decline';
      } else if (change < -10) {
        trend = 'decreasing';
        trendDescription = 'Moderate Decline';
      } else {
        trend = 'stable';
        trendDescription = 'Stable';
      }
    } else if (totalRevenueThisYear > 0) {
      changePercentage = '+100%';
      trend = 'increasing';
      trendDescription = 'Strong Growth';
    }
  }

  return {
    success: true,
    message: 'Yearly revenue statistics retrieved successfully',
    data: {
      summary: {
        // Doanh thu năm này
        currentYearRevenue: totalRevenueThisYear,
        currentYearRevenueFormatted: formatVND(totalRevenueThisYear) + ' VND',

        // % so với năm trước
        changeVsLastYear: changeVsLastYear,

        // Xu hướng doanh thu (so với trung bình 2 năm trước)
        trend: {
          status: trend,
          description: trendDescription,
          changePercentage: changePercentage,
          comparedTo: '2-year average'
        },

        // Doanh thu trung bình hàng năm
        averageYearlyRevenue: Math.round(averageYearlyRevenue),
        averageYearlyRevenueFormatted: formatVND(Math.round(averageYearlyRevenue)) + ' VND',

        // Năm có doanh thu cao nhất
        bestYear: bestYearDisplay
      },
      yearlyData: formattedYears.map(year => ({
        ...year,
        totalRevenueFormatted: formatVND(year.totalRevenue) + ' VND'
      }))
    }
  };
};