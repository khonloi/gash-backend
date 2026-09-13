import mongoose from 'mongoose';
import productVariantRepository from '../repositories/productVariantRepository.js';
import specificationRepository from '../repositories/specificationRepository.js';
import { CreateVariantInput, UpdateVariantInput, BulkCreateVariantInput } from '../validations/variantValidation.js';
import { AppError } from '../utils/apiResponse.js';
// We also need Product model to check existence, assuming it's refactored
import Product from '../models/Product.js';

export class ProductVariantService {
  async createVariant(variantData: CreateVariantInput) {
    const { productId, productColorId, productSizeId, variantImage, variantPrice, stockQuantity } = variantData;

    // Validate relationships
    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const color = await specificationRepository.findColorById(productColorId);
    if (!color || color.isDeleted) throw new AppError('Product color not found or deleted', 404);

    const size = await specificationRepository.findSizeById(productSizeId);
    if (!size || size.isDeleted) throw new AppError('Product size not found or deleted', 404);

    // Check if variant already exists
    const existingVariant = await productVariantRepository.findOne({
      productId: productId as any,
      productColorId: productColorId as any,
      productSizeId: productSizeId as any,
    });

    if (existingVariant) {
      if (existingVariant.variantStatus === 'discontinued') {
        throw new AppError('This product variant is discontinued and cannot be recreated.', 400);
      }

      const oldStock = existingVariant.stockQuantity;
      const newStock = oldStock + stockQuantity;

      const updatedVariant = await productVariantRepository.update(existingVariant._id as string, {
        stockQuantity: newStock,
        variantPrice, // Update price to latest
        variantImage, // Update image to latest
        variantStatus: 'active'
      });

      return {
        wasUpdated: true,
        variant: updatedVariant,
        oldStockQuantity: oldStock,
        newStockQuantity: newStock
      };
    }

    const newVariant = await productVariantRepository.create({
      productId: productId as any,
      productColorId: productColorId as any,
      productSizeId: productSizeId as any,
      variantImage,
      variantPrice,
      stockQuantity,
      variantStatus: 'active'
    });

    // We must populate after create
    const populated = await productVariantRepository.findById(newVariant._id as string);

    // Update product to include this variant
    await Product.findByIdAndUpdate(productId, {
      $addToSet: { productVariantIds: newVariant._id }
    });

    return {
      wasUpdated: false,
      variant: populated
    };
  }

  async getAllVariants(filters: any = {}) {
    const query: any = {};
    if (filters.status) query.variantStatus = filters.status;
    if (filters.productId) query.productId = filters.productId;

    return productVariantRepository.find(query);
  }

  async getVariantById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid variant ID', 400);

    const variant = await productVariantRepository.findById(id);
    if (!variant) throw new AppError('Product variant not found', 404);
    
    return variant;
  }

  async updateVariant(id: string, updateData: UpdateVariantInput) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid variant ID', 400);

    const existingVariant = await productVariantRepository.findById(id);
    if (!existingVariant) throw new AppError('Product variant not found', 404);

    if (existingVariant.variantStatus === 'discontinued') {
      throw new AppError('Cannot update a discontinued variant', 400);
    }

    if (updateData.productId && updateData.productId !== existingVariant.productId.toString()) {
      const product = await Product.findById(updateData.productId);
      if (!product) throw new AppError('Product not found', 404);
    }
    if (updateData.productColorId && updateData.productColorId !== existingVariant.productColorId.toString()) {
      const color = await specificationRepository.findColorById(updateData.productColorId);
      if (!color || color.isDeleted) throw new AppError('Product color not found or deleted', 404);
    }
    if (updateData.productSizeId && updateData.productSizeId !== existingVariant.productSizeId.toString()) {
      const size = await specificationRepository.findSizeById(updateData.productSizeId);
      if (!size || size.isDeleted) throw new AppError('Product size not found or deleted', 404);
    }

    const updated = await productVariantRepository.update(id, updateData);
    if (!updated) throw new AppError('Failed to update variant', 500);

    return updated;
  }

  async deleteVariant(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid variant ID', 400);

    const variant = await productVariantRepository.findById(id);
    if (!variant) throw new AppError('Product variant not found', 404);

    if (variant.variantStatus === 'discontinued') {
      throw new AppError('Variant is already discontinued', 400);
    }

    await productVariantRepository.update(id, { variantStatus: 'discontinued' });

    // Since we soft delete, we don't remove it from the Product's productVariantIds array
    return { message: 'Variant discontinued successfully' };
  }

  async bulkCreateVariants(bulkData: BulkCreateVariantInput) {
    const { productId, productColorId, sizeIds, variantImage, variantPrice, stockQuantity } = bulkData;

    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404);

    const color = await specificationRepository.findColorById(productColorId);
    if (!color || color.isDeleted) throw new AppError('Product color not found or deleted', 404);

    const createdVariants = [];

    for (const sizeId of sizeIds) {
      const size = await specificationRepository.findSizeById(sizeId);
      if (!size || size.isDeleted) continue; // Skip invalid sizes in bulk create

      const existingVariant = await productVariantRepository.findOne({
        productId: productId as any,
        productColorId: productColorId as any,
        productSizeId: sizeId as any,
      });

      if (existingVariant) {
        if (existingVariant.variantStatus !== 'discontinued') {
          const updated = await productVariantRepository.update(existingVariant._id as string, {
            stockQuantity: existingVariant.stockQuantity + stockQuantity,
            variantPrice,
            variantImage
          });
          createdVariants.push(updated);
        }
      } else {
        const newVariant = await productVariantRepository.create({
          productId: productId as any,
          productColorId: productColorId as any,
          productSizeId: sizeId as any,
          variantImage,
          variantPrice,
          stockQuantity,
          variantStatus: 'active'
        });

        const populated = await productVariantRepository.findById(newVariant._id as string);
        createdVariants.push(populated);

        await Product.findByIdAndUpdate(productId, {
          $addToSet: { productVariantIds: newVariant._id }
        });
      }
    }

    if (createdVariants.length === 0) {
      throw new AppError('No variants were created. Check if the provided sizes are valid.', 400);
    }

    return createdVariants;
  }
}

export default new ProductVariantService();
