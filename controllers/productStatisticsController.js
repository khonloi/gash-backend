const Product = require("../models/Product");
const Category = require("../models/Categories");
const ExcelJS = require("exceljs");

/* ======================================================
   API: Product Statistics Overview (filtered)
   ====================================================== */
exports.getProductStatistics = async (req, res) => {
  try {
    // Get filter parameters from frontend request
    const { period = "all", category = "all", status = "all" } = req.query;

    // Create dynamic filter for MongoDB
    const filter = {};

    // --- Filter by category ---
    if (category !== "all") {
      const foundCat = await Category.findOne({ categoryName: category });
      if (foundCat) filter.categoryId = foundCat._id;
    }

    // --- Filter by status ---
    if (status !== "all") {
      filter.productStatus = status;
    }

    // --- Filter by time period ---
    if (period !== "all") {
      const now = new Date();
      let fromDate;
      if (period === "month") fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      else if (period === "quarter") fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      else if (period === "year") fromDate = new Date(now.getFullYear(), 0, 1);

      if (fromDate) filter.createdAt = { $gte: fromDate };
    }

    // --- Count data based on filter using $facet ---
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const results = await Product.aggregate([
      { $match: filter },
      {
        $facet: {
          total: [{ $count: "count" }],
          active: [{ $match: { productStatus: "active" } }, { $count: "count" }],
          inactive: [{ $match: { productStatus: "inactive" } }, { $count: "count" }],
          pending: [{ $match: { productStatus: "pending" } }, { $count: "count" }],
          discontinued: [{ $match: { productStatus: "discontinued" } }, { $count: "count" }],
          new: [{ $match: { createdAt: { $gte: thirtyDaysAgo } } }, { $count: "count" }]
        }
      }
    ]);

    const stats = results[0];
    const totalProducts = stats.total[0] ? stats.total[0].count : 0;
    const activeProducts = stats.active[0] ? stats.active[0].count : 0;
    const inactiveProducts = stats.inactive[0] ? stats.inactive[0].count : 0;
    const pendingProducts = stats.pending[0] ? stats.pending[0].count : 0;
    const discontinuedProducts = stats.discontinued[0] ? stats.discontinued[0].count : 0;
    const newProducts = stats.new[0] ? stats.new[0].count : 0;

    // Return response
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
   API: Category Distribution Statistics
   ====================================================== */
exports.getCategoryDistribution = async (req, res) => {
  try {
    const data = await Product.aggregate([
      {
        $lookup: {
          from: "categories", // collection name for categories
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
            $ifNull: ["$categoryInfo.categoryName", "Unknown"],
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
   API: Top Selling Products
   ====================================================== */
exports.getTopProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const top = await Product.find()
      .sort({ sold: -1 })
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
   API: Export Product Statistics to Excel
   ====================================================== */
exports.exportProductStatistics = async (req, res) => {
  try {
    const products = await Product.find().populate("categoryId");

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
