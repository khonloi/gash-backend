const NewProduct = require("../models/newProduct");
const Category = require("../models/Categories");
const ExcelJS = require("exceljs");

/* ======================================================
   📊 API: Tổng quan thống kê sản phẩm (có lọc)
   ====================================================== */
exports.getProductStatistics = async (req, res) => {
  try {
    // Lấy các tham số filter từ FE gửi lên
    const { period = "all", category = "all", status = "all" } = req.query;

    // Tạo bộ lọc động cho MongoDB
    const filter = {};

    // --- Lọc theo danh mục ---
    if (category !== "all") {
      const foundCat = await Category.findOne({ categoryName: category });
      if (foundCat) filter.categoryId = foundCat._id;
    }

    // --- Lọc theo trạng thái ---
    if (status !== "all") {
      filter.productStatus = status;
    }

    // --- Lọc theo thời gian ---
    if (period !== "all") {
      const now = new Date();
      let fromDate;
      if (period === "month") fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      else if (period === "quarter") fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      else if (period === "year") fromDate = new Date(now.getFullYear(), 0, 1);

      if (fromDate) filter.createdAt = { $gte: fromDate };
    }

    // --- Đếm dữ liệu theo filter ---
    const totalProducts = await NewProduct.countDocuments(filter);
    const activeProducts = await NewProduct.countDocuments({
      ...filter,
      productStatus: "active",
    });
    const inactiveProducts = await NewProduct.countDocuments({
      ...filter,
      productStatus: "inactive",
    });
    const pendingProducts = await NewProduct.countDocuments({
      ...filter,
      productStatus: "pending",
    });
    const discontinuedProducts = await NewProduct.countDocuments({
      ...filter,
      productStatus: "discontinued",
    });

    // --- Sản phẩm mới trong 30 ngày ---
    const newProducts = await NewProduct.countDocuments({
      ...filter,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    // Trả về kết quả
    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        inactiveProducts,
        pendingProducts,
        discontinuedProducts,
        newProducts,
      },
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
   📈 API: Thống kê theo danh mục (Category Distribution)
   ====================================================== */
exports.getCategoryDistribution = async (req, res) => {
  try {
    const data = await NewProduct.aggregate([
      {
        $lookup: {
          from: "categories", // đúng tên collection chứa danh mục
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      {
        $unwind: {
          path: "$categoryInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            $ifNull: ["$categoryInfo.categoryName", "Unknown"], // đúng field categoryName
          },
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: 1,
        },
      },
      { $sort: { value: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: data.length ? data : [],
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
   🏆 API: Top sản phẩm bán chạy
   ====================================================== */
exports.getTopProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const top = await NewProduct.find()
      .sort({ sold: -1 }) // Nếu dùng field khác, ví dụ sales hoặc quantitySold → đổi ở đây
      .limit(limit)
      .select("productName sku sold stock categoryId");

    const formatted = top.map((p) => ({
      id: p._id,
      name: p.productName,
      sku: p.sku || "-",
      sold: p.sold || 0,
      stock: p.stock || 0,
      category: p.categoryId || "N/A",
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching top products",
    });
  }
};

/* ======================================================
   📤 API: Xuất Excel thống kê sản phẩm
   ====================================================== */
exports.exportProductStatistics = async (req, res) => {
  try {
    const products = await NewProduct.find().populate("categoryId");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Product Statistics");

    worksheet.columns = [
      { header: "Product Name", key: "productName", width: 30 },
      { header: "Status", key: "productStatus", width: 15 },
      { header: "Category", key: "category", width: 20 },
      { header: "Price", key: "price", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    products.forEach((p) => {
      worksheet.addRow({
        productName: p.productName,
        productStatus: p.productStatus,
        category: p.categoryId?.categoryName || "N/A",
        price: p.price || 0,
        createdAt: new Date(p.createdAt).toLocaleDateString(),
      });
    });

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
