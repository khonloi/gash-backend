const specificationService = require('../services/specificationService');
const mongoose = require('mongoose');

// --- Product Colors ---
// Create product color
exports.createProductColor = async (req, res) => {
    try {
        const result = await specificationService.createProductColorService(req.body);

        if (result.success) {
            res.status(201).json(result);
        } else {
            const statusCode = result.error === 'DUPLICATE_COLOR_NAME' || result.error === 'VALIDATION_ERROR' || result.error === 'INVALID_COLOR_NAME_FORMAT' ? 400 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all product colors
exports.getAllProductColors = async (req, res) => {
    try {
        const result = await specificationService.getAllProductColorsService();

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get product color by ID
exports.getProductColorById = async (req, res) => {
    try {
        const result = await specificationService.getProductColorByIdService(req.params.id);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'COLOR_NOT_FOUND' ? 404 :
                result.error === 'INVALID_ID_FORMAT' ? 400 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update product color
exports.updateProductColor = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid color ID format.'
            });
        }

        const result = await specificationService.updateProductColorService(id, req.body);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'COLOR_NOT_FOUND' ? 404 :
                result.error === 'VALIDATION_ERROR' || result.error === 'DUPLICATE_COLOR_NAME' || result.error === 'INVALID_COLOR_NAME_FORMAT' || result.error === 'ALREADY_DELETED' ? 400 :
                    result.error === 'COLOR_IN_USE' ? 409 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete product color
exports.deleteProductColor = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid color ID format.'
            });
        }

        const result = await specificationService.deleteProductColorService(id);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'COLOR_NOT_FOUND' ? 404 :
                result.error === 'INVALID_ID_FORMAT' || result.error === 'ALREADY_DELETED' ? 400 :
                    result.error === 'COLOR_IN_USE' ? 409 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// --- Product Sizes ---
// Create product size
exports.createProductSize = async (req, res) => {
    try {
        const result = await specificationService.createProductSizeService(req.body);

        if (result.success) {
            res.status(201).json(result);
        } else {
            const statusCode = result.error === 'DUPLICATE_SIZE_NAME' || result.error === 'VALIDATION_ERROR' || result.error === 'INVALID_SIZE_NAME_FORMAT' ? 400 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all product sizes
exports.getAllProductSizes = async (req, res) => {
    try {
        const result = await specificationService.getAllProductSizesService();

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get product size by ID
exports.getProductSizeById = async (req, res) => {
    try {
        const result = await specificationService.getProductSizeByIdService(req.params.id);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'SIZE_NOT_FOUND' ? 404 :
                result.error === 'INVALID_ID_FORMAT' ? 400 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update product size
exports.updateProductSize = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid size ID format.'
            });
        }

        const result = await specificationService.updateProductSizeService(id, req.body);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'SIZE_NOT_FOUND' ? 404 :
                result.error === 'VALIDATION_ERROR' || result.error === 'DUPLICATE_SIZE_NAME' || result.error === 'INVALID_SIZE_NAME_FORMAT' || result.error === 'ALREADY_DELETED' ? 400 :
                    result.error === 'SIZE_IN_USE' ? 409 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete product size
exports.deleteProductSize = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid size ID format.'
            });
        }

        const result = await specificationService.deleteProductSizeService(id);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'SIZE_NOT_FOUND' ? 404 :
                result.error === 'INVALID_ID_FORMAT' || result.error === 'ALREADY_DELETED' ? 400 :
                    result.error === 'SIZE_IN_USE' ? 409 : 500;
            res.status(statusCode).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Search specifications
exports.searchSpecifications = async (req, res) => {
    try {
        const result = await specificationService.searchSpecificationsService(req.body);

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

