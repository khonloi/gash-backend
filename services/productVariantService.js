const mongoose = require("mongoose");
const ProductVariant = require("../models/ProductVariant");
const Product = require("../models/Product");
const OrderDetails = require("../models/OrderDetails");
const Orders = require("../models/Orders");

// HELPER: Update product status based on its variants
// Rule: If product has at least 1 variant → status = "active"
//       If product has no variants and was previously active → status = "inactive"
//       If product has no variants and was never active → status = "pending"
const updateProductStatusBasedOnVariants = async (productId) => {
  try {
    // Find all non-deleted variants (exclude discontinued)
    const variants = await ProductVariant.find({
      productId,
      variantStatus: { $ne: "discontinued" }
    });

    // Get current product to check previous status
    const currentProduct = await Product.findById(productId);
    if (!currentProduct) {
      return;
    }

    // If no variants exist
    if (variants.length === 0) {
      // If product was previously active (had variants), set to "inactive"
      if (currentProduct.productStatus === "active") {
        await Product.findByIdAndUpdate(
          productId,
          { productStatus: "inactive", updatedAt: Date.now() },
          { new: true }
        );
      } else {
        // If product was never active (new product), keep as "pending"
        await Product.findByIdAndUpdate(
          productId,
          { productStatus: "pending", updatedAt: Date.now() },
          { new: true }
        );
      }
      return;
    }

    // If at least 1 variant exists, set status to "active"
    await Product.findByIdAndUpdate(
      productId,
      { productStatus: "active", updatedAt: Date.now() },
      { new: true }
    );
  } catch (error) {
    console.error(`Failed to update product status for ${productId}:`, error);
    // Don't throw — this is non-critical
  }
};

// Create a new product variant with validation
const createProductVariant = async (variantData) => {
  try {
    const {
      productId,
      productColorId,
      productSizeId,
      variantImage,
      variantPrice,
      stockQuantity,
    } = variantData;

    // Validation is now handled by Joi middleware, so we can trust the data format here.

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.productStatus === "discontinued") {
      throw new Error("Cannot add variant to a discontinued product");
    }

    // Check for existing variant (excluding discontinued ones)
    const existingVariant = await ProductVariant.findOne({
      productId,
      productColorId,
      productSizeId,
      variantStatus: { $ne: "discontinued" }
    });

    if (existingVariant) {
      // If variant exists, update it instead of creating new one
      // Add stock quantity (accumulate)
      const oldStockQuantity = existingVariant.stockQuantity || 0;
      const newStockQuantity = oldStockQuantity + (stockQuantity || 0);
      const newVariantStatus = newStockQuantity > 0 ? "active" : "inactive";

      // Update existing variant with new data
      existingVariant.variantPrice = variantPrice;
      existingVariant.variantImage = variantImage;
      existingVariant.stockQuantity = newStockQuantity;
      existingVariant.variantStatus = newVariantStatus;
      existingVariant.updatedAt = Date.now();

      await existingVariant.save();

      // Update product status based on variants
      await updateProductStatusBasedOnVariants(productId);

      // Return variant with flag indicating it was updated
      return {
        variant: existingVariant,
        wasUpdated: true,
        oldStockQuantity,
        newStockQuantity
      };
    }

    // Create new variant if it doesn't exist
    const variantStatus = stockQuantity > 0 ? "active" : "inactive";
    const variant = new ProductVariant({
      ...variantData,
      variantStatus
    });
    await variant.save();

    // Add variant to product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $addToSet: { productVariantIds: variant._id },
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Error("Product not found");
    }

    // Update product status based on variants (will set to "active" since we just added a variant)
    await updateProductStatusBasedOnVariants(productId);

    // Return variant with flag indicating it was created
    return {
      variant,
      wasUpdated: false
    };
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
        throw new Error("Invalid product ID");
      }
      query.productId = productId;
    }
    if (productColorId) {
      if (!mongoose.Types.ObjectId.isValid(productColorId)) {
        throw new Error("Invalid product color ID");
      }
      query.productColorId = productColorId;
    }
    if (productSizeId) {
      if (!mongoose.Types.ObjectId.isValid(productSizeId)) {
        throw new Error("Invalid product size ID");
      }
      query.productSizeId = productSizeId;
    }

    return await ProductVariant
      .find(query)
      .populate("productId")
      .populate("productColorId")
      .populate("productSizeId");
  } catch (error) {
    throw new Error(`Failed to fetch product variants: ${error.message}`);
  }
};

// Get a single product variant by ID
const getProductVariantById = async (variantId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error("Invalid variant ID");
    }

    const variant = await ProductVariant
      .findById(variantId)
      .populate("productId")
      .populate("productColorId")
      .populate("productSizeId");
    if (!variant) {
      throw new Error("Product variant not found");
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
      throw new Error("Invalid variant ID");
    }

    const {
      productId,
      productColorId,
      productSizeId,
      variantPrice,
      stockQuantity,
    } = updateData;

    // Validation is now handled by Joi middleware, so we can trust the data format here.

    const existingVariant = await ProductVariant.findById(variantId);
    if (!existingVariant) {
      throw new Error("Product variant not found");
    }

    if (existingVariant.variantStatus === "discontinued") {
      throw new Error("Cannot update a discontinued variant");
    }

    const product = await Product.findById(existingVariant.productId);
    if (!product) {
      throw new Error("Associated product not found");
    }
    if (product.productStatus === "discontinued") {
      throw new Error("Cannot update variant of a discontinued product");
    }

    if (productId || productColorId || productSizeId) {
      const existingDuplicate = await ProductVariant.findOne({
        productId: productId || existingVariant.productId,
        productColorId: productColorId || existingVariant.productColorId,
        productSizeId: productSizeId || existingVariant.productSizeId,
        _id: { $ne: variantId },
      });
      if (existingDuplicate) {
        throw new Error(
          "Variant with this product, color, and size already exists"
        );
      }
    }

    let updatedData = { ...updateData, updatedAt: Date.now() };
    if (stockQuantity !== undefined) {
      updatedData.variantStatus = stockQuantity > 0 ? "active" : "inactive";
    }

    const variant = await ProductVariant.findByIdAndUpdate(
      variantId,
      updatedData,
      { new: true, runValidators: true }
    );

    if (!variant) {
      throw new Error("Product variant not found");
    }

    // NEW: Update product status based on all variants
    await updateProductStatusBasedOnVariants(existingVariant.productId);

    return variant;
  } catch (error) {
    throw new Error(`Failed to update product variant: ${error.message}`);
  }
};

// Soft delete a product variant with validation
const deleteProductVariant = async (variantId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      throw new Error("Invalid variant ID");
    }

    const orderDetails = await OrderDetails.find({ variantId }).populate({
      path: "orderId",
      select: "orderStatus",
    });

    const hasNonCancelledOrders = orderDetails.some(
      (detail) => detail.orderId.orderStatus !== "cancelled"
    );
    if (hasNonCancelledOrders) {
      throw new Error("Cannot delete variant with active orders");
    }

    const variant = await ProductVariant.findByIdAndUpdate(
      variantId,
      { variantStatus: "discontinued", updatedAt: Date.now() },
      { new: true }
    );

    if (!variant) {
      throw new Error("Product variant not found");
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      variant.productId,
      {
        $pull: { productVariantIds: variant._id },
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Error("Product not found");
    }

    // NEW: Update product status after variant deletion
    await updateProductStatusBasedOnVariants(variant.productId);

    return { message: "Product variant discontinued successfully" };
  } catch (error) {
    throw new Error(`Failed to delete product variant: ${error.message}`);
  }
};

// Bulk create product variants
const bulkCreateProductVariants = async (bulkData) => {
  try {
    const {
      productId,
      productColorId,
      variantImage,
      variantPrice,
      stockQuantity,
      sizeIds, // Array of size IDs
    } = bulkData;

    // Validation is now handled by Joi middleware, so we can trust the data format here.

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.productStatus === "discontinued") {
      throw new Error("Cannot add variant to a discontinued product");
    }

    // Check for existing variants to avoid duplicates
    const existingVariants = await ProductVariant.find({
      productId,
      productColorId,
      productSizeId: { $in: sizeIds },
    }).populate("productSizeId");

    if (existingVariants.length > 0) {
      const existingSizes = existingVariants.map(
        (v) => v.productSizeId?.size_name || v.productSizeId?.toString() || v.productSizeId
      );
      throw new Error(
        `Variants already exist for some sizes: ${existingSizes.join(", ")}`
      );
    }

    const variantStatus = stockQuantity > 0 ? "active" : "inactive";

    // Create all variants
    const variants = sizeIds.map((productSizeId) => ({
      productId,
      productColorId,
      productSizeId,
      variantImage,
      variantPrice,
      stockQuantity,
      variantStatus,
    }));

    // Insert all variants
    const createdVariants = await ProductVariant.insertMany(variants);

    // Update product with all variant IDs
    const variantIds = createdVariants.map((v) => v._id);
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $addToSet: { productVariantIds: { $each: variantIds } },
        productStatus: "active", // At least one variant → active
        updatedAt: Date.now(),
      },
      { new: true }
    );

    if (!updatedProduct) {
      throw new Error("Product not found");
    }

    return createdVariants;
  } catch (error) {
    throw new Error(`Failed to bulk create product variants: ${error.message}`);
  }
};

module.exports = {
  createProductVariant,
  getAllProductVariants,
  getProductVariantById,
  updateProductVariant,
  deleteProductVariant,
  bulkCreateProductVariants,
};