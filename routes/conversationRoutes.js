const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

// Get list of conversations (filtered by query)
router.get('/', conversationController.getList);

// Get conversation details + messages
router.get('/:id', conversationController.getDetail);

// Close conversation
router.put('/:id/close', conversationController.close);

// Create new conversation
router.post('/', conversationController.create);

// Staff assign/take conversation
router.put('/:id/take', conversationController.take);

module.exports = router;