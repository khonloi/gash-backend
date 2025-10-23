const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('⚡ Client connected:', socket.id);

    // Join room
    socket.on('join_room', (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId.toString());
      console.log(`📥 ${socket.id} joined room ${conversationId}`);
    });

    // ======================
    // 🟢 User bắt đầu chat
    // ======================
    socket.on('start_chat', async ({ userId, messageText }) => {
      try {
        if (!userId) return socket.emit('error', 'Thiếu userId');

        let conversation = await Conversations.findOne({
          accountId: userId,
          status: { $ne: 'closed' },
        });

        let createdNew = false;
        if (!conversation) {
          conversation = await Conversations.create({
            accountId: userId,
            status: 'pending', // 👉 pending khi chưa có admin đọc
          });
          createdNew = true;
        }

        const convoId = conversation._id.toString();
        socket.join(convoId);

        // Gửi lịch sử tin nhắn
        const history = await Messages.find({ conversationId: convoId }).sort({
          createdAt: 1,
        });
        socket.emit('chat_history', {
          conversation: { ...conversation.toObject(), id: convoId },
          messages: history,
        });

        // Nếu user gửi kèm message → tạo tin nhắn mới
        if (messageText && messageText.trim() !== '') {
          const message = await Messages.create({
            conversationId: convoId,
            senderId: userId,
            messageText,
            type: 'text',
          });

          io.to(convoId).emit('new_message', {
            ...message.toObject(),
            conversationId: convoId,
          });
        }

        // Nếu conversation mới tạo → báo admin
        if (createdNew) {
          io.emit('conversation_created', {
            ...conversation.toObject(),
            id: convoId,
          });
        }

        console.log(
          `✅ start_chat handled for user ${userId}, convo ${convoId} (new:${createdNew})`
        );
      } catch (err) {
        console.error('❌ start_chat error:', err);
        socket.emit('error', 'Không thể bắt đầu chat.');
      }
    });

    // ======================
    // 🟣 Staff nhận chat
    // ======================
    socket.on('take_conversation', async ({ staffId, conversationId }) => {
      try {
        const convo = await Conversations.findOneAndUpdate(
          { _id: conversationId, status: { $in: ['pending', 'open'] } },
          { staffId, status: 'active' }, // 👉 đổi về active cho rõ nghĩa
          { new: true }
        );

        if (!convo) return;

        socket.join(convo._id.toString());
        io.to(convo._id.toString()).emit('conversation_taken', {
          ...convo.toObject(),
          id: convo._id.toString(),
        });
      } catch (err) {
        console.error('❌ take_conversation error:', err);
      }
    });

    // ======================
    // 💬 Gửi tin nhắn (text / ảnh / sticker / emoji)
    // ======================
    socket.on(
      'send_message',
      async ({ conversationId, senderId, messageText, imageUrl, type }) => {
        try {
          if (!conversationId) return;

          const msg = await Messages.create({
            conversationId,
            senderId,
            messageText: messageText || '',
            imageUrl: imageUrl || null,
            type: type || 'text',
            isRead: false,
          });

          io.to(conversationId.toString()).emit('new_message', {
            ...msg.toObject(),
            conversationId: conversationId.toString(),
          });

          // Cập nhật updatedAt của conversation để sort
          await Conversations.findByIdAndUpdate(conversationId, {
            updatedAt: new Date(),
          });

          console.log(`💬 Sent message [${type || 'text'}] to room ${conversationId}`);
        } catch (err) {
          console.error('❌ send_message error:', err);
        }
      }
    );

    // ======================
    // 👁️ Mark as read
    // ======================
    socket.on('mark_read', async ({ conversationId, readerId }) => {
      try {
        await Messages.updateMany(
          { conversationId, isRead: false },
          { isRead: true }
        );

        io.to(conversationId.toString()).emit('messages_read', {
          conversationId,
          readerId,
        });
      } catch (err) {
        console.error('❌ mark_read error:', err);
      }
    });

    // ======================
    // 🔴 Đóng chat
    // ======================
    socket.on('close_conversation', async ({ conversationId }) => {
      try {
        await Conversations.findByIdAndUpdate(conversationId, {
          status: 'closed',
        });
        io.to(conversationId.toString()).emit('conversation_closed', {
          conversationId: conversationId.toString(),
        });
      } catch (err) {
        console.error('❌ close_conversation error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });
};