// conversationController.js
const conversationService = require('../services/conversationService');

// Get conversation list
exports.getList = async (req, res) => {
  try {
    const formattedResult = await conversationService.getListService(req.query);
    res.json({ success: true, data: formattedResult });
  } catch (err) {
    console.error('getList error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get details + messages
exports.getDetail = async (req, res) => {
  try {
    const { staffId } = req.query;
    if (!staffId) {
      return res.status(400).json({ success: false, message: 'staffId is required in query' });
    }

    const { conversation, messages } = await conversationService.getDetailService(req.params.id);
    res.json({ success: true, conversation, messages });
  } catch (err) {
    console.error('getDetail error:', err);
    if (err.message === 'Conversation not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// Close conversation
exports.close = async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ success: false, message: 'staffId is required in body' });
    }

    const updatedConversation = await conversationService.closeService(req.params.id);
    res.json({ success: true, data: updatedConversation });
  } catch (err) {
    console.error('close error:', err);
    if (err.message === 'Conversation not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create or retrieve existing conversation (prevents duplicates when user chats again)
exports.create = async (req, res) => {
  try {
    const { accountId, staffId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }

    const conversation = await conversationService.createService(accountId, staffId);
    res.status(201).json({ success: true, data: conversation });
  } catch (err) {
    console.error('create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Staff claim conversation
exports.take = async (req, res) => {
  try {
    const { staffId } = req.body;
    const convo = await conversationService.takeService(req.params.id, staffId);
    res.json({ success: true, data: convo });
  } catch (err) {
    console.error('take error:', err);
    if (err.message === 'Conversation already taken or closed') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};