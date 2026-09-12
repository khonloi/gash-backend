const productService = require("../services/ProductService");

const createProduct = async (req, res) => {
  try {
    const product = await productService.createProduct(req.body);
    req.app.get('io').to('productRoom').emit('productCreated', product);
    res.status(201).json({
      success: true,
      data: product,
      message: "Product added successfully",
    });
  } catch (error) {
    console.error("Create product error:", error.message);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const filters = req.query;
    const userRole = req.user?.role || "customer";
    console.log("getAllProducts called with filters:", filters, "userRole:", userRole);
    const products = await productService.getAllProducts(filters, userRole);
    res.status(200).json({
      success: true,
      data: products,
      message: "Products retrieved successfully",
    });
  } catch (error) {
    console.error("Get all products error:", error.message);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log("getProductById called with ID:", productId); // Debug log
    const userRole = req.user?.role || "customer";
    console.log("User Role in getProductById:", userRole);
    const product = await productService.getProductById(productId, userRole);
    res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved successfully",
    });
  } catch (error) {
    console.error("getProductById error:", error.message, "ID:", req.params.id); // Debug log
    const statusCode = error.statusCode || 404;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    req.app.get('io').to('productRoom').emit('productUpdated', product);
    res.status(200).json({
      success: true,
      data: product,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Update product error:", error.message);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id);
    req.app.get('io').to('productRoom').emit('productDeleted', req.params.id);
    res.status(200).json({
      success: true,
      message: "Product discontinued successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error.message);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const addProductImage = async (req, res) => {
  try {
    const image = await productService.addProductImage(req.params.id, req.body);
    req.app.get('io').to('productRoom').emit('productImageAdded', { productId: req.params.id, image });
    res.status(201).json({
      success: true,
      data: image,
      message: "Product image added successfully",
    });
  } catch (error) {
    console.error("Add product image error:", error.message);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProductImage = async (req, res) => {
  try {
    await productService.deleteProductImage(req.params.id, req.params.imageId);
    req.app.get('io').to('productRoom').emit('productImageDeleted', { productId: req.params.id, imageId: req.params.imageId });
    res.status(200).json({
      success: true,
      message: "Product image deleted successfully",
    });
  } catch (error) {
    console.error("Delete product image error:", error.message);
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

const searchProducts = async (req, res) => {
  console.log("searchProducts called with query:", req.query); // Debug log
  try {
    const searchParams = req.query;
    const userRole = req.user?.role || "customer";
    console.log("User Role in searchProducts:", userRole);
    const products = await productService.searchProducts(searchParams, userRole);
    console.log("Search results:", products); // Debug log
    res.status(200).json({
      success: true,
      data: products,
      message: "Products searched successfully",
    });
  } catch (error) {
    console.error("Search error:", error.message); // Debug log
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addProductImage,
  deleteProductImage,
  searchProducts
};