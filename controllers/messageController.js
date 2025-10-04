const Messages = require('../models/Message');

exports.getMessages = async (req, res) => {
    try {
        const messages = await Messages.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
        res.json({ success: true, data: messages });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { senderId, messageText } = req.body;
        const message = await Messages.create({
            conversationId: req.params.conversationId,
            senderId,
            messageText,
        });
        res.json({ success: true, data: message });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
