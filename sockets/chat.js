const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('⚡ Connected:', socket.id);

        // User bắt đầu chat
        socket.on('start_chat', async ({ userId, messageText }) => {
            try {
                const conversation = await Conversations.create({ accountId: userId, status: 'open' });
                const message = await Messages.create({ conversationId: conversation._id, senderId: userId, messageText });

                socket.join(conversation._id.toString());
                io.to(conversation._id.toString()).emit('new_message', message);
                io.emit('new_conversation', conversation);
            } catch (err) {
                socket.emit('error', 'Không thể bắt đầu chat');
            }
        });

        // Staff nhận chat
        socket.on('take_conversation', async ({ staffId, conversationId }) => {
            try {
                const convo = await Conversations.findOneAndUpdate(
                    { _id: conversationId, status: 'open' },
                    { staffId, status: 'pending' },
                    { new: true }
                );
                if (!convo) return socket.emit('error', 'Đoạn chat đã nhận/đóng');
                socket.join(convo._id.toString());
                io.to(convo._id.toString()).emit('conversation_taken', convo);
            } catch (err) {
                socket.emit('error', 'Không thể nhận chat');
            }
        });

        // Gửi tin nhắn
        socket.on('send_message', async ({ conversationId, senderId, messageText }) => {
            try {
                const msg = await Messages.create({ conversationId, senderId, messageText });
                io.to(conversationId).emit('new_message', msg);
            } catch (err) {
                socket.emit('error', 'Không thể gửi tin nhắn');
            }
        });

        // Đóng chat
        socket.on('close_conversation', async ({ conversationId }) => {
            await Conversations.findByIdAndUpdate(conversationId, { status: 'closed' });
            io.to(conversationId).emit('conversation_closed', { conversationId });
        });

        socket.on('disconnect', () => console.log('❌ Disconnected:', socket.id));
    });
};
