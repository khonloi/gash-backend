const Account = require("../models/Accounts");
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