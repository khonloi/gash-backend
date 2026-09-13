import mongoose from "mongoose";
import productRepository from "../repositories/productRepository.js";
import {
  CreateProductInput,
  UpdateProductInput,
  AddProductImageInput,
} from "../validations/productValidation.js";
import { AppError } from "../utils/apiResponse.js";

// Legacy import, assuming JS or untyped
// @ts-ignore
import ProductVariant from "../models/ProductVariant.js";

export class ProductService {
  async createProduct(productData: CreateProductInput) {
    const {
      productName,
      categoryId,
      description,
      productStatus,
      images,
      productVariantIds,
    } = productData;

    const existingProduct = await productRepository.findOne({
      productName: productName.trim(),
    });
    if (existingProduct) {
      throw new AppError("Product with this name already exists", 409);
    }

    const validatedVariantIds: string[] = [];
    if (productVariantIds && Array.isArray(productVariantIds)) {
      for (const variantId of productVariantIds) {
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
          throw new AppError("Invalid product variant ID", 400);
        }
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
          throw new AppError(
            `Product variant with ID ${variantId} not found`,
            404,
          );
        }
        validatedVariantIds.push(variantId);
      }
    }

    const finalProductStatus =
      validatedVariantIds.length > 0 ? productStatus || "active" : "pending";

    const savedProduct = await productRepository.create({
      productName: productName.trim(),
      categoryId: categoryId as any,
      description: description.trim(),
      images: images as any,
      productVariantIds: validatedVariantIds as any[],
      productStatus: finalProductStatus as any,
    });

    const populatedProduct = await productRepository.findById(
      savedProduct._id as string,
    );
    return populatedProduct;
  }

  async getAllProducts(filters: any = {}, userRole: string = "customer") {
    const { status, categoryId } = filters;
    const query: any = {};

    if (status) query.productStatus = status;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new AppError("Invalid category ID", 400);
      }
      query.categoryId = categoryId;
    }

    if (userRole === "customer") {
      query.productStatus = { $ne: "pending" };
    }

    return productRepository.find(query);
  }

  async searchProducts(searchParams: any = {}, userRole: string = "customer") {
    const { name, status } = searchParams;
    const query: any = {};

    if (name) {
      query.productName = { $regex: name, $options: "i" };
    }
    if (status) {
      if (!["active", "inactive", "pending", "discontinued"].includes(status)) {
        throw new AppError(
          'Product status must be either "active", "inactive", "pending", or "discontinued"',
          400,
        );
      }
      query.productStatus = status;
    }

    if (userRole === "customer") {
      query.productStatus = { $ne: "pending" };
    }

    return productRepository.find(query);
  }

  async getProductById(productId: string, userRole: string = "customer") {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError("Invalid product ID", 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (product.productStatus === "pending" && userRole === "customer") {
      throw new AppError("Access denied: product is pending approval", 403);
    }

    return product;
  }

  async updateProduct(productId: string, updateData: UpdateProductInput) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError("Invalid product ID", 400);
    }

    const existingProduct = await productRepository.findById(productId);
    if (!existingProduct) {
      throw new AppError("Product not found", 404);
    }
    if (existingProduct.productStatus === "discontinued") {
      throw new AppError("Cannot update a discontinued product", 400);
    }

    const {
      productName,
      categoryId,
      description,
      productStatus,
      images,
      productVariantIds,
    } = updateData;

    if (productName) {
      const duplicateProduct = await productRepository.findOne({
        productName: productName.trim(),
        _id: { $ne: productId },
      });
      if (duplicateProduct) {
        throw new AppError("Product with this name already exists", 409);
      }
    }

    let updatedVariantIds = [...(existingProduct.productVariantIds || [])];
    if (productVariantIds && Array.isArray(productVariantIds)) {
      updatedVariantIds = [];
      for (const variantId of productVariantIds) {
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
          throw new AppError("Invalid product variant ID", 400);
        }
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
          throw new AppError(
            `Product variant with ID ${variantId} not found`,
            404,
          );
        }
        updatedVariantIds.push(variantId as any);
      }
    }

    let finalProductStatus = existingProduct.productStatus;
    if (updatedVariantIds.length === 0) {
      switch (existingProduct.productStatus) {
        case "active":
          finalProductStatus = "inactive";
          break;
        case "inactive":
          break;
        default:
          finalProductStatus = "pending";
      }
    } else {
      finalProductStatus = "active";
    }

    if (
      productStatus &&
      updatedVariantIds.length > 0 &&
      productStatus !== "active"
    ) {
      console.warn(
        `Product ${productId} has variants but status is set to ${productStatus} instead of "active"`,
      );
      finalProductStatus = productStatus as any;
    }

    const updatePayload: any = {
      ...updateData,
      productVariantIds: updatedVariantIds,
      productStatus: finalProductStatus,
    };

    if (images) updatePayload.images = images;
    if (productName) updatePayload.productName = productName.trim();
    if (description) updatePayload.description = description.trim();

    const product = await productRepository.update(productId, updatePayload);
    if (!product) {
      throw new AppError("Product not found after update", 404);
    }
    return product;
  }

  async deleteProduct(productId: string) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError("Invalid product ID", 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    if (product.productStatus === "discontinued") {
      return { message: "Product is already discontinued" };
    }

    await productRepository.update(productId, {
      productStatus: "discontinued",
    });

    if (product.productVariantIds && product.productVariantIds.length > 0) {
      const variantIds = product.productVariantIds.map((v) => v._id);
      await ProductVariant.updateMany(
        { _id: { $in: variantIds } },
        { variantStatus: "discontinued", updatedAt: Date.now() },
      );
    }

    return {
      message: "Product and all its variants discontinued successfully",
    };
  }

  async addProductImage(productId: string, imageData: AddProductImageInput) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError("Invalid product ID", 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }
    if (product.productStatus === "discontinued") {
      throw new AppError("Cannot add images to a discontinued product", 400);
    }

    let updatedImages = [...product.images];

    if (imageData.isMain) {
      updatedImages = updatedImages.map((img) => {
        img.isMain = false;
        return img;
      });
    } else {
      const mainImageCount = updatedImages.filter(
        (img: any) => img.isMain,
      ).length;
      if (mainImageCount === 0) {
        throw new AppError(
          "An existing image must have isMain set to true if the new image is not main",
          400,
        );
      }
    }

    updatedImages.push(imageData as any);

    const updatedProduct = await productRepository.update(productId, {
      images: updatedImages,
    });
    return updatedProduct?.images[updatedProduct.images.length - 1]; // Return the newly added image
  }

  async deleteProductImage(productId: string, imageId: string) {
    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(imageId)
    ) {
      throw new AppError("Invalid product or image ID", 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404);
    }
    if (product.productStatus === "discontinued") {
      throw new AppError(
        "Cannot delete images from a discontinued product",
        400,
      );
    }
    if (product.images.length <= 1) {
      throw new AppError(
        "Cannot delete the last image; product must have at least one image",
        400,
      );
    }

    const imageIndex = product.images.findIndex(
      (img: any) => img._id.toString() === imageId,
    );
    if (imageIndex === -1) {
      throw new AppError("Image not found", 404);
    }

    const image = product.images[imageIndex];
    let updatedImages = [...product.images];

    // Remove the image
    updatedImages.splice(imageIndex, 1);

    if (image.isMain) {
      if (updatedImages.length > 0) {
        updatedImages[0].isMain = true;
      }
    }

    await productRepository.update(productId, { images: updatedImages });

    return { message: "Product image deleted successfully" };
  }
}

export default new ProductService();
