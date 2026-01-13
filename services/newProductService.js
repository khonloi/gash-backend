const mongoose = require("mongoose");
const newProductImage = require("../models/newProductImage");
const newProduct = require("../models/newProduct");
const newProductVariant = require("../models/newProductVariant");
const OrderDetails = require("../models/OrderDetails");
const Categories = require("../models/Categories");
const { updateProductStatusBasedOnVariants } = require("./newProductVariantService");

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
        "Please fill in all required fields"
      );
    }

    // Validate product name format
    const trimmedProductName = productName.trim();
    const productNamePattern = /^[a-zA-ZÀ-ỹ0-9\s\-]+$/;
    if (trimmedProductName.length < 3 || trimmedProductName.length > 100 || !productNamePattern.test(trimmedProductName)) {
      throw new Error("Product name must be 3 to 100 characters long and contain only letters, numbers, spaces, and hyphens");
    }

    // Validate description length
    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 50 || trimmedDescription.length > 10000) {
      throw new Error("Description must be between 50 and 10000 characters long");
    }

    if (
      !productImageIds ||
      !Array.isArray(productImageIds) ||
      productImageIds.length === 0
    ) {
      throw new Error("Please fill in all required fields");
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
    const existingProduct = await newProduct.findOne({ productName: trimmedProductName });
    if (existingProduct) {
      throw new Error("Product with this name already exists");
    }

    let savedImageIds = [];
    for (const imageData of productImageIds) {
      if (!imageData.imageUrl) {
        throw new Error("Please fill in all required fields");
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

    // Set product status to "pending" if no variants, otherwise allow provided status or default to "pending"
    const finalProductStatus = validatedVariantIds.length > 0 ? (productStatus || "active") : "pending";

    const product = new newProduct({
      ...productData,
      productName: trimmedProductName,
      description: trimmedDescription,
      productImageIds: savedImageIds,
      productVariantIds: validatedVariantIds,
      productStatus: finalProductStatus,
    });
    const savedProduct = await product.save();

    if (savedImageIds.length > 0) {
      await newProductImage.updateMany(
        { _id: { $in: savedImageIds } },
        { productId: savedProduct._id }
      );
    }

    await updateProductStatusBasedOnVariants(savedProduct._id);

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
      // BR-11: Only show active products to customers
      query.productStatus = "active";
    }

    const products = await newProduct
      .find(query)
      .populate({
        path: "categoryId",
        match: { isDeleted: false }, // BR-15: Only active categories
      })
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        match: { variantStatus: { $in: ["active", "inactive"] } }, // BR-11: Only active/inactive variants
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });

    // BR-11: Filter products that have at least one active variant and active category
    if (userRole === "customer") {
      return products.filter(product => {
        // Check if product has active category
        if (!product.categoryId || product.categoryId.isDeleted) {
          return false;
        }
        // Check if product has at least one active variant
        const hasActiveVariant = product.productVariantIds?.some(v =>
          v && v.variantStatus === "active"
        ) || false;
        return hasActiveVariant;
      });
    }
    return products;
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
      // BR-11: Only show active products to customers
      query.productStatus = "active";
    }

    const products = await newProduct
      .find(query)
      .populate({
        path: "categoryId",
        match: { isDeleted: false }, // BR-15: Only active categories
      })
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        match: { variantStatus: { $in: ["active", "inactive"] } }, // BR-11: Only active/inactive variants
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });

    // BR-11: Filter products that have at least one active variant and active category
    if (userRole === "customer") {
      return products.filter(product => {
        // Check if product has active category
        if (!product.categoryId || product.categoryId.isDeleted) {
          return false;
        }
        // Check if product has at least one active variant
        const hasActiveVariant = product.productVariantIds?.some(v =>
          v && v.variantStatus === "active"
        ) || false;
        return hasActiveVariant;
      });
    }
    return products;
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
      .populate({
        path: "categoryId",
        match: { isDeleted: false }, // BR-15: Only active categories
      })
      .populate("productImageIds")
      .populate({
        path: "productVariantIds",
        match: userRole === "customer"
          ? { variantStatus: { $in: ["active", "inactive"] } } // BR-12: Only active/inactive variants for customers
          : {}, // Admin can see all variants
        populate: [{ path: "productColorId" }, { path: "productSizeId" }],
      });
    if (!product) {
      throw new Error("Product not found");
    }

    if (userRole === "customer") {
      // BR-11: Only show active products to customers
      if (product.productStatus !== "active") {
        throw new Error("Access denied: product is not active");
      }
      // BR-15: Check if product has active category
      if (!product.categoryId || product.categoryId.isDeleted) {
        throw new Error("Access denied: product category is not active");
      }
      // BR-11: Check if product has at least one active variant
      const hasActiveVariant = product.productVariantIds?.some(v =>
        v && v.variantStatus === "active"
      ) || false;
      if (!hasActiveVariant) {
        throw new Error("Access denied: product has no active variants");
      }
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
    if (productName && productName.trim() === "") {
      throw new Error("Please fill in all required fields");
    }

    // Validate product name format if provided
    let trimmedProductName = null;
    if (productName) {
      trimmedProductName = productName.trim();
      const productNamePattern = /^[a-zA-ZÀ-ỹ0-9\s\-]+$/;
      if (trimmedProductName.length < 3 || trimmedProductName.length > 100 || !productNamePattern.test(trimmedProductName)) {
        throw new Error("Product name must be 3 to 100 characters long and contain only letters, numbers, spaces, and hyphens");
      }
    }

    // Validate description length if provided
    let trimmedDescription = null;
    if (description !== undefined) {
      trimmedDescription = description.trim();
      if (trimmedDescription.length < 50 || trimmedDescription.length > 10000) {
        throw new Error("Description must be between 50 and 10000 characters long");
      }
    }
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("Invalid category ID");
    }
    if (productStatus && !["active", "pending", "inactive"].includes(productStatus)) {
      throw new Error('Product status must be either "active", "inactive" or "pending"');
    }
    if (
      productImageIds &&
      (!Array.isArray(productImageIds) || productImageIds.length === 0)
    ) {
      throw new Error("Please fill in all required fields");
    }

    const existingProduct = await newProduct.findById(productId);
    if (!existingProduct) {
      throw new Error("Product not found");
    }
    if (existingProduct.productStatus === "discontinued") {
      throw new Error("Cannot update a discontinued product");
    }

    if (productName && trimmedProductName) {
      const duplicateProduct = await newProduct.findOne({
        productName: trimmedProductName,
        _id: { $ne: productId },
      });
      if (duplicateProduct) {
        throw new Error("Product with this name already exists");
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
          throw new Error("Please fill in all required fields");
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

    // Use trimmed product name if provided
    if (trimmedProductName) {
      updatePayload.productName = trimmedProductName;
    }

    // Use trimmed description if provided
    if (trimmedDescription) {
      updatePayload.description = trimmedDescription;
    }

    const product = await newProduct
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

    await updateProductStatusBasedOnVariants(productId);

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

    const product = await newProduct.findById(productId).populate("productVariantIds");
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.productStatus === "discontinued") {
      return { message: "Product is already discontinued" };
    }

    // Check if product has variants with active orders
    // If any variant has active orders (pending, confirmed, or shipping), prevent product deletion
    if (product.productVariantIds && product.productVariantIds.length > 0) {
      const variantIds = product.productVariantIds.map(v => v._id || v);

      const orderDetails = await OrderDetails.find({
        variantId: { $in: variantIds }
      }).populate({
        path: "orderId",
        select: "orderStatus",
      });

      // Only prevent deletion if there are orders that are pending, confirmed, or shipping
      // Allow deletion if all orders are delivered or cancelled
      // This prevents deletion of products that have variants with active orders
      const hasActiveOrders = orderDetails.some(
        (detail) => {
          // Skip if orderId is null or not populated
          if (!detail.orderId) {
            return false;
          }
          const status = detail.orderId.orderStatus;
          return status === "pending" || status === "confirmed" || status === "shipping";
        }
      );

      if (hasActiveOrders) {
        throw new Error("Cannot delete product because it still contains variants with active orders");
      }
    }

    // Step 1: Discontinue the product
    await newProduct.findByIdAndUpdate(
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

      await newProductVariant.updateMany(
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