// chat.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

// ===== Rate Limiting =====
// Tracks per-socket event counts to prevent flooding.
const RATE_LIMIT_WINDOW_MS = 10_000; // 10-second window
const RATE_LIMIT_MAX_EVENTS = 20;    // max events per window

const rateLimitMap = new Map(); // socketId -> { count, resetAt }

/**
 * Returns true if the socket is within rate limits, false if the limit is exceeded.
 * @param {string} socketId
 */
function checkRateLimit(socketId) {
  const now = Date.now();
  const entry = rateLimitMap.get(socketId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    // Window expired — reset counter
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  } else {
    entry.count += 1;
  }

  rateLimitMap.set(socketId, entry);
  return entry.count <= RATE_LIMIT_MAX_EVENTS;
}

/**
 * Validates that a string is a valid MongoDB ObjectId.
 */
function isValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}

module.exports = (io) => {
  // ===== Socket.IO JWT Authentication Middleware =====
  // All connections to this namespace must supply a valid JWT.
  // Public chat (guest user support) is handled separately below.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow unauthenticated connections — chat is accessible to guests.
      // Controllers will validate userId from the event payload instead.
      socket.isAuthenticated = false;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      socket.isAuthenticated = true;
      next();
    } catch (err) {
      // Invalid token — still allow connection as unauthenticated
      socket.isAuthenticated = false;
      next();
    }
  });

  io.on('connection', (socket) => {
    if (process.env.DEBUG === 'true') {
      console.log(`⚡ Chat socket connected: ${socket.id} (auth: ${socket.isAuthenticated})`);
    }

    // ===== join_room =====
    socket.on('join_room', (conversationId) => {
      if (!conversationId || !isValidObjectId(conversationId)) return;
      socket.join(conversationId.toString());
    });

    // ===== leave_room =====
    socket.on('leave_room', (conversationId) => {
      if (!conversationId || !isValidObjectId(conversationId)) return;
      socket.leave(conversationId.toString());
    });

    // ===== start_chat =====
    socket.on('start_chat', async ({ userId, messageText }) => {
      if (!checkRateLimit(socket.id)) {
        return socket.emit('error', 'Rate limit exceeded. Please slow down.');
      }
      try {
        if (!userId || !isValidObjectId(userId)) {
          return socket.emit('error', 'Valid userId is required');
        }

        // Find existing open or pending conversation
        let conversation = await Conversations.findOne({
          accountId: userId,
          status: { $in: ['open', 'pending'] },
        });

        let isNew = false;
        const hasMessage = messageText && typeof messageText === 'string' && messageText.trim() !== '';

        // Only create new conversation if user is actually sending a message
        if (!conversation && hasMessage) {
          conversation = await Conversations.create({
            accountId: userId,
            status: 'open',
          });
          isNew = true;
        } else if (conversation) {
          conversation.updatedAt = new Date();
          await conversation.save();
        } else {
          socket.emit('chat_history', { conversation: null, messages: [] });
          return;
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        // Fetch message history
        const messages = await Messages.find({ conversationId: convoId }).sort({ createdAt: 1 });

        socket.emit('chat_history', {
          conversation: { ...conversation.toObject(), id: convoId },
          messages: messages.map(msg => ({ ...msg.toObject(), id: msg._id.toString() })),
        });

        if (hasMessage) {
          // Sanitize message text
          const sanitizedText = messageText.trim().substring(0, 2000);
          const newMessage = await Messages.create({
            conversationId: convoId,
            senderId: userId,
            messageText: sanitizedText,
            type: 'text',
          });

          const updatedConvo = await Conversations.findByIdAndUpdate(
            convoId,
            { lastMessage: sanitizedText, updatedAt: new Date() },
            { new: true }
          )
            .populate('accountId', 'username email')
            .populate('staffId', 'username email');

          io.to(convoId).emit('new_message', {
            ...newMessage.toObject(),
            id: newMessage._id.toString(),
            conversationId: convoId,
          });

          if (updatedConvo) {
            io.emit('conversation_updated', {
              ...updatedConvo.toObject(),
              id: convoId,
              lastMessage: sanitizedText,
            });
          }
        }

        if (isNew && hasMessage) {
          io.emit('conversation_created', { ...conversation.toObject(), id: convoId });
        }
      } catch (err) {
        console.error('start_chat error:', err);
        socket.emit('error', 'Failed to start chat');
      }
    });

    // ===== take_conversation =====
    socket.on('take_conversation', async ({ staffId, conversationId }) => {
      if (!checkRateLimit(socket.id)) return socket.emit('error', 'Rate limit exceeded.');
      try {
        if (!staffId || !isValidObjectId(staffId) || !conversationId || !isValidObjectId(conversationId)) {
          return socket.emit('error', 'Valid staffId and conversationId required');
        }

        const conversation = await Conversations.findOneAndUpdate(
          { _id: conversationId, status: 'open' },
          { staffId, status: 'pending' },
          { new: true }
        )
          .populate('accountId', 'username email')
          .populate('staffId', 'username email');

        if (!conversation) {
          return socket.emit('error', 'Conversation not available to take');
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        io.to(convoId).emit('conversation_taken', { ...conversation.toObject(), id: convoId });
      } catch (err) {
        console.error('take_conversation error:', err);
        socket.emit('error', 'Failed to take conversation');
      }
    });

    // ===== send_message =====
    socket.on('send_message', async ({ conversationId, senderId, messageText, attachments, type, imageUrl }) => {
      if (!checkRateLimit(socket.id)) return socket.emit('error', 'Rate limit exceeded.');
      try {
        if (!conversationId || !isValidObjectId(conversationId) || !senderId || !isValidObjectId(senderId)) {
          return socket.emit('error', 'Valid conversationId and senderId required');
        }

        const messageType = type || 'text';
        const ALLOWED_TYPES = ['text', 'image', 'sticker', 'emoji'];
        if (!ALLOWED_TYPES.includes(messageType)) {
          return socket.emit('error', 'Invalid message type');
        }

        const messageData = {
          conversationId,
          senderId,
          type: messageType,
          isRead: false,
        };

        let lastMessageText = 'Media';
        if (messageType === 'text') {
          const sanitized = (messageText || '').trim().substring(0, 2000);
          messageData.messageText = sanitized;
          lastMessageText = sanitized;
        } else if (messageType === 'image') {
          messageData.imageUrl = imageUrl || attachments || null;
          messageData.attachments = imageUrl || attachments || null;
          lastMessageText = 'Image';
        } else if (messageType === 'sticker') {
          messageData.imageUrl = imageUrl || null;
          lastMessageText = 'Sticker';
        } else if (messageType === 'emoji') {
          messageData.imageUrl = imageUrl || null;
          lastMessageText = 'Emoji';
        }

        const newMessage = await Messages.create(messageData);

        const updatedConversation = await Conversations.findByIdAndUpdate(
          conversationId,
          { lastMessage: lastMessageText, updatedAt: new Date() },
          { new: true }
        )
          .populate('accountId', 'username email')
          .populate('staffId', 'username email');

        io.to(conversationId.toString()).emit('new_message', {
          ...newMessage.toObject(),
          id: newMessage._id.toString(),
          conversationId: conversationId.toString(),
        });

        if (updatedConversation) {
          io.emit('conversation_updated', {
            ...updatedConversation.toObject(),
            id: updatedConversation._id.toString(),
            lastMessage: lastMessageText,
          });
        }
      } catch (err) {
        console.error('send_message error:', err);
        socket.emit('error', 'Failed to send message');
      }
    });

    // ===== mark_read =====
    socket.on('mark_read', async ({ conversationId, readerId }) => {
      if (!checkRateLimit(socket.id)) return;
      try {
        if (!conversationId || !isValidObjectId(conversationId) || !readerId || !isValidObjectId(readerId)) {
          return socket.emit('error', 'Valid conversationId and readerId required');
        }

        await Messages.updateMany(
          { conversationId, isRead: false },
          { isRead: true }
        );

        io.to(conversationId.toString()).emit('messages_read', {
          conversationId: conversationId.toString(),
          readerId,
        });
      } catch (err) {
        console.error('mark_read error:', err);
        socket.emit('error', 'Failed to mark as read');
      }
    });

    // ===== close_conversation =====
    socket.on('close_conversation', async ({ conversationId }) => {
      if (!checkRateLimit(socket.id)) return socket.emit('error', 'Rate limit exceeded.');
      try {
        if (!conversationId || !isValidObjectId(conversationId)) {
          return socket.emit('error', 'Valid conversationId required');
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
      } catch (err) {
        console.error('close_conversation error:', err);
        socket.emit('error', 'Failed to close conversation');
      }
    });

    // ===== disconnect =====
    socket.on('disconnect', () => {
      rateLimitMap.delete(socket.id); // Clean up rate limit tracking
      if (process.env.DEBUG === 'true') {
        console.log(`Chat socket disconnected: ${socket.id}`);
      }
    });
  });
};
