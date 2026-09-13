import { FilterQuery, UpdateQuery } from 'mongoose';
import Product, { IProduct } from '../models/Product.js';

export class ProductRepository {
  async findById(id: string): Promise<IProduct | null> {
    return Product.findById(id)
      .populate('categoryId')
      .populate({
        path: 'productVariantIds',
        populate: [{ path: 'productColorId' }, { path: 'productSizeId' }],
      })
      .exec();
  }

  async findOne(query: FilterQuery<IProduct>): Promise<IProduct | null> {
    return Product.findOne(query).exec();
  }

  async find(query: FilterQuery<IProduct>): Promise<IProduct[]> {
    return Product.find(query)
      .populate('categoryId')
      .populate({
        path: 'productVariantIds',
        populate: [{ path: 'productColorId' }, { path: 'productSizeId' }],
      })
      .exec();
  }

  async create(productData: Partial<IProduct>): Promise<IProduct> {
    const product = new Product(productData);
    return product.save();
  }

  async update(id: string, updateData: UpdateQuery<IProduct>): Promise<IProduct | null> {
    return Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('categoryId')
      .populate({
        path: 'productVariantIds',
        populate: [{ path: 'productColorId' }, { path: 'productSizeId' }],
      })
      .exec();
  }
}

export default new ProductRepository();
