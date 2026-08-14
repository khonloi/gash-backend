const Product = require("../models/Product");
const Category = require("../models/Categories");
const ExcelJS = require("exceljs");

async function getProductStatisticsService(query) {
  const { period = "all", category = "all", status = "all" } = query;
  const filter = {};

  if (category !== "all") {
    const foundCat = await Category.findOne({ categoryName: category });
    if (foundCat) filter.categoryId = foundCat._id;
  }

  if (status !== "all") {
    filter.productStatus = status;
  }

  if (period !== "all") {
    const now = new Date();
    let fromDate;
    if (period === "month") fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === "quarter") fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    else if (period === "year") fromDate = new Date(now.getFullYear(), 0, 1);

    if (fromDate) filter.createdAt = { $gte: fromDate };
  }

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
  return {
    totalProducts: stats.total[0] ? stats.total[0].count : 0,
    activeProducts: stats.active[0] ? stats.active[0].count : 0,
    inactiveProducts: stats.inactive[0] ? stats.inactive[0].count : 0,
    pendingProducts: stats.pending[0] ? stats.pending[0].count : 0,
    discontinuedProducts: stats.discontinued[0] ? stats.discontinued[0].count : 0,
    newProducts: stats.new[0] ? stats.new[0].count : 0,
  };
}

async function getCategoryDistributionService() {
  const data = await Product.aggregate([
    {
      $lookup: {
        from: "categories",
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

  return data.length ? data : [];
}

async function getTopProductsService(limitQuery) {
  const limit = parseInt(limitQuery) || 6;
  const top = await Product.find()
    .sort({ sold: -1 })
    .limit(limit)
    .select("productName sku sold stock categoryId");

  return top.map((p) => ({
    id: p._id,
    name: p.productName,
    sku: p.sku || "-",
    sold: p.sold || 0,
    stock: p.stock || 0,
    category: p.categoryId || "N/A",
  }));
}

async function exportProductStatisticsService() {
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

  return workbook;
}

module.exports = {
  getProductStatisticsService,
  getCategoryDistributionService,
  getTopProductsService,
  exportProductStatisticsService,
};
