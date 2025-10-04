const Voucher = require('../models/Voucher');

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
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            startDate,
            endDate,
            usageLimit,
        } = req.body;

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
            message: 'Voucher created successfully',
            data: savedVoucher,   // chỉ trả về data, bên trong đã có id
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Voucher code already exists',
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};



module.exports = { createVoucher, getAllVouchers };
