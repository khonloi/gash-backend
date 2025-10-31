const LiveProduct = require('../models/LiveProduct');
const { getIO } = require('../sockets/productSocket');

exports.addProductToLive = async (liveId, productId) => {
    try {
        // Check if product is already active in this livestream
        const existingProduct = await LiveProduct.findOne({
            liveId,
            productId,
            isActive: true
        });

        if (existingProduct) {
            return {
                success: false,
                message: 'Product is already active in this livestream',
                error: 'PRODUCT_ALREADY_ACTIVE'
            };
        }

        // Create new live product
        const liveProduct = new LiveProduct({
            liveId,
            productId,
            addedAt: new Date(),
            isActive: true
        });

        await liveProduct.save();

        // Update livestream's liveProductIds array
        const Livestream = require('../models/Livestream');
        await Livestream.findByIdAndUpdate(
            liveId,
            { $push: { liveProductIds: liveProduct._id } }
        );

        // Populate product data with minimal fields for websocket (only essential for display)
        await liveProduct.populate({
            path: 'productId',
            select: 'productName categoryId productImageIds',
            populate: [
                {
                    path: 'categoryId',
                    select: 'cat_name'
                },
                {
                    path: 'productImageIds',
                    select: 'imageUrl isMain',
                    options: { limit: 1, sort: { isMain: -1 } } // Only first/main image
                }
            ]
        });

        // Emit realtime event with optimized payload
        const productPayload = {
            _id: liveProduct._id,
            liveId: liveProduct.liveId,
            productId: liveProduct.productId._id,
            addedAt: liveProduct.addedAt,
            isPinned: liveProduct.isPinned,
            isActive: true,
            product: {
                productName: liveProduct.productId.productName,
                category: liveProduct.productId.categoryId ? {
                    cat_name: liveProduct.productId.categoryId.cat_name
                } : null,
                image: liveProduct.productId.productImageIds && liveProduct.productId.productImageIds.length > 0
                    ? liveProduct.productId.productImageIds[0].imageUrl
                    : null
            }
        };

        getIO().to(`live_${liveId}`).emit('product:added', {
            liveId,
            productId,
            liveProduct: productPayload
        });

        return {
            success: true,
            message: 'Product added to livestream successfully',
            data: liveProduct
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to add product to livestream: ${error.message}`,
            error: error.message
        };
    }
};

exports.removeProductFromLive = async (liveId, productId) => {
    try {
        // Check if product exists (active or not)
        const existingProduct = await LiveProduct.findOne({
            liveId,
            productId
        });

        // If no product found, return error
        if (!existingProduct) {
            return {
                success: false,
                message: 'Product not found in this livestream',
                error: 'PRODUCT_NOT_FOUND'
            };
        }

        // If product exists but not active, return success (already removed)
        if (!existingProduct.isActive) {
            // Populate product data with specific fields
            await existingProduct.populate({
                path: 'productId',
                select: 'productName description categoryId'
            });
            await existingProduct.populate({
                path: 'productId.categoryId',
                select: 'cat_name'
            });

            return {
                success: true,
                message: 'Product is already removed from livestream',
                data: existingProduct
            };
        }

        // Find and update the active product
        const liveProduct = await LiveProduct.findOneAndUpdate(
            {
                liveId,
                productId,
                isActive: true
            },
            {
                isActive: false,
                removedAt: new Date()
            },
            { new: true }
        );

        if (!liveProduct) {
            return {
                success: false,
                message: 'Active product not found in this livestream',
                error: 'PRODUCT_NOT_ACTIVE'
            };
        }

        // Emit realtime event with minimal payload (only IDs)
        getIO().to(`live_${liveId}`).emit('product:removed', {
            liveId,
            productId,
            liveProductId: liveProduct._id,
            removedAt: liveProduct.removedAt,
            isActive: false
        });

        return {
            success: true,
            message: 'Product removed from livestream successfully',
            data: liveProduct
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to remove product from livestream: ${error.message}`,
            error: error.message
        };
    }
};

exports.getActiveLiveProducts = async (liveId) => {
    try {
        const products = await LiveProduct.find({
            liveId,
            isActive: true
        })
            .sort({ isPinned: -1, addedAt: -1 }) // Pinned products first, then by added date
            .populate('pinBy', 'name username role')
            .populate('unpinBy', 'name username role')
            .populate({
                path: 'productId',
                select: 'productName description categoryId productImageIds productVariantIds',
                populate: [
                    {
                        path: 'categoryId',
                        select: 'cat_name'
                    },
                    {
                        path: 'productImageIds',
                        select: 'imageUrl isMain',
                        limit: 5 // Limit images for performance
                    },
                    {
                        path: 'productVariantIds',
                        populate: [
                            {
                                path: 'productColorId',
                                select: 'color_name color_code'
                            },
                            {
                                path: 'productSizeId',
                                select: 'size_name'
                            }
                        ],
                        select: 'variantImage variantPrice stockQuantity variantStatus'
                    }
                ]
            })
            .lean(); // Use lean() for read-only queries

        return {
            success: true,
            message: 'Active products retrieved successfully',
            data: products,
            count: products.length
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to get active products: ${error.message}`,
            error: error.message
        };
    }
};

// Admin: get all live products (including removed), with timestamps
exports.getAllLiveProductsForAdmin = async (liveId) => {
    try {
        const products = await LiveProduct.find({
            liveId
        })
            .sort({ isPinned: -1, addedAt: -1 })
            .populate('pinBy', 'name username role')
            .populate('unpinBy', 'name username role')
            .populate({
                path: 'productId',
                select: 'productName description categoryId productImageIds productVariantIds',
                populate: [
                    { path: 'categoryId', select: 'cat_name' },
                    { path: 'productImageIds', select: 'imageUrl isMain', limit: 5 },
                    {
                        path: 'productVariantIds',
                        populate: [
                            { path: 'productColorId', select: 'color_name color_code' },
                            { path: 'productSizeId', select: 'size_name' }
                        ],
                        select: 'variantImage variantPrice stockQuantity variantStatus'
                    }
                ]
            })
            .lean();

        // products contain addedAt and removedAt (if removed)
        return {
            success: true,
            message: 'All live products (including removed) retrieved successfully',
            data: products,
            count: products.length
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to get all (including removed) live products: ${error.message}`,
            error: error.message
        };
    }
};

// Pin product (admin only) - unpins all other products and comments in the livestream
exports.pinProduct = async (productId, liveId, userId, userRole) => {
    try {
        // Check permissions - only admin/manager can pin
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        if (!isAdmin) {
            return {
                success: false,
                message: 'Only admin or manager can pin products',
            };
        }

        // Verify product exists, belongs to the livestream, and is active
        const liveProduct = await LiveProduct.findOne({
            _id: productId,
            liveId: liveId,
            isActive: true
        });

        if (!liveProduct) {
            return {
                success: false,
                message: 'Product not found or is inactive. Only active products can be pinned.',
            };
        }

        // Check if product is already pinned
        if (liveProduct.isPinned) {
            return {
                success: false,
                message: 'Product is already pinned',
            };
        }

        // QUAN TRỌNG: Chỉ cho phép 1 product được pin tại 1 thời điểm
        // Unpin tất cả products khác trong livestream này (đảm bảo chỉ có 1 product pinned)
        // Lấy danh sách products sẽ bị unpin để emit events
        const productsToUnpin = await LiveProduct.find({
            liveId: liveId,
            isPinned: true,
            _id: { $ne: productId }, // Exclude the product being pinned
            isActive: true
        }).select('_id productId');

        await LiveProduct.updateMany(
            {
                liveId: liveId,
                isPinned: true, // Chỉ unpin các product đang được pin
                _id: { $ne: productId } // Exclude the product being pinned
            },
            { isPinned: false, unpinBy: userId }
        );

        // Unpin tất cả comments trong livestream (vì chỉ có thể pin comment HOẶC product, không thể cả 2)
        const LiveComment = require('../models/LiveComment');
        const commentsToUnpin = await LiveComment.find({
            liveId: liveId,
            isPinned: true,
            isDeleted: false
        }).select('_id');

        await LiveComment.updateMany(
            {
                liveId: liveId,
                isPinned: true // Chỉ unpin các comment đang được pin
            },
            { isPinned: false, unpinBy: userId }
        );

        // Emit events cho các products/comments bị unpin (để frontend cập nhật UI)
        const { getIO } = require('../sockets/productSocket');
        productsToUnpin.forEach(liveProductToUnpin => {
            getIO().to(`live_${liveId}`).emit('product:unpinned', {
                liveId,
                productId: liveProductToUnpin.productId,
                liveProductId: liveProductToUnpin._id,
                isPinned: false
            });
        });

        commentsToUnpin.forEach(commentToUnpin => {
            getIO().to(`live_${liveId}`).emit('comment:unpinned', {
                liveId,
                commentId: commentToUnpin._id,
                isPinned: false
            });
        });

        // Pin the specified product
        liveProduct.isPinned = true;
        liveProduct.pinBy = userId;
        liveProduct.unpinBy = null;
        await liveProduct.save();

        // Populate product data
        await liveProduct.populate('pinBy', 'name username role');
        await liveProduct.populate({
            path: 'productId',
            populate: [
                {
                    path: 'categoryId',
                    select: 'cat_name'
                },
                {
                    path: 'productImageIds',
                    select: 'imageUrl isMain'
                },
                {
                    path: 'productVariantIds',
                    populate: [
                        {
                            path: 'productColorId',
                            select: 'color_name color_code'
                        },
                        {
                            path: 'productSizeId',
                            select: 'size_name'
                        }
                    ],
                    select: 'variantImage variantPrice stockQuantity variantStatus'
                }
            ]
        });

        // Emit realtime event with optimized payload (only essential fields)
        const pinnedPayload = {
            _id: liveProduct._id,
            liveId: liveProduct.liveId,
            productId: liveProduct.productId._id,
            isPinned: true,
            product: {
                productName: liveProduct.productId.productName,
                category: liveProduct.productId.categoryId ? {
                    cat_name: liveProduct.productId.categoryId.cat_name
                } : null,
                image: liveProduct.productId.productImageIds && liveProduct.productId.productImageIds.length > 0
                    ? liveProduct.productId.productImageIds[0].imageUrl
                    : null
            },
            pinnedBy: {
                _id: liveProduct.pinBy._id,
                name: liveProduct.pinBy.name,
                username: liveProduct.pinBy.username
            }
        };

        getIO().to(`live_${liveId}`).emit('product:pinned', {
            liveId,
            productId: productId,
            liveProduct: pinnedPayload
        });

        return {
            success: true,
            message: 'Product pinned successfully',
            data: liveProduct
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to pin product: ${error.message}`,
            error: error.message
        };
    }
};

// Remove pin from product (admin only)
exports.removePinProduct = async (productId, liveId, userId, userRole) => {
    try {
        // Check permissions - only admin/manager can unpin
        const isAdmin = userRole === 'admin' || userRole === 'manager';
        if (!isAdmin) {
            return {
                success: false,
                message: 'Only admin or manager can unpin products',
            };
        }

        // Verify product exists and belongs to the livestream
        const liveProduct = await LiveProduct.findOne({
            _id: productId,
            liveId: liveId
        });

        if (!liveProduct) {
            return {
                success: false,
                message: 'Product not found in this livestream',
            };
        }

        // Check if product is not pinned
        if (!liveProduct.isPinned) {
            return {
                success: false,
                message: 'Product is not pinned',
            };
        }

        // Unpin the product (keep pinBy for statistics)
        liveProduct.isPinned = false;
        liveProduct.unpinBy = userId;
        // Keep pinBy to track who originally pinned it
        await liveProduct.save();

        // Populate product data
        await liveProduct.populate('unpinBy', 'name username role');
        await liveProduct.populate({
            path: 'productId',
            populate: [
                {
                    path: 'categoryId',
                    select: 'cat_name'
                },
                {
                    path: 'productImageIds',
                    select: 'imageUrl isMain'
                },
                {
                    path: 'productVariantIds',
                    populate: [
                        {
                            path: 'productColorId',
                            select: 'color_name color_code'
                        },
                        {
                            path: 'productSizeId',
                            select: 'size_name'
                        }
                    ],
                    select: 'variantImage variantPrice stockQuantity variantStatus'
                }
            ]
        });

        // Emit realtime event with minimal payload
        getIO().to(`live_${liveId}`).emit('product:unpinned', {
            liveId,
            productId: productId,
            liveProductId: liveProduct._id,
            isPinned: false
        });

        return {
            success: true,
            message: 'Product unpinned successfully',
            data: liveProduct
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to unpin product: ${error.message}`,
            error: error.message
        };
    }
};
