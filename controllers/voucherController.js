const Voucher = require('../models/Voucher');
const mongoose = require('mongoose');

//get all vouchers for admin
const getAllVouchers = async (req, res) => {
    try {
        // Lấy tất cả voucher (cả isDeleted true/false)
        const vouchers = await Voucher.find()
            .sort({ createdAt: -1 });

        // Map lại để thêm trạng thái "deleted" cho FE
        const result = vouchers.map(v => {
            const obj = v.toJSON(); // dùng transform đã định nghĩa
            obj.status = obj.isDeleted ? 'deleted' : 'active';
            return obj;
        });

        return res.status(200).json({
            success: true,
            message: 'Vouchers retrieved successfully',
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

//create voucher for admin
const createVoucher = async (req, res) => {
    try {
        const {
            code,
            discountType, // 'percentage' | 'fixed'
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = req.body;

        // =========================
        // 1. Input validation (follow field order)
        // =========================

        // 1.1 Code
        if (!/^[A-Z0-9]{3,30}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Voucher code must contain only uppercase letters and numbers, 3 to 30 characters long.',
            });
        }

        // 1.2 Discount type
        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: 'Discount type must be either "percentage" or "fixed".',
            });
        }

        // 1.3 Discount value
        if (discountType === 'percentage') {
            if (typeof discountValue !== 'number' || discountValue <= 0 || discountValue > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'For percentage discount, value must be greater than 0 and less than or equal to 100.',
                });
            }
        }
        if (discountType === 'fixed') {
            if (typeof discountValue !== 'number' || discountValue <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'For fixed discount, value must be greater than 0.',
                });
            }
        }

        // 1.4 Min order value
        if (discountType === 'fixed' && minOrderValue !== null && discountValue > minOrderValue) {
            return res.status(400).json({
                success: false,
                message: 'For fixed discount, the discount value cannot exceed the minimum order value.',
            });
        }

        // 1.5 Max discount
        if (discountType === 'percentage' && (maxDiscount === null || maxDiscount === undefined)) {
            return res.status(400).json({
                success: false,
                message: 'For percentage discount, a maximum discount value is required.',
            });
        }

        // 1.6 Start date
        const now = new Date();
        if (new Date(startDate) < now.setHours(0, 0, 0, 0)) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be in the past.',
            });
        }

        // 1.7 End date
        if (new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({
                success: false,
                message: 'End date must be later than start date.',
            });
        }

        // 1.8 Usage limit
        if (typeof usageLimit !== 'number' || usageLimit < 1) {
            return res.status(400).json({
                success: false,
                message: 'Usage limit must be at least 1.',
            });
        }

        // =========================
        // 2. Create voucher
        // =========================
        const newVoucher = new Voucher({
            code,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        });

        const savedVoucher = await newVoucher.save();

        return res.status(201).json({
            success: true,
            message: 'Voucher created successfully.',
            data: savedVoucher,
        });

    } catch (error) {
        // =========================
        // 3. Handle MongoDB errors
        // =========================
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid input: ' + error.message,
            });
        }
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Voucher code already exists.',
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
};



//update voucher for admin
const updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            discountType, // 'percentage' | 'fixed'
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = req.body;

        const voucher = await Voucher.findById(id);
        if (!voucher) {
            return res.status(404).json({
                success: false,
                message: 'Voucher not found.',
            });
        }

        // =========================
        // 1. Input validation (follow field order)
        // =========================

        // 1.1 Code
        if (code !== undefined) {
            if (!/^[A-Z0-9]{3,30}$/.test(code)) {
                return res.status(400).json({
                    success: false,
                    message: 'Voucher code must contain only uppercase letters and numbers, 3 to 30 characters long.',
                });
            }
            // Check duplicate code
            const existing = await Voucher.findOne({ code });
            if (existing && existing._id.toString() !== id) {
                return res.status(400).json({
                    success: false,
                    message: 'Voucher code already exists.',
                });
            }
            voucher.code = code;
        }

        // 1.2 Discount type
        if (discountType !== undefined) {
            if (!['percentage', 'fixed'].includes(discountType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Discount type must be either "percentage" or "fixed".',
                });
            }
            voucher.discountType = discountType;
        }

        // 1.3 Discount value
        if (discountValue !== undefined) {
            if (voucher.discountType === 'percentage') {
                if (typeof discountValue !== 'number' || discountValue <= 0 || discountValue > 100) {
                    return res.status(400).json({
                        success: false,
                        message: 'For percentage discount, value must be greater than 0 and less than or equal to 100.',
                    });
                }
            }
            if (voucher.discountType === 'fixed') {
                if (typeof discountValue !== 'number' || discountValue <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'For fixed discount, value must be greater than 0.',
                    });
                }
            }
            voucher.discountValue = discountValue;
        }

        // 1.4 Min order value
        if (minOrderValue !== undefined) {
            if (voucher.discountType === 'fixed' && discountValue !== undefined && discountValue > minOrderValue) {
                return res.status(400).json({
                    success: false,
                    message: 'For fixed discount, the discount value cannot exceed the minimum order value.',
                });
            }
            voucher.minOrderValue = minOrderValue;
        }

        // 1.5 Max discount
        if (maxDiscount !== undefined) {
            if (voucher.discountType === 'percentage' && (maxDiscount === null || maxDiscount === undefined)) {
                return res.status(400).json({
                    success: false,
                    message: 'For percentage discount, a maximum discount value is required.',
                });
            }
            voucher.maxDiscount = maxDiscount;
        }

        // 1.6 Start date
        if (startDate !== undefined) {
            const now = new Date();
            if (new Date(startDate) < now.setHours(0, 0, 0, 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date cannot be in the past.',
                });
            }
            voucher.startDate = startDate;
        }

        // 1.7 End date
        if (endDate !== undefined) {
            const effectiveStart = startDate ? new Date(startDate) : new Date(voucher.startDate);
            if (new Date(endDate) < effectiveStart) {
                return res.status(400).json({
                    success: false,
                    message: 'End date must be later than start date.',
                });
            }
            voucher.endDate = endDate;
        }

        // 1.8 Usage limit
        if (usageLimit !== undefined) {
            if (typeof usageLimit !== 'number' || usageLimit < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Usage limit must be at least 1.',
                });
            }
            if (usageLimit < voucher.usedCount) {
                return res.status(400).json({
                    success: false,
                    message: `Usage limit cannot be less than used count.`,
                });
            }
            voucher.usageLimit = usageLimit;
        }

        // =========================
        // 2. Save updates
        // =========================
        const updatedVoucher = await voucher.save();

        return res.status(200).json({
            success: true,
            message: 'Voucher updated successfully.',
            data: updatedVoucher,
        });

    } catch (error) {
        // =========================
        // 3. Handle MongoDB errors
        // =========================
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid input: ' + error.message,
            });
        }
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Voucher code already exists.',
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
};


// DELETE /vouchers/:id (soft delete)


const deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;

        // 1️⃣ Kiểm tra định dạng ID hợp lệ
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid voucher ID format.',
            });
        }

        // 2️⃣ Tìm voucher kể cả soft delete
        const voucher = await Voucher.findById(id);
        if (!voucher) {
            return res.status(404).json({
                success: false,
                message: 'Voucher not found.',
            });
        }

        // 3️⃣ Nếu voucher đã bị xóa mềm rồi
        if (voucher.isDeleted) {
            return res.status(400).json({
                success: false,
                message: 'Voucher has already been disabled.',
            });
        }

        // 4️⃣ Gắn cờ xóa mềm
        voucher.isDeleted = true;
        await voucher.save();

        // 5️⃣ Trả về kết quả
        return res.status(200).json({
            success: true,
            message: 'Voucher disabled successfully.',
            data: {
                id: voucher._id,
                code: voucher.code,
                status: 'deleted',
                updatedAt: voucher.updatedAt,
            },
        });
    } catch (error) {
        console.error('Error disabling voucher:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.',
            error: error.message,
        });
    }
};








module.exports = { createVoucher, updateVoucher, getAllVouchers, deleteVoucher };
