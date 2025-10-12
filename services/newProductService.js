const mongoose = require("mongoose");
const newProductImage = require("../models/newProductImage");
const newProduct = require("../models/newProduct");
const newProductVariant = require("../models/newProductVariant");

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
    if (!productName || !categoryId || !description) {
      throw new Error(
        "Product name, category ID, and description are required"
      );
    }
    if (
      !productImageIds ||
      !Array.isArray(productImageIds) ||
      productImageIds.length === 0
    ) {
      throw new Error("At least one product image is required");
    }

    // Validate exactly one image has isMain: true
    const mainImageCount = productImageIds.filter((img) => img.isMain).length;
    if (mainImageCount !== 1) {
      throw new Error("Exactly one product image must have isMain set to true");
    }

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("Invalid category ID");
    }
    if (
      productStatus &&
      !["active", "inactive", "pending"].includes(productStatus)
    ) {
      throw new Error(
        'Product status must be either "active", "inactive", or "pending"'
      );
    }
    const existingProduct = await newProduct.findOne({ productName });
    if (existingProduct) {
      throw new Error("Product with this name already exists");
    }

    let savedImageIds = [];
    for (const imageData of productImageIds) {
      if (!imageData.imageUrl) {
        throw new Error("Image URL is required for each product image");
      }
      const image = new newProductImage({
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
        const variant = await newProductVariant.findById(variantId);
        if (!variant) {
          throw new Error(`Product variant with ID ${variantId} not found`);
        }
        validatedVariantIds.push(variantId);
      }
    }

    const product = new newProduct({
      ...productData,
      productImageIds: savedImageIds,
      productVariantIds: validatedVariantIds,
      productStatus: productStatus || "pending",
    });
    const savedProduct = await product.save();

    if (savedImageIds.length > 0) {
      await newProductImage.updateMany(
        { _id: { $in: savedImageIds } },
        { productId: savedProduct._id }
      );
    }

    return await newProduct
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

    return await newProduct
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

    return await newProduct
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

    const product = await newProduct
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
      productStatus,
      productImageIds,
      productVariantIds,
    } = updateData;
    if (productName && productName.trim() === "") {
      throw new Error("Product name cannot be empty");
    }
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("Invalid category ID");
    }
    if (productStatus && !["active", "inactive"].includes(productStatus)) {
      throw new Error('Product status must be either "active" or "inactive"');
    }
    if (
      productImageIds &&
      (!Array.isArray(productImageIds) || productImageIds.length === 0)
    ) {
      throw new Error("At least one product image is required");
    }

    const existingProduct = await newProduct.findById(productId);
    if (!existingProduct) {
      throw new Error("Product not found");
    }
    if (existingProduct.productStatus === "discontinued") {
      throw new Error("Cannot update a discontinued product");
    }

    if (productName) {
      const duplicateProduct = await newProduct.findOne({
        productName,
        _id: { $ne: productId },
      });
      if (duplicateProduct) {
        throw new Error("Product with this name already exists");
      }
    }

    if (productStatus && productStatus !== "pending") {
      const variantCount = await newProductVariant.countDocuments({
        productId,
      });
      if (variantCount === 0) {
        throw new Error(
          "Cannot set status to active/inactive without variants"
        );
      }
    }

    let updatedImageIds = existingProduct.productImageIds;
    if (productImageIds && Array.isArray(productImageIds)) {
      // Validate exactly one image has isMain: true
      const mainImageCount = productImageIds.filter((img) => img.isMain).length;
      if (mainImageCount !== 1) {
        throw new Error(
          "Exactly one product image must have isMain set to true"
        );
      }

      updatedImageIds = [];
      for (const imageData of productImageIds) {
        if (!imageData.imageUrl) {
          throw new Error("Image URL is required for each product image");
        }
        if (imageData._id && mongoose.Types.ObjectId.isValid(imageData._id)) {
          await newProductImage.findByIdAndUpdate(
            imageData._id,
            { imageUrl: imageData.imageUrl, isMain: imageData.isMain || false },
            { new: true }
          );
          updatedImageIds.push(imageData._id);
        } else {
          const image = new newProductImage({
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
        const variant = await newProductVariant.findById(variantId);
        if (!variant) {
          throw new Error(`Product variant with ID ${variantId} not found`);
        }
        updatedVariantIds.push(variantId);
      }
    }

    const product = await newProduct
      .findByIdAndUpdate(
        productId,
        {
          ...updateData,
          productImageIds: updatedImageIds,
          productVariantIds: updatedVariantIds,
          updatedAt: Date.now(),
        },
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

// Soft delete a product by setting status to discontinued
const deleteProduct = async (productId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error("Invalid product ID");
    }

    const product = await newProduct.findByIdAndUpdate(
      productId,
      { productStatus: "discontinued", updatedAt: Date.now() },
      { new: true }
    );

    if (!product) {
      throw new Error("Product not found");
    }
    return { message: "Product discontinued successfully" };
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
      throw new Error("Image URL is required");
    }

    const product = await newProduct
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
      await newProductImage.updateMany(
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

    const image = new newProductImage({
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

    const product = await newProduct
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

    const image = await newProductImage.findById(imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    // If deleting the main image, set another image as isMain
    if (image.isMain) {
      const otherImages = product.productImageIds.filter(
        (img) => img._id.toString() !== imageId
      );
      if (otherImages.length > 0) {
        await newProductImage.findByIdAndUpdate(otherImages[0]._id, {
          isMain: true,
        });
      }
    }

    await newProductImage.findByIdAndDelete(imageId);
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