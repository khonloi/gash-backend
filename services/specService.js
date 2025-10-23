const ProductSizes = require("../models/ProductSizes");
const ProductColors = require("../models/ProductColors");
const mongoose = require("mongoose");

// --- Product Colors ---
async function createProductColorService({ color_name }) {
  if (!color_name) {
    const err = new Error("Color name is required"); err.status = 400; throw err;
  }
  const existingColor = await ProductColors.findOne({ color_name });
  if (existingColor) {
    const err = new Error("Color name already exists"); err.status = 400; throw err;
  }
  const color = new ProductColors({ color_name });
  return await color.save();
}
async function getAllProductColorsService() {
  return await ProductColors.find();
}
async function getProductColorByIdService(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid color ID"); err.status = 400; throw err;
  }
  const color = await ProductColors.findById(id);
  if (!color) {
    const err = new Error("Product color not found"); err.status = 404; throw err;
  }
  return color;
}
async function updateProductColorService(id, { color_name }) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid color ID"); err.status = 400; throw err;
  }
  if (color_name) {
    const existingColor = await ProductColors.findOne({ color_name, _id: { $ne: id } });
    if (existingColor) {
      const err = new Error("Color name already exists"); err.status = 400; throw err;
    }
  }
  const color = await ProductColors.findByIdAndUpdate(
    id,
    { color_name },
    { new: true, runValidators: true }
  );
  if (!color) {
    const err = new Error("Product color not found"); err.status = 404; throw err;
  }
  return color;
}
async function deleteProductColorService(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid color ID"); err.status = 400; throw err;
  }
  // Prevent delete if any variant is using this color
  const newProductVariant = require('../models/newProductVariant');
  const inUseCount = await newProductVariant.countDocuments({ color_id: id });
  if (inUseCount > 0) {
    const err = new Error('Không thể xóa Color vì còn biến thể sản phẩm đang dùng Color này. Hãy cập nhật/xóa các biến thể liên quan trước.');
    err.status = 409;
    throw err;
  }
  const color = await ProductColors.findByIdAndDelete(id);
  if (!color) {
    const err = new Error("Product color not found"); err.status = 404; throw err;
  }
  return { message: "Product color deleted successfully" };
}

// --- Product Sizes ---
async function createProductSizeService({ size_name }) {
  if (!size_name) {
    const err = new Error("Size name is required"); err.status = 400; throw err;
  }
  const existingSize = await ProductSizes.findOne({ size_name });
  if (existingSize) {
    const err = new Error("Size name already exists"); err.status = 400; throw err;
  }
  const size = new ProductSizes({ size_name });
  return await size.save();
}
async function getAllProductSizesService() {
  return await ProductSizes.find();
}
async function getProductSizeByIdService(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid size ID"); err.status = 400; throw err;
  }
  const size = await ProductSizes.findById(id);
  if (!size) {
    const err = new Error("Product size not found"); err.status = 404; throw err;
  }
  return size;
}
async function updateProductSizeService(id, { size_name }) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid size ID"); err.status = 400; throw err;
  }
  if (size_name) {
    const existingSize = await ProductSizes.findOne({ size_name, _id: { $ne: id } });
    if (existingSize) {
      const err = new Error("Size name already exists"); err.status = 400; throw err;
    }
  }
  const size = await ProductSizes.findByIdAndUpdate(
    id,
    { size_name },
    { new: true, runValidators: true }
  );
  if (!size) {
    const err = new Error("Product size not found"); err.status = 404; throw err;
  }
  return size;
}
async function deleteProductSizeService(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid size ID"); err.status = 400; throw err;
  }
  // Prevent delete if any variant is using this size
  const newProductVariant = require('../models/newProductVariant');
  const inUseCount = await newProductVariant.countDocuments({ size_id: id });
  if (inUseCount > 0) {
    const err = new Error('Không thể xóa Size vì còn biến thể sản phẩm đang dùng Size này. Hãy cập nhật/xóa các biến thể liên quan trước.');
    err.status = 409;
    throw err;
  }
  const size = await ProductSizes.findByIdAndDelete(id);
  if (!size) {
    const err = new Error("Product size not found"); err.status = 404; throw err;
  }
  return { message: "Product size deleted successfully" };
}

// --- Search Specifications ---
async function searchSpecificationsService({ q, type }) {
  let query = {};
  if (type && ["color", "size", "image"].includes(type)) {
    // handled below
  }
  if (q && typeof q === "string" && q.trim() !== "") {
    const trimmedQuery = q.trim();
    if (mongoose.isValidObjectId(trimmedQuery)) {
      query.$or = [{ _id: new mongoose.Types.ObjectId(trimmedQuery) }];
    } else {
      if (type === "color") {
        query.color_name = { $regex: trimmedQuery, $options: "i" };
      } else if (type === "size") {
        query.size_name = { $regex: trimmedQuery, $options: "i" };
      } else if (type === "image") {
        query.imageURL = { $regex: trimmedQuery, $options: "i" };
      } else {
        query.$or = [
          { color_name: { $regex: trimmedQuery, $options: "i" } },
          { size_name: { $regex: trimmedQuery, $options: "i" } },
          { imageURL: { $regex: trimmedQuery, $options: "i" } }
        ];
      }
    }
  }
  let results = [];
  if (!type || type === "color") {
    const colors = await ProductColors.find(query);
    results.push(...colors.map(color => ({ ...color.toObject(), type: "color" })));
  }
  if (!type || type === "size") {
    const sizes = await ProductSizes.find(query);
    results.push(...sizes.map(size => ({ ...size.toObject(), type: "size" })));
  }
  if (!type || type === "image") {
    const images = await ProductImages.find(query).populate("pro_id", "pro_name");
    results.push(...images.map(image => ({ ...image.toObject(), type: "image" })));
  }
  return results;
}

module.exports = {
  createProductColorService,
  getAllProductColorsService,
  getProductColorByIdService,
  updateProductColorService,
  deleteProductColorService,
  createProductSizeService,
  getAllProductSizesService,
  getProductSizeByIdService,
  updateProductSizeService,
  deleteProductSizeService,
  searchSpecificationsService
}; 