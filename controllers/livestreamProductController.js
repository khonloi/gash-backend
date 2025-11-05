const livestreamProductService = require('../services/livestreamProductService');
const mongoose = require('mongoose');

exports.addProductToLive = async (req, res) => {
    try {
        const { liveId, productId } = req.body;
        const userId = req.user?.id;

        if (!liveId || !productId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and productId are required'
            });
        }

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId or productId format'
            });
        }

        const result = await livestreamProductService.addProductToLive(liveId, productId, userId);

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

exports.removeProductFromLive = async (req, res) => {
    try {
        const { liveId, productId } = req.body;
        const userId = req.user.id; // Get userId from authenticated user

        if (!liveId || !productId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and productId are required'
            });
        }

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId or productId format'
            });
        }

        const result = await livestreamProductService.removeProductFromLive(liveId, productId, userId);

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

exports.getActiveLiveProducts = async (req, res) => {
    try {
        const { liveId } = req.params;

        if (!liveId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId is required'
            });
        }

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(liveId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId format'
            });
        }

        const result = await livestreamProductService.getActiveLiveProducts(liveId);

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

// Admin: get all live products including removed
exports.getAllLiveProductsForAdmin = async (req, res) => {
    try {
        const { liveId } = req.params;

        if (!liveId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId is required'
            });
        }

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(liveId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId format'
            });
        }

        const result = await livestreamProductService.getAllLiveProductsForAdmin(liveId);

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

// Pin product
exports.pinProduct = async (req, res) => {
    try {
        const { liveProductId } = req.params;
        const { liveId } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!liveId || !liveProductId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and liveProductId are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(liveProductId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId or liveProductId format'
            });
        }

        const result = await livestreamProductService.pinProduct(liveProductId, liveId, userId, userRole);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.message.includes('permission') ? 403 : 400;
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

// Remove pin from product
exports.removePinProduct = async (req, res) => {
    try {
        const { liveProductId } = req.params;
        const { liveId } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        if (!liveId || !liveProductId) {
            return res.status(400).json({
                success: false,
                message: 'LiveId and liveProductId are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(liveId) || !mongoose.Types.ObjectId.isValid(liveProductId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid liveId or liveProductId format'
            });
        }

        const result = await livestreamProductService.removePinProduct(liveProductId, liveId, userId, userRole);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.message.includes('permission') ? 403 : 400;
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