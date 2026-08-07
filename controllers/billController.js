const Orders = require('../models/Orders');
const OrderDetails = require('../models/OrderDetails');
const Accounts = require('../models/Accounts');
const ProductVariant = require('../models/ProductVariant');
const Product = require('../models/Product');
const ProductColors = require('../models/ProductColors');
const ProductSizes = require('../models/ProductSizes');
const mongoose = require('mongoose');

// Export bill for a specific order
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

        // Get order details with populate
        const order = await Orders.findById(orderId)
            .populate({
                path: 'accountId',
                select: 'username name email phone address'
            })
            .populate({
                path: 'voucherId',
                select: 'code voucher_name discountType discountValue discount_percentage discount_amount minOrderValue maxDiscountAmount usedCount usageLimit startDate endDate isActive'
            });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Permissions check: admin/staff can view all, user can only view their own bill
        if (req.user.role !== 'admin' && req.user.role !== 'manager' &&
            order.accountId._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own order bills.'
            });
        }


        // Get all order details for this order
        const orderDetails = await OrderDetails.find({ orderId: orderId })
            .populate({
                path: 'variantId',
                select: 'productId productColorId productSizeId variantImage',
                populate: [
                    {
                        path: 'productId',
                        select: 'productName'
                    },
                    {
                        path: 'productColorId',
                        select: 'productColorName'
                    },
                    {
                        path: 'productSizeId',
                        select: 'productSizeName'
                    }
                ]
            });

        // Calculate basic bill data
        const billData = {
            // Order information
            order: {
                orderId: order._id,
                orderDate: order.orderDate,
                orderStatus: order.orderStatus,
                totalPrice: order.totalPrice,
                finalPrice: order.finalPrice,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.payStatus,
                shippingAddress: order.addressReceive
            },

            // Customer information
            customer: {
                name: order.name, // Recipient's name from order
                email: order.accountId.email,
                phone: order.phone, // Phone from order (delivery contact)
                address: order.addressReceive // Delivery address from order
            },

            // Product details
            items: orderDetails.map(detail => ({
                productName: detail.variantId?.productId?.productName || 'N/A',
                color: detail.variantId?.productColorId?.productColorName || 'N/A',
                size: detail.variantId?.productSizeId?.productSizeName || 'N/A',
                image: detail.variantId?.variantImage || null,
                unitPrice: detail.unitPrice,
                quantity: detail.Quantity,
                totalPrice: detail.unitPrice * detail.Quantity
            })),

            // Discount information
            discount: order.voucherId ? {
                voucher: {
                    _id: order.voucherId._id,
                    code: order.voucherId.code,
                    voucher_name: order.voucherId.voucher_name,
                    discountType: order.voucherId.discountType,
                    discountValue: order.voucherId.discountValue,
                    discount_percentage: order.voucherId.discount_percentage,
                    discount_amount: order.voucherId.discount_amount,
                    minOrderValue: order.voucherId.minOrderValue,
                    maxDiscountAmount: order.voucherId.maxDiscountAmount,
                    usedCount: order.voucherId.usedCount,
                    usageLimit: order.voucherId.usageLimit,
                    startDate: order.voucherId.startDate,
                    endDate: order.voucherId.endDate,
                    isActive: order.voucherId.isActive
                },
                appliedDiscount: order.discountAmount || 0
            } : {
                voucher: null,
                appliedDiscount: 0
            },

            // Summary
            summary: {
                subtotal: orderDetails.reduce((sum, detail) => sum + (detail.unitPrice * detail.Quantity), 0),
                discount: order.discountAmount || 0,
                totalAmount: order.finalPrice
            }
        };

        // Return bill data
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
