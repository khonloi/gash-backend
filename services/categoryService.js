const Categories = require('../models/Categories');
const newProduct = require('../models/newProduct');
const mongoose = require('mongoose');

// Create category
exports.createCategoryService = async ({ cat_name }) => {
  try {
    // 1. Input validation
    // 1.0 Check for blank/empty required fields
    if (!cat_name || cat_name.trim() === '') {
      return {
        success: false,
        message: 'Please fill in all required fields',
        error: 'VALIDATION_ERROR'
      };
    }

    // 1.1 Category name validation
    const trimmedName = cat_name.trim();
    const categoryNamePattern = /^[a-zA-ZÀ-ỹ0-9\-]+$/;
    if (trimmedName.length < 3 || trimmedName.length > 30 || !categoryNamePattern.test(trimmedName)) {
      return {
        success: false,
        message: 'Category name must be 3 to 30 characters long and contain only letters, numbers, and hyphens',
        error: 'INVALID_CATEGORY_NAME_FORMAT'
      };
    }

    // 2. Check duplicate
    const existingCategory = await Categories.findOne({ cat_name: trimmedName, isDeleted: false });
    if (existingCategory) {
      return {
        success: false,
        message: 'Category name already exists',
        error: 'DUPLICATE_CATEGORY_NAME'
      };
    }
    const category = new Categories({ cat_name: trimmedName });
    const savedCategory = await category.save();

    return {
      success: true,
      message: 'Category added successfully',
      data: savedCategory
    };
  } catch (error) {
    if (error.name === 'ValidationError') {
      return {
        success: false,
        message: 'Please fill in all required fields',
        error: 'VALIDATION_ERROR'
      };
    }
    if (error.code === 11000) {
      return {
        success: false,
        message: 'Category name already exists',
        error: 'DUPLICATE_CATEGORY_NAME'
      };
    }
    return {
      success: false,
      message: 'Failed to create category',
      error: error.message
    };
  }
};

// Get all categories
exports.getAllCategoriesService = async () => {
  try {
    const categories = await Categories.find().sort({ createdAt: -1 });

    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to retrieve categories',
      error: error.message
    };
  }
};

// Get category by ID
exports.getCategoryByIdService = async (id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        success: false,
        message: 'Invalid category ID format',
        error: 'INVALID_ID_FORMAT'
      };
    }
    const category = await Categories.findById(id);
    if (!category) {
      return {
        success: false,
        message: 'Category not found.',
        error: 'CATEGORY_NOT_FOUND'
      };
    }
    return {
      success: true,
      message: 'Category retrieved successfully',
      data: category
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to retrieve category',
      error: error.message
    };
  }
};

// Update category
exports.updateCategoryService = async (id, { cat_name }) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        success: false,
        message: 'Invalid category ID format.',
        error: 'INVALID_ID_FORMAT'
      };
    }

    const category = await Categories.findById(id);
    if (!category) {
      return {
        success: false,
        message: 'Category not found.',
        error: 'CATEGORY_NOT_FOUND'
      };
    }

    // Check if category is already deleted
    if (category.isDeleted) {
      return {
        success: false,
        message: 'Category has already been deleted.',
        error: 'ALREADY_DELETED'
      };
    }

    // Prevent update if any product belongs to this category
    const objectId = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
    const productCount = await newProduct.countDocuments({
      $or: [
        ...(objectId ? [{ categoryId: objectId }] : []),
        { categoryId: id } // legacy string id support
      ]
    });
    if (productCount > 0) {
      return {
        success: false,
        message: 'Cannot edit category because it still contains products',
        error: 'CATEGORY_IN_USE'
      };
    }

    // 1. Input validation
    // 1.0 Check for blank/empty field when provided
    if (cat_name !== undefined && (!cat_name || cat_name.trim() === '')) {
      return {
        success: false,
        message: 'Please fill in all required fields',
        error: 'VALIDATION_ERROR'
      };
    }

    // 1.1 Category name validation
    if (cat_name) {
      const trimmedName = cat_name.trim();
      const categoryNamePattern = /^[a-zA-ZÀ-ỹ0-9\-]+$/;
      if (trimmedName.length < 3 || trimmedName.length > 30 || !categoryNamePattern.test(trimmedName)) {
        return {
          success: false,
          message: 'Category name must be 3 to 30 characters long and contain only letters, numbers, and hyphens',
          error: 'INVALID_CATEGORY_NAME_FORMAT'
        };
      }

      // 2. Check duplicate
      const existingCategory = await Categories.findOne({ cat_name: trimmedName, _id: { $ne: id }, isDeleted: false });
      if (existingCategory) {
        return {
          success: false,
          message: 'Category name already exists',
          error: 'DUPLICATE_CATEGORY_NAME'
        };
      }
    }

    const updateData = cat_name ? { cat_name: cat_name.trim() } : { cat_name };
    const updatedCategory = await Categories.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return {
      success: true,
      message: 'Category edited successfully',
      data: updatedCategory
    };
  } catch (error) {
    if (error.name === 'ValidationError') {
      return {
        success: false,
        message: 'Please fill in all required fields',
        error: 'VALIDATION_ERROR'
      };
    }
    return {
      success: false,
      message: 'Failed to update category',
      error: error.message
    };
  }
};

// Delete category (soft delete)
exports.deleteCategoryService = async (id, user) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        success: false,
        message: 'Invalid category ID format.',
        error: 'INVALID_ID_FORMAT'
      };
    }

    const category = await Categories.findById(id);
    if (!category) {
      return {
        success: false,
        message: 'Category not found.',
        error: 'CATEGORY_NOT_FOUND'
      };
    }

    // Check if category is already deleted
    if (category.isDeleted) {
      return {
        success: false,
        message: 'Category has already been deleted.',
        error: 'ALREADY_DELETED'
      };
    }

    // Check if any product is using this category (handle both ObjectId and legacy string storage)
    const objectId = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
    const productCount = await newProduct.countDocuments({
      $or: [
        ...(objectId ? [{ categoryId: objectId }] : []),
        { categoryId: id }
      ]
    });
    if (productCount > 0) {
      return {
        success: false,
        message: 'Cannot delete category because it still contains products',
        error: 'CATEGORY_IN_USE'
      };
    }

    // Soft delete
    category.isDeleted = true;
    await category.save();

    return {
      success: true,
      message: 'Category deleted successfully',
      data: {
        id: category._id,
        cat_name: category.cat_name,
        status: 'deleted',
        updatedAt: category.updatedAt
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to delete category',
      error: error.message
    };
  }
};