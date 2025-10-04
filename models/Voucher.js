const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, 'Voucher code is required'],
            unique: true,
            trim: true,
            minlength: [3, 'Voucher code must be at least 3 characters'],
            maxlength: [30, 'Voucher code must not exceed 30 characters'],
            match: [/^[A-Z0-9]+$/, 'Voucher code must contain only uppercase letters and numbers'],
        },

        discountType: {
            type: String,
            enum: ['percentage', 'fixed'],
            required: [true, 'Discount type is required'],
        },

        discountValue: {
            type: Number,
            required: [true, 'Discount value is required'],
            validate: {
                validator: function (value) {
                    if (this.discountType === 'percentage') {
                        if (value <= 0) throw new Error('Percentage discount must be greater than 0');
                        if (value > 100) throw new Error('Percentage discount cannot exceed 100');
                        return true;
                    }
                    if (this.discountType === 'fixed') {
                        if (value <= 0) throw new Error('Fixed discount must be greater than 0');
                        return true;
                    }
                    return false;
                },
                message: props => props.reason?.message || 'Invalid discount value',
            },
        },

        minOrderValue: {
            type: Number,
            default: 0,
            min: [0, 'Minimum order value cannot be negative'],
            validate: {
                validator: function (value) {
                    if (this.discountType === 'fixed') {
                        return value >= this.discountValue;
                    }
                    return true;
                },
                message: 'Minimum order value must be >= discount value for fixed discount',
            },
        },

        maxDiscount: {
            type: Number,
            default: null,
            validate: {
                validator: function (value) {
                    if (this.discountType === 'percentage') {
                        if (value === null) throw new Error('Percentage discount requires a maxDiscount value');
                        if (value <= 0) throw new Error('maxDiscount must be greater than 0 for percentage discount');
                        return true;
                    }
                    if (this.discountType === 'fixed') {
                        if (value !== null) throw new Error('maxDiscount must be null when discountType is fixed');
                        return true;
                    }
                    return true;
                },
                message: props => props.reason?.message || 'Invalid maxDiscount configuration',
            },
        },

        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
            validate: {
                validator: function (value) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return value >= today;
                },
                message: 'Start date cannot be before today',
            },
            set: function (value) {
                const d = new Date(value);
                d.setHours(0, 0, 0, 0);
                return d;
            },
        },

        endDate: {
            type: Date,
            required: [true, 'End date is required'],
            validate: {
                validator: function (value) {
                    return this.startDate <= value;
                },
                message: 'End date must be greater than or equal to start date',
            },
            set: function (value) {
                const d = new Date(value);
                d.setHours(23, 59, 59, 999);
                return d;
            },
        },

        usageLimit: {
            type: Number,
            default: 1,
            min: [1, 'Usage limit must be at least 1'],
        },

        usedCount: {
            type: Number,
            default: 0,
            min: [0, 'Used count cannot be negative'],
            validate: {
                validator: function (value) {
                    return value <= this.usageLimit;
                },
                message: 'Used count cannot exceed usage limit',
            },
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Format JSON trả về
VoucherSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id.toString();  // ép lại id từ _id
        delete ret._id;

        // Đưa id lên đầu object
        const ordered = { id: ret.id };
        Object.keys(ret).forEach(key => {
            if (key !== 'id') ordered[key] = ret[key];
        });
        return ordered;
    }
});


module.exports = mongoose.model('Vouchers', VoucherSchema);
