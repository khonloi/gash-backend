const messageService = require('../services/messageService');

exports.getMessages = async (req, res) => {
    try {
        const result = await messageService.getMessagesService(req.params.conversationId, req.query);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { senderId, messageText } = req.body;
        const message = await messageService.sendMessageService(req.params.conversationId, senderId, messageText);
        res.json({ success: true, data: message });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
