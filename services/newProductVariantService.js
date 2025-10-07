const mongoose = require('mongoose');
const newProductVariant = require('./newProductVariantSchema');

// Create a new product variant with validation
const createProductVariant = async (variantData) => {
  try {
    // Validate required fields
    const { productId, productColorId, productSizeId, variantImage, variantPrice, stockQuantity } = variantData;
    if (!productId || !productColorId || !productSizeId || !variantImage || variantPrice == null || stockQuantity == null) {
      throw new Error('All fields are required');
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }
    if (!mongoose.Types.ObjectId.isValid(productColorId)) {
      throw new Error('Invalid product color ID');
    }
    if (!mongoose.Types.ObjectId.isValid(productSizeId)) {
      throw new Error('Invalid product size ID');
    }

    // Validate numeric fields
    if (variantPrice < 0) {
      throw new Error('Variant price cannot be negative');
    }
    if (stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    // Check for duplicate variant (same product, color, and size)
    const existingVariant = await newProductVariant.findOne({
      productId,
      productColorId,
      productSizeId
    });
    if (existingVariant) {
      throw new Error('Variant with this product, color, and size already exists');
    }

    const variant = new newProductVariant(variantData);
    await variant.save();
    return variant;
  } catch (error) {
    throw new Error(`Failed to create product variant: ${error.message}`);
  }
};

// Get all product variants with optional filtering
const getAllProductVariants = async (filters = {}) => {
  try {
    const { productId, productColorId, productSizeId } = filters;
    const query = {};

    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error('Invalid product ID');
      }
      query.productId = productId;
    }
    if (productColorId) {
      if (!mongoose.Types.ObjectId.isValid(productColorId)) {
        throw new Error('Invalid product color ID');
      }
      query.productColorId = productColorId;
    }
    if (productSizeId) {
      if (!mongoose.Types.ObjectId.isValid(productSizeId)) {
        throw new Error('Invalid product size ID');
      }
      query.productSizeId = productSizeId;
    }

    return await newProductVariant.find(query)
      .populate('productId')
      .populate('productColorId')
      .populate('productSizeId');
  } catch (error) {
    throw new Error(`Failed to fetch product variants: ${error.message}`);
  }
};

// Get a single product variant by ID
const getProductVariantById = async (variantId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('Invalid variant ID');
    }

    const variant = await newProductVariant.findById(variantId)
      .populate('productId')
      .populate('productColorId')
      .populate('productSizeId');
    if (!variant) {
      throw new Error('Product variant not found');
    }
    return variant;
  } catch (error) {
    throw new Error(`Failed to fetch product variant: ${error.message}`);
  }
};

// Update a product variant with validation
const updateProductVariant = async (variantId, updateData) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('Invalid variant ID');
    }

    // Validate update data
    const { productId, productColorId, productSizeId, variantPrice, stockQuantity } = updateData;
    if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID');
    }
    if (productColorId && !mongoose.Types.ObjectId.isValid(productColorId)) {
      throw new Error('Invalid product color ID');
    }
    if (productSizeId && !mongoose.Types.ObjectId.isValid(productSizeId)) {
      throw new Error('Invalid product size ID');
    }
    if (variantPrice != null && variantPrice < 0) {
      throw new Error('Variant price cannot be negative');
    }
    if (stockQuantity != null && stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    // Check for duplicate variant
    if (productId || productColorId || productSizeId) {
      const existingVariant = await newProductVariant.findOne({
        productId: productId || undefined,
        productColorId: productColorId || undefined,
        productSizeId: productSizeId || undefined,
        _id: { $ne: variantId }
      });
      if (existingVariant) {
        throw new Error('Variant with this product, color, and size already exists');
      }
    }

    const variant = await newProductVariant.findByIdAndUpdate(
      variantId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!variant) {
      throw new Error('Product variant not found');
    }
    return variant;
  } catch (error) {
    throw new Error(`Failed to update product variant: ${error.message}`);
  }
};

// Delete a product variant
const deleteProductVariant = async (variantId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error('Invalid variant ID');
    }

    const variant = await newProductVariant.findByIdAndDelete(variantId);
    if (!variant) {
      throw new Error('Product variant not found');
    }
    return { message: 'Product variant deleted successfully' };
  } catch (error) {
    throw new Error(`Failed to delete product variant: ${error.message}`);
  }
};

module.exports = {
  createProductVariant,
  getAllProductVariants,
  getProductVariantById,
  updateProductVariant,
  deleteProductVariant
};