const Voucher = require('../models/Voucher');
const mongoose = require('mongoose');

// Get all vouchers for admin (including deleted)
exports.getAllVouchersForAdmin = async () => {
    try {
        const vouchers = await Voucher.find()
            .sort({ createdAt: -1 });

        const result = vouchers.map(v => {
            const obj = v.toJSON();
            obj.status = obj.isDeleted ? 'deleted' : 'active';
            return obj;
        });

        return {
            success: true,
            message: 'Vouchers retrieved successfully',
            data: result
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to retrieve vouchers',
            error: error.message
        };
    }
};

// Create voucher for admin
exports.createVoucher = async (voucherData) => {
    try {
        const {
            code,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = voucherData;

        // 1. Input validation 
        // 1.0 Check for blank/empty required fields
        // Note: minOrderValue can be 0, so we check for undefined/null/'' but not falsy
        if (!code || code.trim() === '' ||
            !discountType || discountType.trim() === '' ||
            discountValue === undefined || discountValue === null || discountValue === '' ||
            (minOrderValue === undefined || minOrderValue === null || minOrderValue === '') ||
            startDate === undefined || startDate === null || startDate === '' ||
            endDate === undefined || endDate === null || endDate === '' ||
            usageLimit === undefined || usageLimit === null || usageLimit === '' ||
            (discountType === 'percentage' && (maxDiscount === undefined || maxDiscount === null || maxDiscount === ''))) {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        // 1.1 Code
        if (!/^[A-Z0-9]{3,30}$/.test(code)) {
            return {
                success: false,
                message: 'Voucher code must contain only uppercase letters and numbers, 3 to 30 characters long.',
                error: 'INVALID_CODE_FORMAT'
            };
        }

        // 1.2 Discount type
        if (!['percentage', 'fixed'].includes(discountType)) {
            return {
                success: false,
                message: 'Discount type must be either "percentage" or "fixed".',
                error: 'INVALID_DISCOUNT_TYPE'
            };
        }

        // 1.3 Discount value
        if (discountType === 'percentage') {
            if (typeof discountValue !== 'number' || discountValue <= 0 || discountValue > 100) {
                return {
                    success: false,
                    message: 'For percentage discount, value must be greater than 0 and less than or equal to 100.',
                    error: 'INVALID_PERCENTAGE_VALUE'
                };
            }
        }
        if (discountType === 'fixed') {
            if (typeof discountValue !== 'number' || discountValue <= 0) {
                return {
                    success: false,
                    message: 'For fixed discount, value must be greater than 0.',
                    error: 'INVALID_FIXED_VALUE'
                };
            }
        }

        // 1.4 Min order value
        // Validate type and value range (must be number >= 0)
        if (typeof minOrderValue !== 'number') {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }
        if (minOrderValue < 0) {
            return {
                success: false,
                message: 'Minimum order value cannot be negative.',
                error: 'INVALID_MIN_ORDER_VALUE'
            };
        }

        // Business logic validation for fixed discount:
        // If minOrderValue > 0, discountValue cannot exceed minOrderValue
        // If minOrderValue = 0, no restriction (voucher can be used for any order)
        if (discountType === 'fixed' && minOrderValue > 0) {
            if (discountValue > minOrderValue) {
                return {
                    success: false,
                    message: 'For fixed discount, the discount value cannot exceed the minimum order value.',
                    error: 'DISCOUNT_EXCEEDS_MIN_ORDER'
                };
            }
        }

        // 1.5 Max discount
        // Note: Blank check for maxDiscount is already done in section 1.0
        if (discountType === 'percentage') {
            if (typeof maxDiscount !== 'number' || maxDiscount <= 0) {
                return {
                    success: false,
                    message: 'Maximum discount must be greater than 0.',
                    error: 'INVALID_MAX_DISCOUNT'
                };
            }
        }

        // 1.6 Start date
        const now = new Date();
        if (new Date(startDate) < now.setHours(0, 0, 0, 0)) {
            return {
                success: false,
                message: 'Start date cannot be in the past.',
                error: 'INVALID_START_DATE'
            };
        }

        // 1.7 End date
        if (new Date(endDate) < new Date(startDate)) {
            return {
                success: false,
                message: 'End date must be later than start date.',
                error: 'INVALID_END_DATE'
            };
        }

        // 1.8 Usage limit
        if (typeof usageLimit !== 'number' || usageLimit < 1) {
            return {
                success: false,
                message: 'Usage limit must be at least 1.',
                error: 'INVALID_USAGE_LIMIT'
            };
        }

        // 2. Create voucher
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

        return {
            success: true,
            message: 'Voucher added successfully',
            data: savedVoucher
        };

    } catch (error) {
        // 3. Handle MongoDB errors
        if (error.name === 'ValidationError') {
            // Check if it's a required field error
            const errors = error.errors || {};
            const hasRequiredError = Object.values(errors).some(
                err => err.kind === 'required' || err.message?.includes('required')
            );

            if (hasRequiredError) {
                return {
                    success: false,
                    message: 'Please fill in all required fields',
                    error: 'VALIDATION_ERROR'
                };
            }

            return {
                success: false,
                message: 'Invalid input: ' + error.message,
                error: 'VALIDATION_ERROR'
            };
        }
        if (error.code === 11000) {
            return {
                success: false,
                message: 'Voucher code already exists',
                error: 'DUPLICATE_CODE'
            };
        }
        return {
            success: false,
            message: 'Failed to create voucher',
            error: error.message
        };
    }
};

// Update voucher for admin
exports.updateVoucher = async (id, updateData) => {
    try {
        const {
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = updateData;

        const voucher = await Voucher.findById(id);
        if (!voucher) {
            return {
                success: false,
                message: 'Voucher not found.',
                error: 'VOUCHER_NOT_FOUND'
            };
        }

        // 1. Input validation (follow field order)
        // 1.0 Check for blank/empty fields when provided
        if ((discountType !== undefined && (!discountType || discountType.trim() === '')) ||
            (discountValue !== undefined && (discountValue === null || discountValue === '')) ||
            (startDate !== undefined && (startDate === null || startDate === '')) ||
            (endDate !== undefined && (endDate === null || endDate === '')) ||
            (usageLimit !== undefined && (usageLimit === null || usageLimit === '')) ||
            (maxDiscount !== undefined && (maxDiscount === null || maxDiscount === ''))) {
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        // 1.2 Discount type
        if (discountType !== undefined) {
            if (!['percentage', 'fixed'].includes(discountType)) {
                return {
                    success: false,
                    message: 'Discount type must be either "percentage" or "fixed".',
                    error: 'INVALID_DISCOUNT_TYPE'
                };
            }
            voucher.discountType = discountType;
        }

        // 1.3 Discount value
        if (discountValue !== undefined) {
            const effectiveDiscountType = discountType || voucher.discountType;
            if (effectiveDiscountType === 'percentage') {
                if (typeof discountValue !== 'number' || discountValue <= 0 || discountValue > 100) {
                    return {
                        success: false,
                        message: 'For percentage discount, value must be greater than 0 and less than or equal to 100.',
                        error: 'INVALID_PERCENTAGE_VALUE'
                    };
                }
            }
            if (effectiveDiscountType === 'fixed') {
                if (typeof discountValue !== 'number' || discountValue <= 0) {
                    return {
                        success: false,
                        message: 'For fixed discount, value must be greater than 0.',
                        error: 'INVALID_FIXED_VALUE'
                    };
                }
            }
            voucher.discountValue = discountValue;
        }

        // 1.4 Min order value
        if (minOrderValue !== undefined) {
            // Validate type
            if (minOrderValue === null || minOrderValue === '' || typeof minOrderValue !== 'number') {
                return {
                    success: false,
                    message: 'Please fill in all required fields',
                    error: 'VALIDATION_ERROR'
                };
            }
            // Validate value range (must be >= 0)
            if (minOrderValue < 0) {
                return {
                    success: false,
                    message: 'Minimum order value cannot be negative.',
                    error: 'INVALID_MIN_ORDER_VALUE'
                };
            }

            // Business logic validation for fixed discount:
            // If minOrderValue > 0, discountValue cannot exceed minOrderValue
            // If minOrderValue = 0, no restriction (voucher can be used for any order)
            const effectiveDiscountType = discountType !== undefined ? discountType : voucher.discountType;
            const effectiveDiscountValue = discountValue !== undefined ? discountValue : voucher.discountValue;

            if (effectiveDiscountType === 'fixed' && minOrderValue > 0) {
                if (effectiveDiscountValue > minOrderValue) {
                    return {
                        success: false,
                        message: 'For fixed discount, the discount value cannot exceed the minimum order value.',
                        error: 'DISCOUNT_EXCEEDS_MIN_ORDER'
                    };
                }
            }

            voucher.minOrderValue = minOrderValue;
        }

        // 1.5 Max discount
        if (maxDiscount !== undefined) {
            const effectiveDiscountType = discountType !== undefined ? discountType : voucher.discountType;
            if (effectiveDiscountType === 'percentage') {
                // For percentage discount, maxDiscount cannot be blank when provided
                if (maxDiscount === null || maxDiscount === '') {
                    return {
                        success: false,
                        message: 'Please fill in all required fields',
                        error: 'VALIDATION_ERROR'
                    };
                }
                if (typeof maxDiscount !== 'number' || maxDiscount <= 0) {
                    return {
                        success: false,
                        message: 'Maximum discount must be greater than 0.',
                        error: 'INVALID_MAX_DISCOUNT'
                    };
                }
            }
            voucher.maxDiscount = maxDiscount;
        } else if (discountType !== undefined && discountType === 'percentage') {
            // Changing to percentage but maxDiscount not provided
            return {
                success: false,
                message: 'Please fill in all required fields',
                error: 'VALIDATION_ERROR'
            };
        }

        // 1.6 Start date
        if (startDate !== undefined) {
            voucher.startDate = startDate;
        }

        // 1.7 End date
        if (endDate !== undefined) {
            const effectiveStart = startDate ? new Date(startDate) : new Date(voucher.startDate);
            if (new Date(endDate) < effectiveStart) {
                return {
                    success: false,
                    message: 'End date must be later than start date.',
                    error: 'INVALID_END_DATE'
                };
            }
            voucher.endDate = endDate;
        }

        // 1.8 Usage limit
        if (usageLimit !== undefined) {
            if (typeof usageLimit !== 'number' || usageLimit < 1) {
                return {
                    success: false,
                    message: 'Usage limit must be at least 1.',
                    error: 'INVALID_USAGE_LIMIT'
                };
            }
            if (usageLimit < voucher.usedCount) {
                return {
                    success: false,
                    message: `Usage limit cannot be less than used count (${voucher.usedCount}).`,
                    error: 'USAGE_LIMIT_TOO_LOW'
                };
            }
            voucher.usageLimit = usageLimit;
        }

        // 2. Save updates
        const updatedVoucher = await voucher.save();

        return {
            success: true,
            message: 'Voucher edited successfully',
            data: updatedVoucher
        };

    } catch (error) {
        // 3. Handle MongoDB errors
        if (error.name === 'ValidationError') {
            return {
                success: false,
                message: 'Invalid input: ' + error.message,
                error: 'VALIDATION_ERROR'
            };
        }
        return {
            success: false,
            message: 'Failed to update voucher',
            error: error.message
        };
    }
};

// Disable voucher for admin (soft delete)
exports.deleteVoucher = async (id) => {
    try {
        // Kiểm tra định dạng ID hợp lệ
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return {
                success: false,
                message: 'Invalid voucher ID format.',
                error: 'INVALID_ID_FORMAT'
            };
        }

        // Tìm voucher kể cả soft delete
        const voucher = await Voucher.findById(id);
        if (!voucher) {
            return {
                success: false,
                message: 'Voucher not found.',
                error: 'VOUCHER_NOT_FOUND'
            };
        }

        // Nếu voucher đã bị xóa mềm rồi
        if (voucher.isDeleted) {
            return {
                success: false,
                message: 'Voucher has already been disabled.',
                error: 'ALREADY_DELETED'
            };
        }

        // Gắn cờ xóa mềm
        voucher.isDeleted = true;
        await voucher.save();

        // Trả về kết quả
        return {
            success: true,
            message: 'Voucher disabled successfully',
            data: {
                id: voucher._id,
                code: voucher.code,
                status: 'deleted',
                updatedAt: voucher.updatedAt,
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to disable voucher',
            error: error.message
        };
    }
};

// Get all vouchers for user (only active)
// exports.getAllVouchersForUser = async () => {
//     try {
//         // Chỉ lấy voucher chưa bị xóa (isDeleted: false)
//         const vouchers = await Voucher.find({ isDeleted: false })
//             .sort({ createdAt: -1 });

//         const result = vouchers.map(v => {
//             const obj = v.toJSON();
//             obj.status = 'active';
//             return obj;
//         });

//         return {
//             success: true,
//             message: 'Vouchers retrieved successfully',
//             data: result
//         };
//     } catch (error) {
//         return {
//             success: false,
//             message: 'Failed to retrieve vouchers',
//             error: error.message
//         };
//     }
// };

// Apply voucher (used in order processing)
exports.applyVoucher = async (voucherCode, totalPrice) => {
    try {
        if (!totalPrice || totalPrice <= 0) {
            return {
                success: false,
                message: 'Total price must be greater than 0.',
                error: 'INVALID_TOTAL_PRICE'
            };
        }

        // Không nhập voucher
        if (!voucherCode) {
            return {
                success: true,
                message: 'No voucher applied.',
                data: {
                    voucher: null,
                    discountAmount: 0,
                    finalPrice: totalPrice,
                }
            };
        }

        // Tìm voucher
        const voucher = await Voucher.findOne({ code: voucherCode });
        if (!voucher || voucher.isDeleted) {
            return {
                success: false,
                message: 'Voucher not found or has been disabled.',
                error: 'VOUCHER_NOT_FOUND'
            };
        }

        const now = new Date();
        if (now < voucher.startDate) {
            return {
                success: false,
                message: 'Voucher is not active yet.',
                error: 'VOUCHER_NOT_ACTIVE'
            };
        }
        if (now > voucher.endDate) {
            return {
                success: false,
                message: 'Voucher has expired.',
                error: 'VOUCHER_EXPIRED'
            };
        }
        if (voucher.usedCount >= voucher.usageLimit) {
            return {
                success: false,
                message: 'Voucher usage limit reached.',
                error: 'VOUCHER_LIMIT_REACHED'
            };
        }
        // Check minimum order value requirement
        // If minOrderValue = 0, no restriction (any order > 0 can use the voucher)
        // If minOrderValue > 0, order must meet the minimum requirement
        if (voucher.minOrderValue > 0 && totalPrice < voucher.minOrderValue) {
            return {
                success: false,
                message: `Order must be at least Min Order Value to use this voucher.`,
                error: 'MIN_ORDER_NOT_MET'
            };
        }

        // Tính discount
        let discountAmount = 0;
        if (voucher.discountType === 'percentage') {
            discountAmount = (totalPrice * voucher.discountValue) / 100;
            if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
                discountAmount = voucher.maxDiscount;
            }
        } else {
            discountAmount = voucher.discountValue;
        }

        const finalPrice = Math.max(totalPrice - discountAmount, 0);

        return {
            success: true,
            message: 'Voucher applied successfully',
            data: {
                voucher,
                discountAmount,
                finalPrice,
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to apply voucher',
            error: error.message
        };
    }
};

// Preview voucher (calculate discount without applying)
exports.previewVoucher = async (voucherCode, totalPrice) => {
    try {
        const result = await exports.applyVoucher(voucherCode, totalPrice);

        if (!result.success) {
            return result;
        }

        const { voucher, discountAmount, finalPrice } = result.data;

        return {
            success: true,
            message: voucher ? 'Voucher applied successfully' : 'No voucher applied.',
            data: {
                voucherId: voucher ? (voucher.id || voucher._id.toString()) : null,
                code: voucher ? voucher.code : null,
                discountAmount,
                finalPrice,
            }
        };
    } catch (error) {
        return {
            success: false,
            message: 'Failed to preview voucher',
            error: error.message
        };
    }
};

