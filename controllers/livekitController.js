// const livekitService = require('../services/livekitService');

// // Start livestream (Admin)
// exports.startLivestream = async (req, res) => {
//     try {
//         const { title, description } = req.body;
//         const hostId = req.user.id;

//         if (!title) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Title is required'
//             });
//         }

//         const result = await livekitService.startLivestream(hostId, title, description);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in startLivestream controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // End livestream (Admin or Owner)
// exports.endLivestream = async (req, res) => {
//     try {
//         const { livestreamId } = req.body;
//         const userId = req.user.id;
//         const userRole = req.user.role;

//         if (!livestreamId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Livestream ID is required'
//             });
//         }

//         const result = await livekitService.endLivestream(livestreamId, userId, userRole);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             // Return 403 for permission errors, 400 for other errors
//             const statusCode = result.error === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
//             res.status(statusCode).json(result);
//         }

//     } catch (error) {
//         console.error('Error in endLivestream controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // View livestream (User) - renamed from joinLivestream
// exports.joinLivestream = async (req, res) => {
//     try {
//         const { livestreamId } = req.body;
//         const userId = req.user.id;
//         const userName = req.user.username;

//         if (!livestreamId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Livestream ID is required'
//             });
//         }

//         const result = await livekitService.joinLivestream(livestreamId, userId, userName);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in joinLivestream controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Get live streams (User)
// exports.getLiveStreams = async (req, res) => {
//     try {
//         const result = await livekitService.getLiveStreams();

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in getLiveStreams controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Get host livestreams (Admin)
// exports.getHostLivestreams = async (req, res) => {
//     try {
//         const hostId = req.user.id;
//         const result = await livekitService.getHostLivestreams(hostId);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in getHostLivestreams controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Get host token for a livestream (Admin)
// exports.getHostToken = async (req, res) => {
//     try {
//         const { roomName } = req.body;
//         const hostId = req.user.id;

//         if (!roomName) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Room name is required'
//             });
//         }

//         const result = await livekitService.getHostToken(roomName, hostId);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in getHostToken controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Get all livestreams (User/Admin)
// exports.getAllLive = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;

//         const result = await livekitService.getAllLive(page, limit);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in getAllLive controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Get specific livestream details (User/Admin)
// exports.getLive = async (req, res) => {
//     try {
//         const { livestreamId } = req.params;

//         if (!livestreamId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Livestream ID is required'
//             });
//         }

//         const result = await livekitService.getLive(livestreamId);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(404).json(result);
//         }

//     } catch (error) {
//         console.error('Error in getLive controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Leave livestream (User)
// exports.leaveLivestream = async (req, res) => {
//     try {
//         const { livestreamId } = req.body;
//         const userId = req.user.id;

//         if (!livestreamId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Livestream ID is required'
//             });
//         }

//         const result = await livekitService.leaveLivestream(livestreamId, userId);

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }

//     } catch (error) {
//         console.error('Error in leaveLivestream controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };

// // Get currently live streams (User/Admin)
// exports.getLiveNow = async (req, res) => {
//     try {
//         const result = await livekitService.getLiveNow();

//         if (result.success) {
//             res.status(200).json(result);
//         } else {
//             res.status(400).json(result);
//         }
//     } catch (error) {
//         console.error('Error in getLiveNow controller:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     }
// };
