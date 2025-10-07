const mongoose = require('mongoose');
const newProduct = require('./newProductSchema');

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
    if (productStatus && !['active', 'inactive'].includes(productStatus)) {
      throw new Error('Product status must be either "active" or "inactive"');
    }

    // Check for duplicate product name
    const existingProduct = await newProduct.findOne({ productName });
    if (existingProduct) {
      throw new Error('Product with this name already exists');
    }

    const product = new newProduct(productData);
    await product.save();
    return product;
  } catch (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }
};

// Get all products with optional filtering
const getAllProducts = async (filters = {}) => {
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

    return await newProduct.find(query).populate('categoryId');
  } catch (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
};

// Get a single product by ID
const getProductById = async (productId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }

    const product = await newProduct.findById(productId).populate('categoryId');
    if (!product) {
      throw new Error('Product not found');
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

    // Check for duplicate product name
    if (productName) {
      const existingProduct = await newProduct.findOne({
        productName,
        _id: { $ne: productId }
      });
      if (existingProduct) {
        throw new Error('Product with this name already exists');
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

// Delete a product
const deleteProduct = async (productId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }

    const product = await newProduct.findByIdAndDelete(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    return { message: 'Product deleted successfully' };
  } catch (error) {
    throw new Error(`Failed to delete product: ${error.message}`);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct
};