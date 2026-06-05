const voucherService = require('../services/voucherService');
const mongoose = require('mongoose');

// Get all vouchers for admin
exports.getAllVouchersForAdmin = async (req, res) => {
    try {
        // Check phân quyền
        if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admin and staff can view vouchers'
            });
        }

        const result = await voucherService.getAllVouchersForAdmin();

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

// Create voucher for admin
exports.createVoucher = async (req, res) => {
    try {
        // Check phân quyền
        if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admin and staff can create vouchers'
            });
        }

        const {
            code,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = req.body;

        const result = await voucherService.createVoucher({
            code,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        });

        if (result.success) {
            res.status(201).json(result);
        } else {
            const statusCode = result.error === 'DUPLICATE_CODE' || result.error === 'VALIDATION_ERROR' ? 400 : 500;
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

// Update voucher for admin
exports.updateVoucher = async (req, res) => {
    try {
        // Check phân quyền
        if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admin and staff can update vouchers'
            });
        }

        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid voucher ID format.'
            });
        }

        const {
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = req.body;

        const result = await voucherService.updateVoucher(id, {
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        });

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'VOUCHER_NOT_FOUND' ? 404 :
                result.error === 'VALIDATION_ERROR' ? 400 : 500;
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

// Disable voucher for admin (soft delete)
exports.deleteVoucher = async (req, res) => {
    try {
        // Check phân quyền
        if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admin and staff can disable vouchers'
            });
        }

        const { id } = req.params;

        const result = await voucherService.deleteVoucher(id);

        if (result.success) {
            res.status(200).json(result);
        } else {
            const statusCode = result.error === 'VOUCHER_NOT_FOUND' ? 404 :
                result.error === 'INVALID_ID_FORMAT' ? 400 :
                    result.error === 'ALREADY_DELETED' ? 400 : 500;
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

// Get all vouchers for user (only active)
exports.getAllVouchersForUser = async (req, res) => {
    try {
        const result = await voucherService.getAllVouchersForUser();

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

// Preview voucher (calculate discount without applying)
exports.previewVoucher = async (req, res) => {
    try {
        const { voucherCode, totalPrice } = req.body;

        if (!totalPrice || typeof totalPrice !== 'number' || totalPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Total price must be a positive number.'
            });
        }

        const result = await voucherService.previewVoucher(voucherCode, totalPrice);

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

// Export applyVoucher for use in order processing
exports.applyVoucher = voucherService.applyVoucher;
