import { FilterQuery, UpdateQuery } from 'mongoose';
import Product, { IProduct } from '../models/Product.js';
import ProductImage, { IProductImage } from '../models/ProductImage.js';

export class ProductRepository {
  async findById(id: string): Promise<IProduct | null> {
    return Product.findById(id)
      .populate('categoryId')
      .populate('productImageIds')
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
      .populate('productImageIds')
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
      .populate('productImageIds')
      .populate({
        path: 'productVariantIds',
        populate: [{ path: 'productColorId' }, { path: 'productSizeId' }],
      })
      .exec();
  }

  // Soft delete handled via update status in service, but we can provide update method.

  // --- ProductImage Operations ---

  async createImage(imageData: Partial<IProductImage>): Promise<IProductImage> {
    const image = new ProductImage(imageData);
    return image.save();
  }

  async findImageById(id: string): Promise<IProductImage | null> {
    return ProductImage.findById(id).exec();
  }

  async updateImage(id: string, updateData: UpdateQuery<IProductImage>): Promise<IProductImage | null> {
    return ProductImage.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async deleteImage(id: string): Promise<IProductImage | null> {
    return ProductImage.findByIdAndDelete(id).exec();
  }

  async updateManyImages(query: FilterQuery<IProductImage>, updateData: UpdateQuery<IProductImage>): Promise<any> {
    return ProductImage.updateMany(query, updateData).exec();
  }
}

export default new ProductRepository();
