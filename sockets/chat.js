// chat.js
const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('⚡ Client connected:', socket.id);

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

        // Find existing open or pending conversation
        let conversation = await Conversations.findOne({
          accountId: userId,
          status: { $in: ['open', 'pending'] },
        });

        let isNew = false;
        const hasMessage = messageText && messageText.trim() !== '';
        
        // Only create new conversation if user is actually sending a message
        if (!conversation && hasMessage) {
          // Create new if none exists AND user is sending a message
          conversation = await Conversations.create({
            accountId: userId,
            status: 'open',
          });
          isNew = true;
        } else if (conversation) {
          // Update timestamp for existing conversation
          conversation.updatedAt = new Date();
          await conversation.save();
        } else {
          // No conversation exists and no message - just return empty history
          socket.emit('chat_history', {
            conversation: null,
            messages: [],
          });
          return;
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        // Fetch message history
        const messages = await Messages.find({ conversationId: convoId }).sort({ createdAt: 1 });

        // Send history to the user
        socket.emit('chat_history', {
          conversation: { ...conversation.toObject(), id: convoId },
          messages: messages.map(msg => ({ ...msg.toObject(), id: msg._id.toString() })),
        });

        // If initial message provided, send it
        if (hasMessage) {
          const newMessage = await Messages.create({
            conversationId: convoId,
            senderId: userId,
            messageText,
            type: 'text',
          });
          
          // Update conversation with lastMessage
          const updatedConvo = await Conversations.findByIdAndUpdate(
            convoId,
            { 
              lastMessage: messageText,
              updatedAt: new Date() 
            },
            { new: true }
          ).populate('accountId', 'username email')
           .populate('staffId', 'username email');
          
          io.to(convoId).emit('new_message', {
            ...newMessage.toObject(),
            id: newMessage._id.toString(),
            conversationId: convoId,
          });
          
          // Emit conversation update to admins
          if (updatedConvo) {
            io.emit('conversation_updated', {
              ...updatedConvo.toObject(),
              id: convoId,
              lastMessage: messageText,
            });
          }
        }

        // Notify admins if new conversation (only if there's a message)
        if (isNew && hasMessage) {
          io.emit('conversation_created', {
            ...conversation.toObject(),
            id: convoId,
          });
        }

        console.log(`start_chat for user ${userId}, convo ${convoId} (new: ${isNew}, hasMessage: ${hasMessage})`);
      } catch (err) {
        console.error('start_chat error:', err);
        socket.emit('error', 'Failed to start chat');
      }
    });

    // Staff takes a conversation
    socket.on('take_conversation', async ({ staffId, conversationId }) => {
      try {
        if (!staffId || !conversationId) {
          return socket.emit('error', 'staffId and conversationId required');
        }

        const conversation = await Conversations.findOneAndUpdate(
          { _id: conversationId, status: 'open' },
          { staffId, status: 'pending' },
          { new: true }
        ).populate('accountId', 'username email')
         .populate('staffId', 'username email');

        if (!conversation) {
          return socket.emit('error', 'Conversation not available to take');
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        io.to(convoId).emit('conversation_taken', {
          ...conversation.toObject(),
          id: convoId,
        });

        console.log(`Conversation ${convoId} taken by staff ${staffId}`);
      } catch (err) {
        console.error('take_conversation error:', err);
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
          // Use imageUrl if provided (from frontend), otherwise use attachments
          messageData.imageUrl = imageUrl || attachments || null;
          messageData.attachments = imageUrl || attachments || null;
        } else if (['sticker', 'emoji'].includes(type)) {
          messageData.imageUrl = imageUrl || null;
        }

        const newMessage = await Messages.create(messageData);

        // Determine lastMessage text for conversation
        let lastMessageText = '';
        if (type === 'text') {
          lastMessageText = messageText || '';
        } else if (type === 'image') {
          lastMessageText = 'Image';
        } else if (type === 'sticker') {
          lastMessageText = 'Sticker';
        } else if (type === 'emoji') {
          lastMessageText = 'Emoji';
        } else {
          lastMessageText = 'Media';
        }

        // Update conversation with lastMessage and timestamp
        const updatedConversation = await Conversations.findByIdAndUpdate(
          conversationId,
          { 
            lastMessage: lastMessageText,
            updatedAt: new Date() 
          },
          { new: true }
        ).populate('accountId', 'username email')
         .populate('staffId', 'username email');

        // Emit new message to room
        io.to(conversationId.toString()).emit('new_message', {
          ...newMessage.toObject(),
          id: newMessage._id.toString(),
          conversationId: conversationId.toString(),
        });

        // Emit conversation update to admins (for sidebar update)
        if (updatedConversation) {
          io.emit('conversation_updated', {
            ...updatedConversation.toObject(),
            id: updatedConversation._id.toString(),
            lastMessage: lastMessageText,
          });
        }

        console.log(`💬 Message sent [${type || 'text'}] to ${conversationId}`);
      } catch (err) {
        console.error('send_message error:', err);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Mark messages as read
    socket.on('mark_read', async ({ conversationId, readerId }) => {
      try {
        if (!conversationId || !readerId) {
          return socket.emit('error', 'conversationId and readerId required');
        }

        await Messages.updateMany(
          { conversationId, isRead: false },
          { isRead: true }
        );

        io.to(conversationId.toString()).emit('messages_read', {
          conversationId: conversationId.toString(),
          readerId,
        });

        console.log(`👁️ Messages marked read in ${conversationId} by ${readerId}`);
      } catch (err) {
        console.error('mark_read error:', err);
        socket.emit('error', 'Failed to mark as read');
      }
    });

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

        io.to(conversationId.toString()).emit('conversation_closed', {
          conversationId: conversationId.toString(),
        });

        console.log(`🔴 Conversation ${conversationId} closed`);
      } catch (err) {
        console.error('close_conversation error:', err);
        socket.emit('error', 'Failed to close conversation');
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};
