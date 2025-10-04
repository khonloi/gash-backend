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
            min: [0, 'Discount value must be at least 0'],
        },

        minOrderValue: {
            type: Number,
            default: 0,
            min: [0, 'Minimum order value cannot be negative'],
        },

        maxDiscount: {
            type: Number,
            default: null,
            min: [0, 'Max discount must be at least 0'],
        },

        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
            set: value => {
                const d = new Date(value);
                d.setHours(0, 0, 0, 0);
                return d;
            },
        },

        endDate: {
            type: Date,
            required: [true, 'End date is required'],
            set: value => {
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
        ret.id = ret._id.toString();
        delete ret._id;
        const ordered = { id: ret.id };
        Object.keys(ret).forEach(key => {
            if (key !== 'id') ordered[key] = ret[key];
        });
        return ordered;
    },
});

module.exports = mongoose.model('Vouchers', VoucherSchema);
