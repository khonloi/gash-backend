const productService = require("../services/newProductService");

const createProduct = async (req, res) => {
  try {
    const product = await productService.createProduct(req.body);
    // Emit real-time event
    req.app.get('io').to('productRoom').emit('productCreated', product);
    res.status(201).json({
      success: true,
      data: product,
      message: "Product created successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const filters = req.query;
    const userRole = req.user?.role || "customer"; // default to customer
    console.log("User Role in getAllProducts:", userRole); // Debug log
    const products = await productService.getAllProducts(filters, userRole);
    res.status(200).json({
      success: true,
      data: products,
      message: "Products retrieved successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const userRole = req.user?.role || "customer";
    console.log("User Role in getProductById:", userRole); // Debug log
    const product = await productService.getProductById(
      req.params.id,
      userRole
    );
    res.status(200).json({
      success: true,
      data: product,
      message: "Product retrieved successfully",
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    // Emit real-time event
    req.app.get('io').to('productRoom').emit('productUpdated', product);
    res.status(200).json({
      success: true,
      data: product,
      message: "Product updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.params.id);
    // Emit real-time event
    req.app.get('io').to('productRoom').emit('productDeleted', req.params.id);
    res.status(200).json({
      success: true,
      message: "Product discontinued successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const addProductImage = async (req, res) => {
  try {
    const image = await productService.addProductImage(req.params.id, req.body);
    // Emit real-time event
    req.app.get('io').to('productRoom').emit('productImageAdded', { productId: req.params.id, image });
    res.status(201).json({
      success: true,
      data: image,
      message: "Product image added successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteProductImage = async (req, res) => {
  try {
    await productService.deleteProductImage(req.params.id, req.params.imageId);
    // Emit real-time event
    req.app.get('io').to('productRoom').emit('productImageDeleted', { productId: req.params.id, imageId: req.params.imageId });
    res.status(200).json({
      success: true,
      message: "Product image deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
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
  deleteProductImage
};