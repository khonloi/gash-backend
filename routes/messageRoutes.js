const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Get messages of a conversation
router.get('/:conversationId/messages', messageController.getMessages);

// Send message
router.post('/:conversationId/messages', messageController.sendMessage);

module.exports = router;
