const Account = require("../models/Account");
const ExcelJS = require("exceljs");

// 📊 API lấy thống kê tổng quan
exports.getCustomerStatistics = async (req, res) => {
  try {
    const totalCustomers = await Account.countDocuments({ role: "user" });
    const activeCustomers = await Account.countDocuments({ role: "user", acc_status: "active" });
    const inactiveCustomers = await Account.countDocuments({ role: "user", acc_status: "inactive" });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const newCustomers = await Account.countDocuments({
      role: "user",
      createdAt: { $gte: startOfMonth },
    });

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
    console.error("❌ Error fetching customer stats:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 📤 API Export Excel
exports.exportCustomerStatistics = async (req, res) => {
  try {
    const accounts = await Account.find({ role: "user" });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customer Statistics");

    worksheet.columns = [
      { header: "Username", key: "username", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Status", key: "acc_status", width: 15 },
      { header: "Role", key: "role", width: 10 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    accounts.forEach((acc) => {
      worksheet.addRow({
        username: acc.username,
        email: acc.email,
        phone: acc.phone || "",
        acc_status: acc.acc_status,
        role: acc.role,
        createdAt: new Date(acc.createdAt).toLocaleDateString(),
      });
    });

    // Thiết lập header trả về file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=customer_statistics.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ Error exporting customer statistics:", error);
    res.status(500).json({ success: false, message: "Error exporting Excel" });
  }
};

// 🏆 API Lấy top khách hàng (mock data nếu chưa có dữ liệu đơn hàng thật)
exports.getTopCustomers = async (req, res) => {
  try {
    const period = req.query.period || "month";

    // Xác định thời gian lọc
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

    // ⚠️ Nếu chưa có dữ liệu đơn hàng, dùng dữ liệu giả
    const formatted = topCustomers.map((u) => ({
      id: u._id,
      name: u.username,
      email: u.email,
      orders: Math.floor(Math.random() * 10) + 1, // mock số đơn
      spent: Math.floor(Math.random() * 1000) + 200, // mock chi tiêu
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ Error fetching top customers:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 📈 API Sparkline giả (dữ liệu mô phỏng xu hướng)
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
    console.error("❌ Error fetching sparkline data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
