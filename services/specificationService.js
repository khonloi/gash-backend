const ProductSizes = require("../models/ProductSizes");
const ProductColors = require("../models/ProductColors");
const ProductImage = require("../models/ProductImage");
const ProductVariant = require('../models/ProductVariant');
const mongoose = require("mongoose");

// --- Product Colors ---
// Create product color
exports.createProductColorService = async ({ productColorName }) => {
    try {
        // 1. Input validation
        // 1.0 Check for blank/empty required fields
        if (!productColorName || productColorName.trim() === '') {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        // 1.1 Color name validation
        const trimmedName = productColorName.trim();
        const productColorNamePattern = /^[a-zA-ZÀ-Ỵà-ỹ0-9 ]+$/;

        if (
            trimmedName.length < 2 ||
            trimmedName.length > 30 ||
            !productColorNamePattern.test(trimmedName) ||
            /^[0-9]+$/.test(trimmedName) // do not allow numbers only
        ) {
            return {
                success: false,
                message: 'Color name must be 2 to 30 characters long, contain letters or numbers, and not be only numbers',
                error: 'INVALID_productColorName_FORMAT'
            };
        }


        // 2. Check duplicate - only check active colors (isDeleted: false)
        const existingColor = await ProductColors.findOne({ productColorName: trimmedName, isDeleted: false });
        if (existingColor) {
            return {
                success: false,
                message: 'Color name already exists',
                error: 'DUPLICATE_productColorName'
            };
        }
        const color = new ProductColors({ productColorName: trimmedName });
        const savedColor = await color.save();

        return {
            success: true,
            message: 'Product color added successfully',
            data: savedColor
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
                message: 'Color name already exists',
                error: 'DUPLICATE_productColorName'
            };
        }
        return {
            success: false,
            message: 'Failed to create product color',
            error: error.message
        };
    }
};

// Get all product colors
exports.getAllProductColorsService = async () => {
    try {
        const colors = await ProductColors.find().sort({ createdAt: -1 });

        return {
            success: true,
            message: 'Product colors retrieved successfully',
            data: colors
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to retrieve product colors',
            error: error.message
        };
    }
};

// Get product color by ID
exports.getProductColorByIdService = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid color ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }
        const color = await ProductColors.findById(id);
        if (!color) {
            return {
                success: false,
                message: 'Product color not found.',
                error: 'COLOR_NOT_FOUND'
            };
        }
        return {
            success: true,
            message: 'Product color retrieved successfully',
            data: color
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to retrieve product color',
            error: error.message
        };
    }
};

// Update product color
exports.updateProductColorService = async (id, { productColorName }) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid color ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }

        const color = await ProductColors.findById(id);
        if (!color) {
            return {
                success: false,
                message: 'Product color not found.',
                error: 'COLOR_NOT_FOUND'
            };
        }

        // Check if color is already deleted
        if (color.isDeleted) {
            return {
                success: false,
                message: 'Product color has already been deleted.',
                error: 'ALREADY_DELETED'
            };
        }

        // 1. Input validation
        // 1.0 Check for blank/empty field when provided
        if (productColorName !== undefined && (!productColorName || productColorName.trim() === '')) {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        // 1.1 Color name validation
        if (productColorName) {
            const trimmedName = productColorName.trim();
            const productColorNamePattern = /^[a-zA-ZÀ-ỹ0-9]+(?: [a-zA-ZÀ-ỹ0-9]+)*$/;
            if (trimmedName.length < 2 || trimmedName.length > 30 || !productColorNamePattern.test(trimmedName)) {
                return {
                    success: false,
                    message: 'Color name must be 2 to 30 characters long and contain only letters and numbers',
                    error: 'INVALID_productColorName_FORMAT'
                };
            }

            // 2. Check duplicate
            const existingColor = await ProductColors.findOne({ productColorName: trimmedName, _id: { $ne: id }, isDeleted: false });
            if (existingColor) {
                return {
                    success: false,
                    message: 'Color name already exists',
                    error: 'DUPLICATE_productColorName'
                };
            }
        }

        // 3. Prevent update if any variant is using this color
        const inUseCount = await ProductVariant.countDocuments({ productColorId: id });
        if (inUseCount > 0) {
            return {
                success: false,
                message: 'Cannot update color because it still contains products',
                error: 'COLOR_IN_USE'
            };
        }

        const updateData = productColorName ? { productColorName: productColorName.trim() } : { productColorName };
        const updatedColor = await ProductColors.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        return {
            success: true,
            message: 'Product color edited successfully',
            data: updatedColor
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
            message: 'Failed to update product color',
            error: error.message
        };
    }
};

// Delete product color (soft delete)
exports.deleteProductColorService = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid color ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }

        const color = await ProductColors.findById(id);
        if (!color) {
            return {
                success: false,
                message: 'Product color not found.',
                error: 'COLOR_NOT_FOUND'
            };
        }

        // Check if color is already deleted
        if (color.isDeleted) {
            return {
                success: false,
                message: 'Product color has already been deleted.',
                error: 'ALREADY_DELETED'
            };
        }

        // Prevent delete if any variant is using this color
        const inUseCount = await ProductVariant.countDocuments({ productColorId: id });
        if (inUseCount > 0) {
            return {
                success: false,
                message: 'Cannot delete color because it still contains products',
                error: 'COLOR_IN_USE'
            };
        }

        // Soft delete
        color.isDeleted = true;
        await color.save();

        return {
            success: true,
            message: 'Product color deleted successfully',
            data: {
                id: color._id,
                productColorName: color.productColorName,
                status: 'deleted',
                updatedAt: color.updatedAt
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to delete product color',
            error: error.message
        };
    }
};

// --- Product Sizes ---
// Create product size
exports.createProductSizeService = async ({ productSizeName }) => {
    try {
        // 1. Input validation
        // 1.0 Check for blank/empty required fields
        if (!productSizeName || productSizeName.trim() === '') {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        const trimmedName = productSizeName.trim();
        const productSizeNamePattern = /^[a-zA-ZÀ-Ỵà-ỹ0-9 ]+$/;

        if (
            trimmedName.length < 1 ||
            trimmedName.length > 12 ||
            !productSizeNamePattern.test(trimmedName)
        ) {
            return {
                success: false,
                message: 'Size name must be 1 to 12 characters long and contain only letters and numbers',
                error: 'INVALID_productSizeName_FORMAT'
            };
        }

        // If numbers only -> check boundaries
        if (/^[0-9]+$/.test(trimmedName)) {
            const numericValue = parseInt(trimmedName, 10);
            if (numericValue < 20 || numericValue > 60) { // general safe threshold
                return {
                    success: false,
                    message: 'Numeric size must be between 20 and 60',
                    error: 'INVALID_SIZE_RANGE'
                };
            }
        }

        // 2. Check duplicate - only check active sizes (isDeleted: false)
        const existingSize = await ProductSizes.findOne({ productSizeName: trimmedName, isDeleted: false });
        if (existingSize) {
            return {
                success: false,
                message: 'Size name already exists',
                error: 'DUPLICATE_productSizeName'
            };
        }
        const size = new ProductSizes({ productSizeName: trimmedName });
        const savedSize = await size.save();

        return {
            success: true,
            message: 'Product size added successfully',
            data: savedSize
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
                message: 'Size name already exists',
                error: 'DUPLICATE_productSizeName'
            };
        }
        return {
            success: false,
            message: 'Failed to create product size',
            error: error.message
        };
    }
};

// Get all product sizes
exports.getAllProductSizesService = async () => {
    try {
        const sizes = await ProductSizes.find().sort({ createdAt: -1 });

        return {
            success: true,
            message: 'Product sizes retrieved successfully',
            data: sizes
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to retrieve product sizes',
            error: error.message
        };
    }
};

// Get product size by ID
exports.getProductSizeByIdService = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid size ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }
        const size = await ProductSizes.findById(id);
        if (!size) {
            return {
                success: false,
                message: 'Product size not found.',
                error: 'SIZE_NOT_FOUND'
            };
        }
        return {
            success: true,
            message: 'Product size retrieved successfully',
            data: size
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to retrieve product size',
            error: error.message
        };
    }
};

// Update product size
exports.updateProductSizeService = async (id, { productSizeName }) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid size ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }

        const size = await ProductSizes.findById(id);
        if (!size) {
            return {
                success: false,
                message: 'Product size not found.',
                error: 'SIZE_NOT_FOUND'
            };
        }

        // Check if size is already deleted
        if (size.isDeleted) {
            return {
                success: false,
                message: 'Product size has already been deleted.',
                error: 'ALREADY_DELETED'
            };
        }

        // 1. Input validation
        // 1.0 Check for blank/empty field when provided
        if (productSizeName !== undefined && (!productSizeName || productSizeName.trim() === '')) {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        // 1.1 Size name validation
        if (productSizeName) {
            const trimmedName = productSizeName.trim();
            const productSizeNamePattern = /^[a-zA-ZÀ-ỹ0-9]+$/;
            if (trimmedName.length < 1 || trimmedName.length > 12 || !productSizeNamePattern.test(trimmedName)) {
                return {
                    success: false,
                    message: 'Size name must be 1 to 12 characters long and contain only letters and numbers',
                    error: 'INVALID_productSizeName_FORMAT'
                };
            }

            // 2. Check duplicate
            const existingSize = await ProductSizes.findOne({ productSizeName: trimmedName, _id: { $ne: id }, isDeleted: false });
            if (existingSize) {
                return {
                    success: false,
                    message: 'Size name already exists',
                    error: 'DUPLICATE_productSizeName'
                };
            }
        }

        // 3. Prevent update if any variant is using this size
        const inUseCount = await ProductVariant.countDocuments({ productSizeId: id });
        if (inUseCount > 0) {
            return {
                success: false,
                message: 'Cannot edit size because it still contains products',
                error: 'SIZE_IN_USE'
            };
        }

        const updateData = productSizeName ? { productSizeName: productSizeName.trim() } : { productSizeName };
        const updatedSize = await ProductSizes.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        return {
            success: true,
            message: 'Product size edited successfully',
            data: updatedSize
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
            message: 'Failed to update product size',
            error: error.message
        };
    }
};

// Delete product size (soft delete)
exports.deleteProductSizeService = async (id) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid size ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }

        const size = await ProductSizes.findById(id);
        if (!size) {
            return {
                success: false,
                message: 'Product size not found.',
                error: 'SIZE_NOT_FOUND'
            };
        }

        // Check if size is already deleted
        if (size.isDeleted) {
            return {
                success: false,
                message: 'Product size has already been deleted.',
                error: 'ALREADY_DELETED'
            };
        }

        // Prevent delete if any variant is using this size
        const inUseCount = await ProductVariant.countDocuments({ productSizeId: id });
        if (inUseCount > 0) {
            return {
                success: false,
                message: 'Cannot delete size because it still contains products',
                error: 'SIZE_IN_USE'
            };
        }

        // Soft delete
        size.isDeleted = true;
        await size.save();

        return {
            success: true,
            message: 'Product size deleted successfully',
            data: {
                id: size._id,
                productSizeName: size.productSizeName,
                status: 'deleted',
                updatedAt: size.updatedAt
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to delete product size',
            error: error.message
        };
    }
};

// --- Search Specifications ---
// Search specifications
exports.searchSpecificationsService = async ({ q, type }) => {
    try {
        let query = {};
        if (type && ["color", "size", "image"].includes(type)) {
            // handled below
        }
        if (q && typeof q === "string" && q.trim() !== "") {
            const trimmedQuery = q.trim();
            if (mongoose.isValidObjectId(trimmedQuery)) {
                query.$or = [{ _id: new mongoose.Types.ObjectId(trimmedQuery) }];
            } else {
                if (type === "color") {
                    query.productColorName = { $regex: trimmedQuery, $options: "i" };
                } else if (type === "size") {
                    query.productSizeName = { $regex: trimmedQuery, $options: "i" };
                } else if (type === "image") {
                    query.imageUrl = { $regex: trimmedQuery, $options: "i" };
                } else {
                    query.$or = [
                        { productColorName: { $regex: trimmedQuery, $options: "i" } },
                        { productSizeName: { $regex: trimmedQuery, $options: "i" } },
                        { imageUrl: { $regex: trimmedQuery, $options: "i" } }
                    ];
                }
            }
        }
        let results = [];
        if (!type || type === "color") {
            const colors = await ProductColors.find({ ...query, isDeleted: false });
            results.push(...colors.map(color => ({ ...color.toObject(), type: "color" })));
        }
        if (!type || type === "size") {
            const sizes = await ProductSizes.find({ ...query, isDeleted: false });
            results.push(...sizes.map(size => ({ ...size.toObject(), type: "size" })));
        }
        if (!type || type === "image") {
            const images = await ProductImage.find(query).populate("productId", "productName");
            results.push(...images.map(image => ({ ...image.toObject(), type: "image" })));
        }
        return {
            success: true,
            message: 'Specifications retrieved successfully',
            data: results
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to search specifications',
            error: error.message
        };
    }
};

