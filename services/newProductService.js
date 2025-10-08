const mongoose = require('mongoose');
const newProduct = require('../models/newProduct');
const newProductVariant = require('../models/newProductVariant');

// Create a new product with validation
const createProduct = async (productData) => {
  try {
    // Validate required fields
    const { productName, categoryId, description, productStatus } = productData;
    if (!productName || !categoryId || !description) {
      throw new Error('Product name, category ID, and description are required');
    }

    // Validate categoryId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error('Invalid category ID');
    }

    // Validate productStatus if provided
    if (productStatus && !['active', 'inactive', 'pending'].includes(productStatus)) {
      throw new Error('Product status must be either "active", "inactive", or "pending"');
    }

    // Check for duplicate product name
    const existingProduct = await newProduct.findOne({ productName });
    if (existingProduct) {
      throw new Error('Product with this name already exists');
    }

    // Set default status to pending if not provided
    const product = new newProduct({
      ...productData,
      productStatus: productStatus || 'pending'
    });
    await product.save();
    return product;
  } catch (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }
};

// Get all products with optional filtering
const getAllProducts = async (filters = {}, userRole = 'customer') => {
  try {
    const { status, categoryId } = filters;
    const query = {};

    if (status) query.productStatus = status;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error('Invalid category ID');
      }
      query.categoryId = categoryId;
    }

    // Restrict visibility of pending products for customers
    if (userRole === 'customer') {
      query.productStatus = { $ne: 'pending' };
    }

    return await newProduct.find(query).populate('categoryId');
  } catch (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
};

// Get a single product by ID
const getProductById = async (productId, userRole = 'customer') => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }

    const product = await newProduct.findById(productId).populate('categoryId');
    if (!product) {
      throw new Error('Product not found');
    }

    // Restrict visibility for customers if product is pending
    if (product.productStatus === 'pending' && userRole === 'customer') {
      throw new Error('Access denied: product is pending approval');
    }

    return product;
  } catch (error) {
    throw new Error(`Failed to fetch product: ${error.message}`);
  }
};


// Update a product with validation
const updateProduct = async (productId, updateData) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }

    // Validate update data
    const { productName, categoryId, productStatus } = updateData;
    if (productName && productName.trim() === '') {
      throw new Error('Product name cannot be empty');
    }
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error('Invalid category ID');
    }
    if (productStatus && !['active', 'inactive'].includes(productStatus)) {
      throw new Error('Product status must be either "active" or "inactive"');
    }

    // Check if product is discontinued
    const existingProduct = await newProduct.findById(productId);
    if (!existingProduct) {
      throw new Error('Product not found');
    }
    if (existingProduct.productStatus === 'discontinued') {
      throw new Error('Cannot update a discontinued product');
    }

    // Check for duplicate product name
    if (productName) {
      const duplicateProduct = await newProduct.findOne({
        productName,
        _id: { $ne: productId }
      });
      if (duplicateProduct) {
        throw new Error('Product with this name already exists');
      }
    }

    // Check if product has variants to determine if status can be changed from pending
    if (productStatus && productStatus !== 'pending') {
      const variantCount = await newProductVariant.countDocuments({ productId });
      if (variantCount === 0) {
        throw new Error('Cannot set status to active/inactive without variants');
      }
    }

    const product = await newProduct.findByIdAndUpdate(
      productId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  } catch (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }
};

// Soft delete a product by setting status to discontinued
const deleteProduct = async (productId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }

    const product = await newProduct.findByIdAndUpdate(
      productId,
      { productStatus: 'discontinued', updatedAt: Date.now() },
      { new: true }
    );

    if (!product) {
      throw new Error('Product not found');
    }
    return { message: 'Product discontinued successfully' };
  } catch (error) {
    throw new Error(`Failed to discontinue product: ${error.message}`);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct
};