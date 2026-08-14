const Messages = require('../models/Message');

exports.getMessagesService = async (conversationId, query) => {
    const { cursor, limit = 50 } = query;
    const dbQuery = { conversationId };
    
    // If cursor is provided, fetch messages older than the cursor
    if (cursor) {
        dbQuery._id = { $lt: cursor };
    }
    
    // Fetch the most recent messages up to the limit
    const messages = await Messages.find(dbQuery)
        .sort({ _id: -1 })
        .limit(parseInt(limit));
        
    // Reverse to return them in chronological order
    messages.reverse();
    
    return { 
        data: messages,
        nextCursor: messages.length > 0 ? messages[0]._id : null,
        hasMore: messages.length === parseInt(limit)
    };
};

exports.sendMessageService = async (conversationId, senderId, messageText) => {
    return await Messages.create({
        conversationId,
        senderId,
        messageText,
    });
};
