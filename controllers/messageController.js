const messageService = require('../services/messageService');
const catchAsync = require('./utils/catchAsync');

exports.getMessages = catchAsync(async (req, res) => {
    const result = await messageService.getMessagesService(req.params.conversationId, req.query);
    res.status(200).json({ success: true, ...result });
});

exports.sendMessage = catchAsync(async (req, res) => {
    const { senderId, messageText } = req.body;
    const message = await messageService.sendMessageService(req.params.conversationId, senderId, messageText);
    res.status(201).json({ success: true, data: message });
});
