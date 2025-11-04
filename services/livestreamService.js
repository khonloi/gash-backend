const { generateAccessToken, createRoom, deleteRoom, roomService } = require('../config/livekit');
const Livestream = require('../models/Livestream');
const LiveProduct = require('../models/liveProduct');
const LiveComment = require('../models/liveComment');
const livestreamReactionService = require('./livestreamReactionService');

// Cache for viewer counts (to reduce API calls)
const viewerCache = new Map(); // roomName -> { count: number, timestamp: number }
const CACHE_TTL = 3000; // 3 seconds cache
const CACHE_CLEANUP_INTERVAL = 60000; // Cleanup cache every minute

// Cache for getLiveNow responses (heavier operation with DB queries)
const liveNowCache = new Map(); // 'liveNow' -> { data: object, timestamp: number }
const LIVE_NOW_CACHE_TTL = 4000; // 4 seconds cache (increased from 2s for better performance)

// Invalidate getLiveNow cache (call when products/comments/reactions change)
const invalidateLiveNowCache = () => {
    liveNowCache.delete('liveNow');
};

// Cleanup old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of viewerCache.entries()) {
        // Remove entries older than 1 minute
        if (now - value.timestamp > 60000) {
            viewerCache.delete(key);
        }
    }
    // Cleanup liveNow cache
    const liveNowCached = liveNowCache.get('liveNow');
    if (liveNowCached && (now - liveNowCached.timestamp > 60000)) {
        liveNowCache.delete('liveNow');
    }
}, CACHE_CLEANUP_INTERVAL);

// Get real-time viewer count from LiveKit (with caching to reduce API calls)
const getRealTimeViewers = async (roomName, useCache = true) => {
    // Check cache first (skip cache for critical operations like join/leave)
    if (useCache) {
        const cached = viewerCache.get(roomName);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            return cached.count;
        }
    }

    let timeoutId;
    try {
        // Use listParticipants to get current participants in the room
        // Increased timeout to 10 seconds for better reliability
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('LiveKit API timeout after 10s')), 10000);
        });

        const participants = await Promise.race([
            roomService.listParticipants(roomName).finally(() => {
                if (timeoutId) clearTimeout(timeoutId);
            }),
            timeoutPromise
        ]);

        if (!participants || participants.length === 0) {
            // Only cache if useCache is true (don't cache for real-time operations)
            if (useCache) {
                viewerCache.set(roomName, { count: 0, timestamp: Date.now() });
            }
            return 0;
        }

        // Exclude only host từ viewer count
        // Host: identity = "Host" (người đang stream)
        // Staff join qua /join (identity = userId) → tính viewer 
        // User join (identity = userId) → tính viewer 
        // Staff vào dashboard (chỉ gọi API, không join LiveKit) → không có participant → không tính viewer ✅
        const nonHostParticipants = participants.filter(p => {
            const identity = p.identity;
            return identity !== 'Host' && identity !== 'host';
        });

        // Count unique users by identity (userId) to avoid counting same user with multiple tabs
        const uniqueUserIds = new Set(nonHostParticipants.map(p => p.identity));
        const uniqueViewers = uniqueUserIds.size;

        // Log only in debug mode to avoid spam
        if (process.env.DEBUG_VIEWERS === 'true') {
            console.log(`Room ${roomName}: ${participants.length} participants, ${nonHostParticipants.length} viewer connections (excludes host only), ${uniqueViewers} unique viewers`);
        }

        // Only cache if useCache is true (don't cache for real-time operations like getViewNumber)
        // This ensures getViewNumber always gets fresh data without cache interference
        if (useCache) {
            viewerCache.set(roomName, { count: uniqueViewers, timestamp: Date.now() });
        }
        return uniqueViewers; // Return unique users instead of total connections
    } catch (error) {
        // Cleanup timeout if still pending
        if (timeoutId) clearTimeout(timeoutId);

        // Only log first timeout error to avoid spam
        const cacheKey = `error_${roomName}`;
        const errorCache = viewerCache.get(cacheKey);
        const shouldLog = process.env.DEBUG_VIEWERS === 'true' ||
            (!error.message.includes('timeout') &&
                (!errorCache || (Date.now() - errorCache.timestamp) > 10000)); // Log same error max once per 10s

        if (shouldLog) {
            console.error(`Error getting real-time viewers for room ${roomName}:`, error.message);
            viewerCache.set(cacheKey, { count: 0, timestamp: Date.now() });
        }

        // Return cached value if available, otherwise 0
        const cached = viewerCache.get(roomName);
        return cached ? cached.count : 0;
    }
};

// Update peak and min viewers
const updateViewerStats = async (livestreamId, currentViewers) => {
    try {
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) return;

        // Update peak viewers (always increase, never decrease)
        if (currentViewers > livestream.peakViewers) {
            livestream.peakViewers = currentViewers;
        }

        // Update min viewers (only if livestream is live, update even when count = 0)
        if (livestream.status === 'live') {
            if (livestream.minViewers === undefined || livestream.minViewers === null || livestream.minViewers === 0 || currentViewers < livestream.minViewers) {
                livestream.minViewers = currentViewers;
            }
        }

        await livestream.save();
    } catch (error) {
    }
};

// Start livestream (Admin)
// Chỉ cho phép 1 livestream duy nhất tại 1 thời điểm (toàn hệ thống)
exports.startLivestream = async (hostId, title, description) => {
    try {
        // Check: Chỉ cho phép 1 livestream duy nhất tại 1 thời điểm (toàn hệ thống)
        const activeLivestream = await Livestream.findOne({
            status: 'live'
        });
        if (activeLivestream) {
            return {
                success: false,
                message: 'There is already a livestream running. Please end the current livestream before starting a new one.',
                error: 'LIVESTREAM_ALREADY_RUNNING',
                data: {
                    activeLivestream: {
                        id: activeLivestream._id,
                        title: activeLivestream.title,
                        hostId: activeLivestream.hostId,
                        startTime: activeLivestream.startTime
                    }
                }
            };
        }

        // Check: One person can only start one livestream (redundant check, nhưng giữ lại để an toàn)
        const userActiveStream = await Livestream.findOne({
            hostId: hostId,
            status: 'live'
        });
        if (userActiveStream) {
            return {
                success: false,
                message: 'You already have an active livestream. Please end your current livestream before starting a new one.',
                error: 'USER_ALREADY_LIVE',
                data: {
                    userLivestream: {
                        id: userActiveStream._id,
                        title: userActiveStream.title,
                        startTime: userActiveStream.startTime
                    }
                }
            };
        }

        const shortHostId = hostId.toString().slice(-8); // Last 8 chars for uniqueness
        const base36Timestamp = Date.now().toString(36); // Base36 encoding for shorter timestamp
        const roomName = `livestream_${shortHostId}_${base36Timestamp}`;

        // Create LiveKit room
        const roomResult = await createRoom(roomName, {
            maxParticipants: 100,
            emptyTimeout: 300
        });

        if (!roomResult.success) {
            throw new Error(roomResult.message);
        }

        // Create livestream record in database
        const livestream = new Livestream({
            hostId: hostId,
            title: title,
            description: description,
            roomName: roomName,
            status: 'live',
            startTime: new Date(),
            peakViewers: 0,
            minViewers: 0
        });

        await livestream.save();

        // Invalidate cache (livestream mới đã start)
        invalidateLiveNowCache();

        // Generate host access token
        const hostToken = generateAccessToken(roomName, 'Host', 'Host', true);

        return {
            success: true,
            message: 'Livestream started successfully',
            data: {
                livestreamId: livestream._id,
                roomName: roomName,
                hostToken: hostToken,
                hostId: hostId,
                title: title,
                description: description,
                status: 'live',
                startTime: livestream.startTime
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to start livestream: ${error.message}`,
            error: error.message
        };
    }
};

// End livestream (Admin or Owner)
exports.endLivestream = async (livestreamId, userId, userRole) => {
    try {
        // Validate ObjectId format
        if (!livestreamId || !livestreamId.match(/^[0-9a-fA-F]{24}$/)) {
            return {
                success: false,
                message: 'Invalid livestream ID format'
            };
        }

        // Find livestream
        const livestream = await Livestream.findById(livestreamId);
        if (!livestream) {
            return {
                success: false,
                message: 'Livestream not found'
            };
        }

        if (livestream.status !== 'live') {
            return {
                success: false,
                message: 'Livestream is not currently live'
            };
        }

        // Check permissions: Only admin or the livestream host can end it
        const isAdmin = userRole === 'admin';
        const isHost = livestream.hostId.toString() === userId.toString();

        if (!isAdmin && !isHost) {
            return {
                success: false,
                message: 'You do not have permission to end this livestream. Only the livestream host or admin can end it.',
                error: 'INSUFFICIENT_PERMISSIONS'
            };
        }

        // Delete LiveKit room
        const deleteResult = await deleteRoom(livestream.roomName);
        if (!deleteResult.success) {
        }

        // Update livestream status
        livestream.status = 'ended';
        livestream.endTime = new Date();
        await livestream.save();

        // Invalidate cache (livestream đã end)
        invalidateLiveNowCache();

        return {
            success: true,
            message: 'Livestream ended successfully',
            data: {
                livestreamId: livestream._id,
                status: 'ended',
                endTime: livestream.endTime,
                duration: livestream.endTime - livestream.startTime,
                endedBy: {
                    userId: userId,
                    role: userRole,
                    isOwner: isHost,
                    isAdmin: isAdmin
                }
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to end livestream: ${error.message}`,
            error: error.message
        };
    }
};

// Join livestream (User hoặc Staff)
exports.joinLivestream = async (livestreamId, userId, userName, userRole = 'user') => {
    try {
        // Find livestream and populate host
        const livestream = await Livestream.findById(livestreamId)
            .populate('hostId', 'name email image role username')
            .lean();
        if (!livestream) {
            throw new Error('Livestream not found');
        }

        if (livestream.status !== 'live') {
            throw new Error('Livestream is not currently live');
        }

        // Tất cả người join qua /join (user hoặc staff) đều tính là viewer
        // Staff vào dashboard để quản lý (chỉ gọi API) thì không tính viewer vì không join vào LiveKit room
        const participantIdentity = userId;

        // Generate viewer access token
        const viewerToken = generateAccessToken(livestream.roomName, userName, participantIdentity, false);

        // CRITICAL: Invalidate cache when user joins to ensure getViewNumber gets fresh data
        // This ensures viewer count updates immediately when someone joins
        viewerCache.delete(livestream.roomName);

        // Note: Use getViewNumber API to get accurate viewer count (current, peak, min)
        // No viewer count logic here to optimize performance

        return {
            success: true,
            message: 'Joined livestream successfully',
            data: {
                livestreamId: livestream._id,
                roomName: livestream.roomName,
                viewerToken: viewerToken,
                userId: userId,
                userName: userName,
                title: livestream.title,
                description: livestream.description,
                hostId: livestream.hostId,
                status: livestream.status,
                startTime: livestream.startTime,
                endTime: livestream.endTime,
                joinedAt: new Date()
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to join livestream: ${error.message}`,
            error: error.message
        };
    }
};

// Check if user is still in LiveKit room
const isUserInRoom = async (roomName, userId) => {
    try {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('LiveKit API timeout after 5s')), 5000);
        });

        const participants = await Promise.race([
            roomService.listParticipants(roomName).finally(() => {
                if (timeoutId) clearTimeout(timeoutId);
            }),
            timeoutPromise
        ]);

        if (!participants || participants.length === 0) {
            return false;
        }

        // Check if userId exists in participants (identity = userId)
        const userExists = participants.some(p => p.identity === userId.toString());
        return userExists;

    } catch (error) {
        // On error, assume user is not in room (safe assumption)
        if (process.env.DEBUG === 'true') {
            console.error(`Error checking if user is in room: ${error.message}`);
        }
        return false;
    }
};

// Leave livestream (User)
// Optimized: Verifies user actually left LiveKit room before returning success
exports.leaveLivestream = async (livestreamId, userId) => {
    try {
        // Find livestream
        const livestream = await Livestream.findById(livestreamId)
            .select('_id roomName status')
            .lean();
        
        if (!livestream) {
            return {
                success: false,
                message: 'Livestream not found'
            };
        }

        if (livestream.status !== 'live') {
            return {
                success: false,
                message: 'Livestream is not currently live'
            };
        }

        // Verify user has actually left LiveKit room
        // This ensures user disconnected from LiveKit before API returns success
        const userStillInRoom = await isUserInRoom(livestream.roomName, userId);
        
        if (userStillInRoom) {
            // User is still in room - they haven't actually left yet
            return {
                success: false,
                message: 'User is still in livestream room. Please disconnect from LiveKit first.',
                error: 'USER_STILL_IN_ROOM',
                data: {
                    livestreamId: livestream._id,
                    userId: userId,
                    actuallyLeft: false
                }
            };
        }

        // User has actually left the room
        // CRITICAL: Invalidate cache when user leaves to ensure getViewNumber gets fresh data
        // This ensures viewer count updates immediately when someone leaves
        viewerCache.delete(livestream.roomName);

        // Note: Use getViewNumber API to get accurate viewer count (current, peak, min)
        // No viewer count logic here to optimize performance

        return {
            success: true,
            message: 'Left livestream successfully',
            data: {
                livestreamId: livestream._id,
                userId: userId,
                actuallyLeft: true,
                leftAt: new Date()
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to leave livestream: ${error.message}`,
            error: error.message
        };
    }
};


// Get live stream (chỉ có 1 livestream tại 1 thời điểm)
exports.getLiveStreams = async () => {
    try {
        // Dùng findOne vì chỉ có thể có 0 hoặc 1 livestream đang live
        const livestream = await Livestream.findOne({ status: 'live' })
            .select('_id hostId title description roomName startTime peakViewers minViewers')
            .populate('hostId', 'name email image role') // Populate host for consistency
            .sort({ startTime: -1 })
            .lean(); // Use lean() for better performance on read-only queries

        // Không có livestream đang live
        if (!livestream) {
            return {
                success: true,
                message: 'No livestream is currently live',
                data: {
                    livestream: null,
                    currentViewers: 0
                }
            };
        }

        // Get real-time viewer count
        const currentViewers = await getRealTimeViewers(livestream.roomName);

        // Update peak and min viewers
        await updateViewerStats(livestream._id, currentViewers);

        return {
            success: true,
            message: 'Live stream retrieved successfully',
            data: {
                livestream: {
                    ...livestream, // Already lean object, no need for .toObject()
                    currentViewers: currentViewers // Real-time count
                }
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to get live stream: ${error.message}`,
            error: error.message
        };
    }
};


// Get host livestream (only live) - Vì chỉ có 1 livestream duy nhất tại 1 thời điểm (toàn hệ thống)
// Chỉ trả về livestream metadata + real-time viewer count (tối ưu performance)
// Products/Comments/Reactions sẽ load qua API riêng để lazy loading và better caching
// Real-time updates sẽ qua WebSocket cho comments/products/reactions mới
exports.getHostLivestreams = async (hostId) => {
    try {
        // Dùng findOne vì chỉ có thể có 0 hoặc 1 livestream đang live
        const livestream = await Livestream.findOne({
            hostId: hostId,
            status: 'live'
        })
            .select('_id title description roomName status startTime endTime peakViewers minViewers')
            .populate('hostId', 'name email image role username') // Populate host info
            .sort({ startTime: -1 })
            .lean();

        // Nếu không có livestream đang live
        if (!livestream) {
            return {
                success: true,
                message: 'No active livestream found',
                data: {
                    livestream: null,
                    currentViewers: 0
                }
            };
        }

        // Get real-time viewer count only
        const currentViewers = await getRealTimeViewers(livestream.roomName);

        // Calculate peak and min viewers in real-time (same logic as getViewNumber)
        let peakViewers = livestream.peakViewers || 0;
        let minViewers = livestream.minViewers || 0;
        let needsUpdate = false;

        // Update peak viewers (always increase, never decrease)
        if (currentViewers > peakViewers) {
            peakViewers = currentViewers;
            needsUpdate = true;
        }

        // Update min viewers (only if livestream is live, update even when count = 0)
        if (minViewers === undefined || minViewers === null || minViewers === 0 || currentViewers < minViewers) {
            minViewers = currentViewers;
            needsUpdate = true;
        }

        // Update database if needed (non-blocking, don't wait for save)
        if (needsUpdate) {
            const livestreamDoc = await Livestream.findById(livestream._id);
            if (livestreamDoc) {
                if (currentViewers > (livestreamDoc.peakViewers || 0)) {
                    livestreamDoc.peakViewers = currentViewers;
                }
                // Update min viewers (update even when count = 0)
                if ((livestreamDoc.minViewers || 0) === 0 || currentViewers < livestreamDoc.minViewers) {
                    livestreamDoc.minViewers = currentViewers;
                }
                livestreamDoc.save().catch(err => {
                    // Silently handle save errors
                    if (process.env.DEBUG_VIEWERS === 'true') {
                        console.error('Error updating viewer stats:', err.message);
                    }
                });
            }
        }

        return {
            success: true,
            message: 'Host livestream retrieved successfully',
            data: {
                livestream: {
                    ...livestream,
                    currentViewers: currentViewers, // Real-time current viewer count
                    peakViewers: peakViewers, // Peak viewers (highest ever, calculated real-time)
                    minViewers: minViewers, // Min viewers (lowest when live, calculated real-time)
                    host: livestream.hostId // Host info (already populated)
                }
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to get host livestream: ${error.message}`,
            error: error.message
        };
    }
};

// Get host token for a livestream
exports.getHostToken = async (roomName, hostId) => {
    try {
        const token = generateAccessToken(roomName, 'Host', 'Host', true);

        return {
            success: true,
            message: 'Host token generated successfully',
            data: {
                token: token
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to generate host token: ${error.message}`,
            error: error.message
        };
    }
};

// Get all livestreams (no pagination)
exports.getAllLive = async () => {
    try {
        // Get all livestreams (both live and ended) - no real-time processing
        const livestreams = await Livestream.find()
            .select('_id hostId title description roomName status startTime endTime peakViewers minViewers')
            .populate('hostId', 'name email image role')
            .sort({ status: -1, startTime: -1 }) // Sort by status first (live=1, ended=0), then by time
            .lean(); // Use lean() for better performance on read-only queries

        // Add currentViewers = 0 for all streams (no real-time)
        const livestreamsWithData = livestreams.map(livestream => ({
            ...livestream, // Already lean object, no need for .toObject()
            currentViewers: 0 // No real-time data
        }));

        const result = {
            success: true,
            message: 'All livestreams retrieved successfully',
            data: {
                livestreams: livestreamsWithData,
                count: livestreamsWithData.length
            }
        };

        return result;

    } catch (error) {
        return {
            success: false,
            message: `Failed to get all livestreams: ${error.message}`,
            error: error.message
        };
    }
};

// Get specific livestream details (Admin only - có đầy đủ comments, products, stats)
exports.getLiveById = async (livestreamId, userRole = null) => {
    try {
        // Kiểm tra định dạng ObjectId hợp lệ
        if (!livestreamId || !livestreamId.match(/^[0-9a-fA-F]{24}$/)) {
            return {
                success: false,
                message: 'Invalid livestream ID format'
            };
        }

        // Tìm livestream theo ID và populate host (đầy đủ thông tin)
        const livestream = await Livestream.findById(livestreamId)
            .select('_id hostId title description image roomName status startTime endTime peakViewers minViewers createdAt updatedAt')
            .populate('hostId', 'name email image role username')
            .lean();

        // Không tìm thấy livestream
        if (!livestream) {
            return {
                success: false,
                message: 'Livestream not found'
            };
        }

        // Lấy TẤT CẢ data song song để tối ưu performance (Promise.all)
        const [liveProducts, liveComments, reactionData, currentViewers] = await Promise.all([
            // 1. Tất cả LiveProducts (kể cả bị remove - isActive: false) với full product data
            LiveProduct.find({
                liveId: livestreamId
                // Không filter isActive - lấy cả products đã bị remove
            })
                .sort({ isPinned: -1, addedAt: -1 })
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
                            limit: 5
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
                .lean(),

            // 2. Tất cả Comments (admin xem hết, including deleted)
            LiveComment.find({ liveId: livestreamId })
                .populate('senderId', 'name username image role')
                .populate('deletedBy', 'name username role')
                .populate('pinBy', 'name username role')
                .populate('unpinBy', 'name username role')
                .sort({ isPinned: -1, createdAt: -1 })
                .lean(),

            // 3. Reaction counts (aggregate)
            livestreamReactionService.getLiveReactions(livestreamId),

            // 4. Real-time viewer count (chỉ nếu đang live)
            livestream.status === 'live'
                ? getRealTimeViewers(livestream.roomName)
                : Promise.resolve(0)
        ]);

        // Update viewer stats nếu đang live
        if (livestream.status === 'live' && currentViewers > 0) {
            await updateViewerStats(livestream._id, currentViewers);
        }

        // Tính duration nếu livestream đã ended
        let duration = null;
        if (livestream.status === 'ended' && livestream.endTime && livestream.startTime) {
            duration = new Date(livestream.endTime) - new Date(livestream.startTime);
        }

        // Trả về TẤT CẢ data của livestream
        return {
            success: true,
            message: 'Livestream details retrieved successfully',
            data: {
                livestream: {
                    ...livestream,
                    currentViewers: currentViewers, // Real-time for live, 0 for ended
                    duration: duration // Duration in milliseconds (null if still live)
                },
                products: liveProducts, // Tất cả products với full data
                comments: liveComments, // Tất cả comments (admin see all including deleted)
                reactions: reactionData.success ? reactionData.data.reactions : {
                    like: 0,
                    love: 0,
                    haha: 0,
                    wow: 0,
                    sad: 0,
                    angry: 0,
                    total: 0
                }
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Failed to get livestream details: ${error.message}`,
            error: error.message
        };
    }
};


// Get currently live stream only (for users) - Vì chỉ có 1 livestream tại 1 thời điểm
// Chỉ trả về livestream metadata + real-time viewer count (tối ưu performance)
// Products/Comments/Reactions sẽ load qua API riêng để lazy loading và better caching
// Real-time updates sẽ qua WebSocket cho comments/products/reactions mới
exports.getLiveNow = async () => {
    try {
        // Check cache first (reduce DB load from polling)
        const cached = liveNowCache.get('liveNow');
        if (cached && (Date.now() - cached.timestamp) < LIVE_NOW_CACHE_TTL) {
            return cached.data;
        }

        // Dùng findOne vì chỉ có thể có 0 hoặc 1 livestream đang live (toàn hệ thống)
        const livestream = await Livestream.findOne({ status: 'live' })
            .select('_id hostId title description image roomName status startTime endTime peakViewers minViewers')
            .populate('hostId', 'name email image role username')
            .sort({ startTime: -1 })
            .lean();

        // Không có livestream nào đang live
        if (!livestream) {
            const result = {
                success: true,
                message: 'No livestream is currently live',
                data: {
                    livestream: null,
                    currentViewers: 0
                }
            };
            // Cache empty result
            liveNowCache.set('liveNow', { data: result, timestamp: Date.now() });
            return result;
        }

        // Get real-time viewer count only
        const currentViewers = await getRealTimeViewers(livestream.roomName);

        // Update peak/min viewers trong DB (không block nếu lỗi)
        try {
            await updateViewerStats(livestream._id, currentViewers);
        } catch (updateError) {
            // Silently handle update error
        }

        // Trả kết quả
        const result = {
            success: true,
            message: 'Currently live stream retrieved successfully',
            data: {
                livestream: {
                    ...livestream,
                    currentViewers: currentViewers
                }
            }
        };

        // Cache the result
        liveNowCache.set('liveNow', { data: result, timestamp: Date.now() });
        return result;

    } catch (error) {
        return {
            success: false,
            message: `Failed to get live streams: ${error.message}`,
            error: error.message
        };
    }
};

// Get view number (real-time, excludes host) - Returns current, peak, and min viewers



