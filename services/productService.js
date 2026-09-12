const mongoose = require("mongoose");
const ProductImage = require("../models/ProductImage");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");

// Create a new product with validation
const createProduct = async (productData) => {
  try {
    const {
      productName,
      categoryId,
      description,
      productStatus,
      productImageIds,
      productVariantIds,
    } = productData;
    // Validation is now handled by Joi middleware, so we can trust the data format here.
    const existingProduct = await Product.findOne({ productName: productName.trim() });
    if (existingProduct) {
      const error = new Error("Product with this name already exists");
      error.statusCode = 409;
      throw error;
    }

    let savedImageIds = [];
    for (const imageData of productImageIds) {

      const image = new ProductImage({
        imageUrl: imageData.imageUrl,
        isMain: imageData.isMain || false,
      });
      const savedImage = await image.save();
      savedImageIds.push(savedImage._id);
    }

    // Validate productVariantIds if provided
    let validatedVariantIds = [];
    if (productVariantIds && Array.isArray(productVariantIds)) {
      for (const variantId of productVariantIds) {
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
          throw new Error("Invalid product variant ID");
        }
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
          throw new Error(`Product variant with ID ${variantId} not found`);
        }
        validatedVariantIds.push(variantId);
      }
    }

    // Set product status to "pending" if no variants, otherwise allow provided status or default to "pending"
    const finalProductStatus = validatedVariantIds.length > 0 ? (productStatus || "active") : "pending";

    const product = new Product({
      ...productData,
      productName: productName.trim(),
      description: description.trim(),
      productImageIds: savedImageIds,
      productVariantIds: validatedVariantIds,
      productStatus: finalProductStatus,
    });
    const savedProduct = await product.save();

    if (savedImageIds.length > 0) {
      await ProductImage.updateMany(
        { _id: { $in: savedImageIds } },
        { productId: savedProduct._id }
      );
    }

    return await Product
      .findById(savedProduct._id)
      .populate("categoryId")
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });
  } catch (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }
};

// Get all products with optional filtering
const getAllProducts = async (filters = {}, userRole = "customer") => {
  try {
    const { status, categoryId } = filters;
    const query = {};

    if (status) query.productStatus = status;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new Error("Invalid category ID");
      }
      query.categoryId = categoryId;
    }

    if (userRole === "customer") {
      query.productStatus = { $ne: "pending" };
    }

    return await Product
      .find(query)
      .populate("categoryId")
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });
  } catch (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
};

// Search products by name and stock status
const searchProducts = async (searchParams = {}, userRole = "customer") => {
  try {
    const { name, status } = searchParams;
    const query = {};

    if (name) {
      query.productName = { $regex: name, $options: 'i' }; // Case-insensitive partial match
    }
    if (status) {
      if (!["active", "inactive", "pending", "discontinued"].includes(status)) {
        throw new Error(
          'Product status must be either "active", "inactive", "pending", or "discontinued"'
        );
      }
      query.productStatus = status;
    }

    if (userRole === "customer") {
      query.productStatus = { $ne: "pending" };
    }

    return await Product
      .find(query)
      .populate("categoryId")
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });
  } catch (error) {
    throw new Error(`Failed to search products: ${error.message}`);
  }
};

// Get a single product by ID
const getProductById = async (productId, userRole = "customer") => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Invalid product ID");
    }

    const product = await Product
      .findById(productId)
      .populate("categoryId")
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.productStatus === "pending" && userRole === "customer") {
      throw new Error("Access denied: product is pending approval");
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
      throw new Error("Invalid product ID");
    }

    const {
      productName,
      categoryId,
      description,
      productStatus,
      productImageIds,
      productVariantIds,
    } = updateData;
    // Validation is now handled by Joi middleware, so we can trust the data format here.

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      throw new Error("Product not found");
    }
    if (existingProduct.productStatus === "discontinued") {
      throw new Error("Cannot update a discontinued product");
    }

    if (productName) {
      const duplicateProduct = await Product.findOne({
        productName: productName.trim(),
        _id: { $ne: productId },
      });
      if (duplicateProduct) {
        const error = new Error("Product with this name already exists");
        error.statusCode = 409;
        throw error;
      }
    }

    let updatedImageIds = existingProduct.productImageIds;
    if (productImageIds && Array.isArray(productImageIds)) {


      updatedImageIds = [];
      for (const imageData of productImageIds) {

        if (imageData._id && mongoose.Types.ObjectId.isValid(imageData._id)) {
          await ProductImage.findByIdAndUpdate(
            imageData._id,
            { imageUrl: imageData.imageUrl, isMain: imageData.isMain || false },
            { new: true }
          );
          updatedImageIds.push(imageData._id);
        } else {
          const image = new ProductImage({
            productId,
            imageUrl: imageData.imageUrl,
            isMain: imageData.isMain || false,
          });
          const savedImage = await image.save();
          updatedImageIds.push(savedImage._id);
        }
      }
    }

    // Validate productVariantIds if provided
    let updatedVariantIds = existingProduct.productVariantIds;
    if (productVariantIds && Array.isArray(productVariantIds)) {
      updatedVariantIds = [];
      for (const variantId of productVariantIds) {
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
          throw new Error("Invalid product variant ID");
        }
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
          throw new Error(`Product variant with ID ${variantId} not found`);
        }
        updatedVariantIds.push(variantId);
      }
    }

    // Set product status based on variants
    // Rule: If product has at least 1 variant → status = "active"
    //       If product has no variants and was previously active → status = "inactive"
    //       If product has no variants and was never active → status = "pending"
    let finalProductStatus;
    if (updatedVariantIds.length === 0) {
      // If product was previously active (had variants), set to "inactive"
      if (existingProduct.productStatus === "active") {
        finalProductStatus = "inactive";
      } else {
        // If product was never active (new product), keep as "pending"
        finalProductStatus = "pending";
      }
    } else {
      // If at least 1 variant exists, status must be "active"
      finalProductStatus = "active";
    }

    // Only allow manual status override if provided and product has variants
    // (For cases like setting to "inactive" manually, but this should be rare)
    if (productStatus && updatedVariantIds.length > 0 && productStatus !== "active") {
      // Allow manual override, but log it
      console.warn(`Product ${productId} has variants but status is set to ${productStatus} instead of "active"`);
      finalProductStatus = productStatus;
    }

    const updatePayload = {
      ...updateData,
      productImageIds: updatedImageIds,
      productVariantIds: updatedVariantIds,
      productStatus: finalProductStatus,
      updatedAt: Date.now(),
    };

    if (productName) {
      updatePayload.productName = productName.trim();
    }

    if (description) {
      updatePayload.description = description.trim();
    }

    const product = await Product
      .findByIdAndUpdate(
        productId,
        updatePayload,
        { new: true, runValidators: true }
      )
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  } catch (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }
};

// Soft delete a product by setting status to discontinued AND cascade to variants
const deleteProduct = async (productId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Invalid product ID");
    }

    const product = await Product.findById(productId).populate("productVariantIds");
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.productStatus === "discontinued") {
      return { message: "Product is already discontinued" };
    }

    // Step 1: Discontinue the product
    await Product.findByIdAndUpdate(
      productId,
      {
        productStatus: "discontinued",
        updatedAt: Date.now()
      },
      { new: true }
    );

    // Step 2: Discontinue all associated variants
    if (product.productVariantIds && product.productVariantIds.length > 0) {
      const variantIds = product.productVariantIds.map(v => v._id);

      await ProductVariant.updateMany(
        { _id: { $in: variantIds } },
        {
          variantStatus: "discontinued",
          updatedAt: Date.now()
        }
      );
    }

    return { message: "Product and all its variants discontinued successfully" };
  } catch (error) {
    throw new Error(`Failed to discontinue product: ${error.message}`);
  }
};

// Add a new product image
const addProductImage = async (productId, imageData) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Invalid product ID");
    }
    if (!imageData.imageUrl) {
      throw new Error("Please fill in all required fields");
    }

    const product = await Product
      .findById(productId)
      .populate("productImageIds");
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.productStatus === "discontinued") {
      throw new Error("Cannot add images to a discontinued product");
    }

    // If new image is isMain: true, set existing isMain to false
    if (imageData.isMain) {
      await ProductImage.updateMany(
        { productId, isMain: true },
        { isMain: false }
      );
    } else {
      // If new image is not isMain, ensure at least one existing image is isMain
      const mainImageCount = product.productImageIds.filter(
        (img) => img.isMain
      ).length;
      if (mainImageCount === 0) {
        throw new Error(
          "An existing image must have isMain set to true if the new image is not main"
        );
      }
    }

    const image = new ProductImage({
      productId,
      imageUrl: imageData.imageUrl,
      isMain: imageData.isMain || false,
    });
    const savedImage = await image.save();

    product.productImageIds.push(savedImage._id);
    await product.save();

    return savedImage;
  } catch (error) {
    throw new Error(`Failed to add product image: ${error.message}`);
  }
};

// Delete a product image
const deleteProductImage = async (productId, imageId) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(imageId)
    ) {
      throw new Error("Invalid product or image ID");
    }

    const product = await Product
      .findById(productId)
      .populate("productImageIds");
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.productStatus === "discontinued") {
      throw new Error("Cannot delete images from a discontinued product");
    }
    if (product.productImageIds.length <= 1) {
      throw new Error(
        "Cannot delete the last image; product must have at least one image"
      );
    }

    const image = await ProductImage.findById(imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    // If deleting the main image, set another image as isMain
    if (image.isMain) {
      const otherImages = product.productImageIds.filter(
        (img) => img._id.toString() !== imageId
      );
      if (otherImages.length > 0) {
        await ProductImage.findByIdAndUpdate(otherImages[0]._id, {
          isMain: true,
        });
      }
    }

    await ProductImage.findByIdAndDelete(imageId);
    product.productImageIds = product.productImageIds.filter(
      (id) => id.toString() !== imageId
    );
    await product.save();

    return { message: "Product image deleted successfully" };
  } catch (error) {
    throw new Error(`Failed to delete product image: ${error.message}`);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  searchProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  addProductImage,
  deleteProductImage,
};