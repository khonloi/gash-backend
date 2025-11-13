// chat.js
const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('⚡ Client connected:', socket.id);

    // Join a specific conversation room
    // Join a specific conversation room
    socket.on('join_room', (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId.toString());
      console.log(`📥 ${socket.id} joined room ${conversationId}`);
    });

    // Leave a specific conversation room
    socket.on('leave_room', (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId.toString());
      console.log(`📤 ${socket.id} left room ${conversationId}`);
    });

    // User starts or resumes a chat
    socket.on('start_chat', async ({ userId, messageText }) => {
      try {
        if (!userId) {
          return socket.emit('error', 'userId is required');
        }
        if (!userId) {
          return socket.emit('error', 'userId is required');
        }

        // Find existing open or pending conversation
        // Find existing open or pending conversation
        let conversation = await Conversations.findOne({
          accountId: userId,
          status: { $in: ['open', 'pending'] },
          status: { $in: ['open', 'pending'] },
        });

        let isNew = false;
        let isNew = false;
        if (!conversation) {
          // Create new if none exists
          // Create new if none exists
          conversation = await Conversations.create({
            accountId: userId,
            status: 'open',
            status: 'open',
          });
          isNew = true;
        } else {
          // Update timestamp for existing
          conversation.updatedAt = new Date();
          await conversation.save();
          isNew = true;
        } else {
          // Update timestamp for existing
          conversation.updatedAt = new Date();
          await conversation.save();
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        // Fetch message history
        const messages = await Messages.find({ conversationId: convoId }).sort({ createdAt: 1 });

        // Send history to the user
        // Fetch message history
        const messages = await Messages.find({ conversationId: convoId }).sort({ createdAt: 1 });

        // Send history to the user
        socket.emit('chat_history', {
          conversation: { ...conversation.toObject(), id: convoId },
          messages: messages.map(msg => ({ ...msg.toObject(), id: msg._id.toString() })),
          messages: messages.map(msg => ({ ...msg.toObject(), id: msg._id.toString() })),
        });

        // If initial message provided, send it
        // If initial message provided, send it
        if (messageText && messageText.trim() !== '') {
          const newMessage = await Messages.create({
          const newMessage = await Messages.create({
            conversationId: convoId,
            senderId: userId,
            messageText,
            type: 'text',
          });
          io.to(convoId).emit('new_message', {
            ...newMessage.toObject(),
            id: newMessage._id.toString(),
            ...newMessage.toObject(),
            id: newMessage._id.toString(),
            conversationId: convoId,
          });
        }

        // Notify admins if new conversation
        if (isNew) {
        // Notify admins if new conversation
        if (isNew) {
          io.emit('conversation_created', {
            ...conversation.toObject(),
            id: convoId,
          });
        }

        console.log(`✅ start_chat for user ${userId}, convo ${convoId} (new: ${isNew})`);
        console.log(`✅ start_chat for user ${userId}, convo ${convoId} (new: ${isNew})`);
      } catch (err) {
        console.error('❌ start_chat error:', err);
        socket.emit('error', 'Failed to start chat');
        socket.emit('error', 'Failed to start chat');
      }
    });

    // Staff takes a conversation
    // Staff takes a conversation
    socket.on('take_conversation', async ({ staffId, conversationId }) => {
      try {
        if (!staffId || !conversationId) {
          return socket.emit('error', 'staffId and conversationId required');
        }

        const conversation = await Conversations.findOneAndUpdate(
          { _id: conversationId, status: 'open' },
          { staffId, status: 'pending' },
        if (!staffId || !conversationId) {
          return socket.emit('error', 'staffId and conversationId required');
        }

        const conversation = await Conversations.findOneAndUpdate(
          { _id: conversationId, status: 'open' },
          { staffId, status: 'pending' },
          { new: true }
        );

        if (!conversation) {
          return socket.emit('error', 'Conversation not available to take');
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        io.to(convoId).emit('conversation_taken', {
          ...conversation.toObject(),
          id: convoId,
        if (!conversation) {
          return socket.emit('error', 'Conversation not available to take');
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        io.to(convoId).emit('conversation_taken', {
          ...conversation.toObject(),
          id: convoId,
        });

        console.log(`✅ Conversation ${convoId} taken by staff ${staffId}`);

        console.log(`✅ Conversation ${convoId} taken by staff ${staffId}`);
      } catch (err) {
        console.error('❌ take_conversation error:', err);
        socket.emit('error', 'Failed to take conversation');
      }
    });

    // Send a message (text, image, sticker, emoji)
    socket.on('send_message', async ({ conversationId, senderId, messageText, attachments, type, imageUrl }) => {
      try {
        if (!conversationId || !senderId) {
          return socket.emit('error', 'conversationId and senderId required');
        }

        const messageData = {
          conversationId,
          senderId,
          type: type || 'text',
          isRead: false,
        };

        if (type === 'text') {
          messageData.messageText = messageText || '';
        } else if (type === 'image') {
          messageData.attachments = attachments || null;
        } else if (['sticker', 'emoji'].includes(type)) {
          messageData.imageUrl = imageUrl || null;
        }

        const newMessage = await Messages.create(messageData);
        socket.emit('error', 'Failed to take conversation');
      }
    });

    // Send a message (text, image, sticker, emoji)
    socket.on('send_message', async ({ conversationId, senderId, messageText, attachments, type, imageUrl }) => {
      try {
        if (!conversationId || !senderId) {
          return socket.emit('error', 'conversationId and senderId required');
        }

        const messageData = {
          conversationId,
          senderId,
          type: type || 'text',
          isRead: false,
        };

        if (type === 'text') {
          messageData.messageText = messageText || '';
        } else if (type === 'image') {
          messageData.attachments = attachments || null;
        } else if (['sticker', 'emoji'].includes(type)) {
          messageData.imageUrl = imageUrl || null;
        }

        const newMessage = await Messages.create(messageData);

        io.to(conversationId.toString()).emit('new_message', {
          ...newMessage.toObject(),
          id: newMessage._id.toString(),
          conversationId: conversationId.toString(),
        });
        io.to(conversationId.toString()).emit('new_message', {
          ...newMessage.toObject(),
          id: newMessage._id.toString(),
          conversationId: conversationId.toString(),
        });

        // Update conversation timestamp
        await Conversations.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
        // Update conversation timestamp
        await Conversations.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

        console.log(`💬 Message sent [${type || 'text'}] to ${conversationId}`);
      } catch (err) {
        console.error('❌ send_message error:', err);
        socket.emit('error', 'Failed to send message');
        console.log(`💬 Message sent [${type || 'text'}] to ${conversationId}`);
      } catch (err) {
        console.error('❌ send_message error:', err);
        socket.emit('error', 'Failed to send message');
      }
    });
    });

    // Mark messages as read
    // Mark messages as read
    socket.on('mark_read', async ({ conversationId, readerId }) => {
      try {
        if (!conversationId || !readerId) {
          return socket.emit('error', 'conversationId and readerId required');
        }

        if (!conversationId || !readerId) {
          return socket.emit('error', 'conversationId and readerId required');
        }

        await Messages.updateMany(
          { conversationId, isRead: false },
          { isRead: true }
        );

        io.to(conversationId.toString()).emit('messages_read', {
          conversationId: conversationId.toString(),
          conversationId: conversationId.toString(),
          readerId,
        });

        console.log(`👁️ Messages marked read in ${conversationId} by ${readerId}`);

        console.log(`👁️ Messages marked read in ${conversationId} by ${readerId}`);
      } catch (err) {
        console.error('❌ mark_read error:', err);
        socket.emit('error', 'Failed to mark as read');
        socket.emit('error', 'Failed to mark as read');
      }
    });

    // Close a conversation
    // Close a conversation
    socket.on('close_conversation', async ({ conversationId }) => {
      try {
        if (!conversationId) {
          return socket.emit('error', 'conversationId required');
        }

        const conversation = await Conversations.findByIdAndUpdate(
          conversationId,
          { status: 'closed' },
          { new: true }
        );

        if (!conversation) {
          return socket.emit('error', 'Conversation not found');
        }

        if (!conversationId) {
          return socket.emit('error', 'conversationId required');
        }

        const conversation = await Conversations.findByIdAndUpdate(
          conversationId,
          { status: 'closed' },
          { new: true }
        );

        if (!conversation) {
          return socket.emit('error', 'Conversation not found');
        }

        io.to(conversationId.toString()).emit('conversation_closed', {
          conversationId: conversationId.toString(),
        });

        console.log(`🔴 Conversation ${conversationId} closed`);

        console.log(`🔴 Conversation ${conversationId} closed`);
      } catch (err) {
        console.error('❌ close_conversation error:', err);
        socket.emit('error', 'Failed to close conversation');
        socket.emit('error', 'Failed to close conversation');
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });
};