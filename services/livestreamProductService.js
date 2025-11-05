const LiveProduct = require('../models/liveProduct');
const LiveComment = require('../models/liveComment');
const Livestream = require('../models/Livestream');
const { getIO } = require('../sockets/productSocket');

exports.addProductToLive = async (liveId, productId, userId = null) => {
    try {
        // Check if product is already active in this livestream
        const existingActiveProduct = await LiveProduct.findOne({
            liveId,
            productId,
            isActive: true
        });

        if (existingActiveProduct) {
            return {
                success: false,
                message: 'Product is already active in this livestream',
                error: 'PRODUCT_ALREADY_ACTIVE'
            };
        }

        // Always create new record for each add/remove cycle to track history correctly
        // This allows logging accurate add/remove times for each cycle
        const liveProduct = new LiveProduct({
            liveId,
            productId,
            addedAt: new Date(),
            isActive: true,
            addBy: userId // Track who added the product
        });

        await liveProduct.save();

        // Update livestream's liveProductIds array
        await Livestream.findByIdAndUpdate(
            liveId,
            { $push: { liveProductIds: liveProduct._id } }
        );

        // Populate product data with minimal fields for websocket (only essential for display)
        await liveProduct.populate('addBy', 'name username role');
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

exports.removeProductFromLive = async (liveId, productId, userId = null) => {
    try {
        // Find the ACTIVE product (must be isActive: true)
        // This ensures we remove the correct record even if there are multiple records (from previous add/remove cycles)
        const liveProduct = await LiveProduct.findOneAndUpdate(
            {
                liveId,
                productId,
                isActive: true // CRITICAL: Only find active product
            },
            {
                isActive: false,
                removedAt: new Date(),
                removeBy: userId // Track who removed the product
            },
            { new: true }
        );

        // If no active product found, return error
        if (!liveProduct) {
            // Check if product was ever added (to provide better error message)
            const anyProduct = await LiveProduct.findOne({
                liveId,
                productId
            });

            if (!anyProduct) {
                return {
                    success: false,
                    message: 'Product not found in this livestream',
                    error: 'PRODUCT_NOT_FOUND'
                };
            } else {
                // Product exists but not active (already removed)
                await anyProduct.populate('removeBy', 'name username role');
                await anyProduct.populate({
                    path: 'productId',
                    select: 'productName description categoryId'
                });
                await anyProduct.populate({
                    path: 'productId.categoryId',
                    select: 'cat_name'
                });

                return {
                    success: true,
                    message: 'Product is already removed from livestream',
                    data: anyProduct
                };
            }
        }

        // Populate removeBy for response
        await liveProduct.populate('removeBy', 'name username role');

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
            message: 'Product removed from livestream successfully!',
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
            .populate('addBy', 'name username role')
            .populate('removeBy', 'name username role')
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
            .populate('addBy', 'name username role')
            .populate('removeBy', 'name username role')
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
            { isPinned: false, removeBy: userId }
        );

        // Unpin tất cả comments trong livestream (vì chỉ có thể pin comment HOẶC product, không thể cả 2)
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
            { isPinned: false, removeBy: userId }
        );

        // Emit events cho các products/comments bị unpin (để frontend cập nhật UI)
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
        liveProduct.addBy = userId;
        liveProduct.removeBy = null;
        await liveProduct.save();

        // Populate product data
        await liveProduct.populate('addBy', 'name username role');
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
                _id: liveProduct.addBy._id,
                name: liveProduct.addBy.name,
                username: liveProduct.addBy.username
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

        // Unpin the product (keep addBy for statistics)
        liveProduct.isPinned = false;
        liveProduct.removeBy = userId;
        // Keep addBy to track who originally pinned it
        await liveProduct.save();

        // Populate product data
        await liveProduct.populate('removeBy', 'name username role');
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
