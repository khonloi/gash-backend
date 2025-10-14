const Orders = require('../models/Orders');
const OrderDetails = require('../models/OrderDetails');
const Accounts = require('../models/Accounts');
const newProductVariants = require('../models/newProductVariant');
const newProducts = require('../models/newProduct');
const ProductColors = require('../models/ProductColors');
const ProductSizes = require('../models/ProductSizes');
const mongoose = require('mongoose');

// Export bill cho một order cụ thể
exports.exportBill = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Validate order ID
        if (!mongoose.isValidObjectId(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        // Lấy thông tin order với populate
        const order = await Orders.findById(orderId)
            .populate({
                path: 'acc_id',
                select: 'username name email phone address'
            })
            .populate({
                path: 'voucher_id',
                select: 'code voucher_name discountType discountValue discount_percentage discount_amount minOrderValue maxDiscountAmount usedCount usageLimit startDate endDate isActive'
            });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check quyền: admin/staff có thể xem tất cả, user chỉ xem được bill của mình
        if (req.user.role !== 'admin' && req.user.role !== 'staff' &&
            order.acc_id._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own order bills.'
            });
        }


        // Lấy tất cả order details của order này
        const orderDetails = await OrderDetails.find({ order_id: orderId })
            .populate({
                path: 'variant_id',
                select: 'productId productColorId productSizeId variantImage',
                populate: [
                    {
                        path: 'productId',
                        select: 'productName'
                    },
                    {
                        path: 'productColorId',
                        select: 'color_name'
                    },
                    {
                        path: 'productSizeId',
                        select: 'size_name'
                    }
                ]
            });

        // Tính toán thông tin bill cơ bản
        const billData = {
            // Thông tin đơn hàng
            order: {
                orderId: order._id,
                orderDate: order.orderDate,
                orderStatus: order.order_status,
                totalPrice: order.totalPrice,
                finalPrice: order.finalPrice,
                paymentMethod: order.payment_method,
                paymentStatus: order.pay_status,
                shippingAddress: order.addressReceive
            },

            // Thông tin khách hàng
            customer: {
                name: order.name, // Recipient's name from order
                email: order.acc_id.email,
                phone: order.phone, // Phone from order (delivery contact)
                address: order.addressReceive // Delivery address from order
            },

            // Chi tiết sản phẩm
            items: orderDetails.map(detail => ({
                productName: detail.variant_id?.productId?.productName || 'N/A',
                color: detail.variant_id?.productColorId?.color_name || 'N/A',
                size: detail.variant_id?.productSizeId?.size_name || 'N/A',
                image: detail.variant_id?.variantImage || null,
                unitPrice: detail.UnitPrice,
                quantity: detail.Quantity,
                totalPrice: detail.UnitPrice * detail.Quantity
            })),

            // Thông tin giảm giá
            discount: order.voucher_id ? {
                voucher: {
                    _id: order.voucher_id._id,
                    code: order.voucher_id.code,
                    voucher_name: order.voucher_id.voucher_name,
                    discountType: order.voucher_id.discountType,
                    discountValue: order.voucher_id.discountValue,
                    discount_percentage: order.voucher_id.discount_percentage,
                    discount_amount: order.voucher_id.discount_amount,
                    minOrderValue: order.voucher_id.minOrderValue,
                    maxDiscountAmount: order.voucher_id.maxDiscountAmount,
                    usedCount: order.voucher_id.usedCount,
                    usageLimit: order.voucher_id.usageLimit,
                    startDate: order.voucher_id.startDate,
                    endDate: order.voucher_id.endDate,
                    isActive: order.voucher_id.isActive
                },
                appliedDiscount: order.discountAmount || 0
            } : {
                voucher: null,
                appliedDiscount: 0
            },

            // Tổng kết
            summary: {
                subtotal: orderDetails.reduce((sum, detail) => sum + (detail.UnitPrice * detail.Quantity), 0),
                discount: order.discountAmount || 0,
                totalAmount: order.finalPrice
            }
        };

        // Trả về dữ liệu bill
        res.status(200).json({
            success: true,
            message: 'Bill exported successfully',
            data: billData
        });

    } catch (error) {
        console.error('Export bill error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting bill',
            error: error.message
        });
    }
};
