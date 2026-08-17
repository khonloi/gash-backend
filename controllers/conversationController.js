// conversationController.js
const conversationService = require('../services/conversationService');
const catchAsync = require('./utils/catchAsync');
const AppError = require('../utils/AppError');

// Get conversation list
exports.getList = catchAsync(async (req, res) => {
  const formattedResult = await conversationService.getListService(req.query);
  res.status(200).json({ success: true, data: formattedResult });
});

// Get details + messages
exports.getDetail = catchAsync(async (req, res) => {
  const { staffId } = req.query;
  if (!staffId) {
    throw new AppError('staffId is required in query', 400);
  }

  try {
    const { conversation, messages } = await conversationService.getDetailService(req.params.id);
    res.status(200).json({ success: true, conversation, messages });
  } catch (err) {
    if (err.message === 'Conversation not found') throw new AppError(err.message, 404);
    throw err;
  }
});

// Close conversation
exports.close = catchAsync(async (req, res) => {
  const { staffId } = req.body;
  if (!staffId) {
    throw new AppError('staffId is required in body', 400);
  }

  try {
    const updatedConversation = await conversationService.closeService(req.params.id);
    res.status(200).json({ success: true, data: updatedConversation });
  } catch (err) {
    if (err.message === 'Conversation not found') throw new AppError(err.message, 404);
    throw err;
  }
});

// Create or retrieve existing conversation (prevents duplicates when user chats again)
exports.create = catchAsync(async (req, res) => {
  const { accountId, staffId } = req.body;
  if (!accountId) {
    throw new AppError('accountId is required', 400);
  }

  const conversation = await conversationService.createService(accountId, staffId);
  res.status(201).json({ success: true, data: conversation });
});

// Staff claim conversation
exports.take = catchAsync(async (req, res) => {
  const { staffId } = req.body;
  try {
    const convo = await conversationService.takeService(req.params.id, staffId);
    res.status(200).json({ success: true, data: convo });
  } catch (err) {
    if (err.message === 'Conversation already taken or closed') {
      throw new AppError(err.message, 400);
    }
    throw err;
  }
});