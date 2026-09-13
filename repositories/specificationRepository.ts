import { FilterQuery, UpdateQuery } from 'mongoose';
import ProductColor, { IProductColor } from '../models/ProductColor.js';
import ProductSize, { IProductSize } from '../models/ProductSize.js';

export class SpecificationRepository {
  // --- Colors ---
  async findColorById(id: string): Promise<IProductColor | null> {
    return ProductColor.findById(id).exec();
  }

  async findOneColor(query: FilterQuery<IProductColor>): Promise<IProductColor | null> {
    return ProductColor.findOne(query).exec();
  }

  async findColors(query: FilterQuery<IProductColor>): Promise<IProductColor[]> {
    return ProductColor.find(query).sort({ createdAt: -1 }).exec();
  }

  async createColor(colorData: Partial<IProductColor>): Promise<IProductColor> {
    const color = new ProductColor(colorData);
    return color.save();
  }

  async updateColor(id: string, updateData: UpdateQuery<IProductColor>): Promise<IProductColor | null> {
    return ProductColor.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).exec();
  }

  // --- Sizes ---
  async findSizeById(id: string): Promise<IProductSize | null> {
    return ProductSize.findById(id).exec();
  }

  async findOneSize(query: FilterQuery<IProductSize>): Promise<IProductSize | null> {
    return ProductSize.findOne(query).exec();
  }

  async findSizes(query: FilterQuery<IProductSize>): Promise<IProductSize[]> {
    return ProductSize.find(query).sort({ createdAt: -1 }).exec();
  }

  async createSize(sizeData: Partial<IProductSize>): Promise<IProductSize> {
    const size = new ProductSize(sizeData);
    return size.save();
  }

  async updateSize(id: string, updateData: UpdateQuery<IProductSize>): Promise<IProductSize | null> {
    return ProductSize.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).exec();
  }
}

export default new SpecificationRepository();
