import { FilterQuery, UpdateQuery } from 'mongoose';
import ProductVariant, { IProductVariant } from '../models/ProductVariant.js';

export class ProductVariantRepository {
  async findById(id: string): Promise<IProductVariant | null> {
    return ProductVariant.findById(id)
      .populate('productId')
      .populate('productColorId')
      .populate('productSizeId')
      .exec();
  }

  async findOne(query: FilterQuery<IProductVariant>): Promise<IProductVariant | null> {
    return ProductVariant.findOne(query)
      .populate('productId')
      .populate('productColorId')
      .populate('productSizeId')
      .exec();
  }

  async find(query: FilterQuery<IProductVariant>): Promise<IProductVariant[]> {
    return ProductVariant.find(query)
      .populate('productId')
      .populate('productColorId')
      .populate('productSizeId')
      .exec();
  }

  async create(variantData: Partial<IProductVariant>): Promise<IProductVariant> {
    const variant = new ProductVariant(variantData);
    return variant.save();
  }

  async update(id: string, updateData: UpdateQuery<IProductVariant>): Promise<IProductVariant | null> {
    return ProductVariant.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('productId')
      .populate('productColorId')
      .populate('productSizeId')
      .exec();
  }

  async delete(id: string): Promise<IProductVariant | null> {
    return ProductVariant.findByIdAndDelete(id).exec();
  }

  async updateMany(query: FilterQuery<IProductVariant>, updateData: UpdateQuery<IProductVariant>): Promise<any> {
    return ProductVariant.updateMany(query, updateData).exec();
  }

  async insertMany(docs: Partial<IProductVariant>[]): Promise<IProductVariant[]> {
    const result = await ProductVariant.insertMany(docs);
    return result as unknown as IProductVariant[];
  }
}

export default new ProductVariantRepository();
