import mongoose from 'mongoose';
import productRepository from '../repositories/productRepository.js';
import { CreateProductInput, UpdateProductInput, AddProductImageInput } from '../validations/productValidation.js';
import { AppError } from '../utils/apiResponse.js';

// Legacy import, assuming JS or untyped
// @ts-ignore
import ProductVariant from '../models/ProductVariant.js';

export class ProductService {
  async createProduct(productData: CreateProductInput) {
    const {
      productName,
      categoryId,
      description,
      productStatus,
      productImageIds,
      productVariantIds,
    } = productData;

    const existingProduct = await productRepository.findOne({ productName: productName.trim() });
    if (existingProduct) {
      throw new AppError('Product with this name already exists', 409);
    }

    const savedImageIds: string[] = [];
    for (const imageData of productImageIds) {
      const savedImage = await productRepository.createImage({
        imageUrl: imageData.imageUrl,
        isMain: imageData.isMain || false,
      });
      savedImageIds.push(savedImage._id as string);
    }

    const validatedVariantIds: string[] = [];
    if (productVariantIds && Array.isArray(productVariantIds)) {
      for (const variantId of productVariantIds) {
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
          throw new AppError('Invalid product variant ID', 400);
        }
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
          throw new AppError(`Product variant with ID ${variantId} not found`, 404);
        }
        validatedVariantIds.push(variantId);
      }
    }

    const finalProductStatus = validatedVariantIds.length > 0 ? (productStatus || 'active') : 'pending';

    const savedProduct = await productRepository.create({
      productName: productName.trim(),
      categoryId: categoryId as any,
      description: description.trim(),
      productImageIds: savedImageIds as any[],
      productVariantIds: validatedVariantIds as any[],
      productStatus: finalProductStatus as any,
    });

    if (savedImageIds.length > 0) {
      await productRepository.updateManyImages(
        { _id: { $in: savedImageIds } },
        { productId: savedProduct._id as any }
      );
    }

    const populatedProduct = await productRepository.findById(savedProduct._id as string);
    return populatedProduct;
  }

  async getAllProducts(filters: any = {}, userRole: string = 'customer') {
    const { status, categoryId } = filters;
    const query: any = {};

    if (status) query.productStatus = status;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new AppError('Invalid category ID', 400);
      }
      query.categoryId = categoryId;
    }

    if (userRole === 'customer') {
      query.productStatus = { $ne: 'pending' };
    }

    return productRepository.find(query);
  }

  async searchProducts(searchParams: any = {}, userRole: string = 'customer') {
    const { name, status } = searchParams;
    const query: any = {};

    if (name) {
      query.productName = { $regex: name, $options: 'i' };
    }
    if (status) {
      if (!['active', 'inactive', 'pending', 'discontinued'].includes(status)) {
        throw new AppError('Product status must be either "active", "inactive", "pending", or "discontinued"', 400);
      }
      query.productStatus = status;
    }

    if (userRole === 'customer') {
      query.productStatus = { $ne: 'pending' };
    }

    return productRepository.find(query);
  }

  async getProductById(productId: string, userRole: string = 'customer') {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('Invalid product ID', 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (product.productStatus === 'pending' && userRole === 'customer') {
      throw new AppError('Access denied: product is pending approval', 403);
    }

    return product;
  }

  async updateProduct(productId: string, updateData: UpdateProductInput) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('Invalid product ID', 400);
    }

    const existingProduct = await productRepository.findById(productId);
    if (!existingProduct) {
      throw new AppError('Product not found', 404);
    }
    if (existingProduct.productStatus === 'discontinued') {
      throw new AppError('Cannot update a discontinued product', 400);
    }

    const {
      productName,
      categoryId,
      description,
      productStatus,
      productImageIds,
      productVariantIds,
    } = updateData;

    if (productName) {
      const duplicateProduct = await productRepository.findOne({
        productName: productName.trim(),
        _id: { $ne: productId },
      });
      if (duplicateProduct) {
        throw new AppError('Product with this name already exists', 409);
      }
    }

    let updatedImageIds = [...(existingProduct.productImageIds || [])];
    if (productImageIds && Array.isArray(productImageIds)) {
      updatedImageIds = [];
      for (const imageData of productImageIds) {
        if (imageData._id && mongoose.Types.ObjectId.isValid(imageData._id)) {
          await productRepository.updateImage(
            imageData._id,
            { imageUrl: imageData.imageUrl, isMain: imageData.isMain || false }
          );
          updatedImageIds.push(imageData._id as any);
        } else {
          const savedImage = await productRepository.createImage({
            productId: productId as any,
            imageUrl: imageData.imageUrl,
            isMain: imageData.isMain || false,
          });
          updatedImageIds.push(savedImage._id as any);
        }
      }
    }

    let updatedVariantIds = [...(existingProduct.productVariantIds || [])];
    if (productVariantIds && Array.isArray(productVariantIds)) {
      updatedVariantIds = [];
      for (const variantId of productVariantIds) {
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
          throw new AppError('Invalid product variant ID', 400);
        }
        const variant = await ProductVariant.findById(variantId);
        if (!variant) {
          throw new AppError(`Product variant with ID ${variantId} not found`, 404);
        }
        updatedVariantIds.push(variantId as any);
      }
    }

    let finalProductStatus = existingProduct.productStatus;
    if (updatedVariantIds.length === 0) {
      if (existingProduct.productStatus === 'active') {
        finalProductStatus = 'inactive';
      } else if (existingProduct.productStatus !== 'inactive') {
        finalProductStatus = 'pending';
      }
    } else {
      finalProductStatus = 'active';
    }

    if (productStatus && updatedVariantIds.length > 0 && productStatus !== 'active') {
      console.warn(`Product ${productId} has variants but status is set to ${productStatus} instead of "active"`);
      finalProductStatus = productStatus as any;
    }

    const updatePayload: any = {
      ...updateData,
      productImageIds: updatedImageIds,
      productVariantIds: updatedVariantIds,
      productStatus: finalProductStatus,
    };

    if (productName) updatePayload.productName = productName.trim();
    if (description) updatePayload.description = description.trim();

    const product = await productRepository.update(productId, updatePayload);
    if (!product) {
      throw new AppError('Product not found after update', 404);
    }
    return product;
  }

  async deleteProduct(productId: string) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('Invalid product ID', 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (product.productStatus === 'discontinued') {
      return { message: 'Product is already discontinued' };
    }

    await productRepository.update(productId, { productStatus: 'discontinued' });

    if (product.productVariantIds && product.productVariantIds.length > 0) {
      const variantIds = product.productVariantIds.map(v => v._id);
      await ProductVariant.updateMany(
        { _id: { $in: variantIds } },
        { variantStatus: 'discontinued', updatedAt: Date.now() }
      );
    }

    return { message: 'Product and all its variants discontinued successfully' };
  }

  async addProductImage(productId: string, imageData: AddProductImageInput) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError('Invalid product ID', 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }
    if (product.productStatus === 'discontinued') {
      throw new AppError('Cannot add images to a discontinued product', 400);
    }

    if (imageData.isMain) {
      await productRepository.updateManyImages(
        { productId, isMain: true },
        { isMain: false }
      );
    } else {
      const mainImageCount = product.productImageIds.filter((img: any) => img.isMain).length;
      if (mainImageCount === 0) {
        throw new AppError('An existing image must have isMain set to true if the new image is not main', 400);
      }
    }

    const savedImage = await productRepository.createImage({
      productId: productId as any,
      imageUrl: imageData.imageUrl,
      isMain: imageData.isMain || false,
    });

    await productRepository.update(productId, {
      $push: { productImageIds: savedImage._id }
    } as any);

    return savedImage;
  }

  async deleteProductImage(productId: string, imageId: string) {
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(imageId)) {
      throw new AppError('Invalid product or image ID', 400);
    }

    const product = await productRepository.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }
    if (product.productStatus === 'discontinued') {
      throw new AppError('Cannot delete images from a discontinued product', 400);
    }
    if (product.productImageIds.length <= 1) {
      throw new AppError('Cannot delete the last image; product must have at least one image', 400);
    }

    const image = await productRepository.findImageById(imageId);
    if (!image) {
      throw new AppError('Image not found', 404);
    }

    if (image.isMain) {
      const otherImages = product.productImageIds.filter((img: any) => img._id.toString() !== imageId);
      if (otherImages.length > 0) {
        await productRepository.updateImage(otherImages[0]._id.toString(), { isMain: true });
      }
    }

    await productRepository.deleteImage(imageId);
    
    const updatedImageIds = product.productImageIds.filter((id: any) => id.toString() !== imageId);
    await productRepository.update(productId, { productImageIds: updatedImageIds as any });

    return { message: 'Product image deleted successfully' };
  }
}

export default new ProductService();
