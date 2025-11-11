const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

// Lấy danh sách conversations (filter theo query)
router.get('/', conversationController.getList);

// Lấy chi tiết conversation + messages
router.get('/:id', conversationController.getDetail);

// Đóng conversation
router.put('/:id/close', conversationController.close);

// Tạo conversation mới
router.post('/', conversationController.create);

// Staff nhận conversation
router.put('/:id/take', conversationController.take);

module.exports = router;