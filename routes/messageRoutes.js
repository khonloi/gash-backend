const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Lấy messages của 1 conversation
router.get('/:conversationId/messages', messageController.getMessages);

// Gửi message
router.post('/:conversationId/messages', messageController.sendMessage);

module.exports = router;
