const Messages = require('../models/Message');

exports.getMessages = async (req, res) => {
    try {
        const { cursor, limit = 50 } = req.query;
        const query = { conversationId: req.params.conversationId };
        
        // If cursor is provided, fetch messages older than the cursor
        if (cursor) {
            query._id = { $lt: cursor };
        }
        
        // Fetch the most recent messages up to the limit
        const messages = await Messages.find(query)
            .sort({ _id: -1 })
            .limit(parseInt(limit));
            
        // Reverse to return them in chronological order
        messages.reverse();
        
        res.json({ 
            success: true, 
            data: messages,
            nextCursor: messages.length > 0 ? messages[0]._id : null,
            hasMore: messages.length === parseInt(limit)
        });
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
