import specificationRepository from '../repositories/specificationRepository.js';
import productVariantRepository from '../repositories/productVariantRepository.js';
import { CreateColorInput, UpdateColorInput, CreateSizeInput, UpdateSizeInput } from '../validations/specificationValidation.js';
import { AppError } from '../utils/apiResponse.js';

export class SpecificationService {
  // --- Colors ---
  async createColor(colorData: CreateColorInput) {
    const existingColor = await specificationRepository.findOneColor({ color_name: colorData.color_name });
    if (existingColor) {
      throw new AppError('Color name already exists', 400);
    }
    return specificationRepository.createColor(colorData);
  }

  async getAllColors() {
    return specificationRepository.findColors({});
  }

  async getColorById(id: string) {
    const color = await specificationRepository.findColorById(id);
    if (!color) {
      throw new AppError('Color not found', 404);
    }
    return color;
  }

  async updateColor(id: string, colorData: UpdateColorInput) {
    const existingColor = await specificationRepository.findColorById(id);
    if (!existingColor) {
      throw new AppError('Color not found', 404);
    }

    if (existingColor.isDeleted) {
      throw new AppError('Cannot update a deleted color', 400);
    }

    if (colorData.color_name && colorData.color_name !== existingColor.color_name) {
      const duplicate = await specificationRepository.findOneColor({ color_name: colorData.color_name });
      if (duplicate && duplicate._id.toString() !== id) {
        throw new AppError('Color name already exists', 400);
      }
    }

    const updated = await specificationRepository.updateColor(id, colorData);
    return updated;
  }

  async deleteColor(id: string) {
    const existingColor = await specificationRepository.findColorById(id);
    if (!existingColor) {
      throw new AppError('Color not found', 404);
    }

    if (existingColor.isDeleted) {
      throw new AppError('Color is already deleted', 400);
    }

    const inUse = await productVariantRepository.findOne({ productColorId: id as any });
    if (inUse) {
      throw new AppError('Cannot delete color as it is currently used by one or more product variants', 409);
    }

    return specificationRepository.updateColor(id, { isDeleted: true });
  }

  // --- Sizes ---
  async createSize(sizeData: CreateSizeInput) {
    const existingSize = await specificationRepository.findOneSize({ size_name: sizeData.size_name });
    if (existingSize) {
      throw new AppError('Size name already exists', 400);
    }
    return specificationRepository.createSize(sizeData);
  }

  async getAllSizes() {
    return specificationRepository.findSizes({});
  }

  async getSizeById(id: string) {
    const size = await specificationRepository.findSizeById(id);
    if (!size) {
      throw new AppError('Size not found', 404);
    }
    return size;
  }

  async updateSize(id: string, sizeData: UpdateSizeInput) {
    const existingSize = await specificationRepository.findSizeById(id);
    if (!existingSize) {
      throw new AppError('Size not found', 404);
    }

    if (existingSize.isDeleted) {
      throw new AppError('Cannot update a deleted size', 400);
    }

    if (sizeData.size_name && sizeData.size_name !== existingSize.size_name) {
      const duplicate = await specificationRepository.findOneSize({ size_name: sizeData.size_name });
      if (duplicate && duplicate._id.toString() !== id) {
        throw new AppError('Size name already exists', 400);
      }
    }

    const updated = await specificationRepository.updateSize(id, sizeData);
    return updated;
  }

  async deleteSize(id: string) {
    const existingSize = await specificationRepository.findSizeById(id);
    if (!existingSize) {
      throw new AppError('Size not found', 404);
    }

    if (existingSize.isDeleted) {
      throw new AppError('Size is already deleted', 400);
    }

    const inUse = await productVariantRepository.findOne({ productSizeId: id as any });
    if (inUse) {
      throw new AppError('Cannot delete size as it is currently used by one or more product variants', 409);
    }

    return specificationRepository.updateSize(id, { isDeleted: true });
  }
}

export default new SpecificationService();
