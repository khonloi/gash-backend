// sockets/notificationSocket.js
const connectedUsers = new Map(); // Lưu userId -> socketId

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("📡 New socket connected:", socket.id);

    /**
     * Khi user kết nối (FE sẽ emit "userConnected" sau khi login)
     * => Lưu lại userId và socketId
     */
    socket.on("userConnected", (userId) => {
      if (!userId) return;
      connectedUsers.set(userId.toString(), socket.id);
      socket.join(userId.toString());
      console.log(`✅ User ${userId} joined room ${userId}`);
    });

    /**
     * Khi user ngắt kết nối
     * => Xóa khỏi danh sách connectedUsers
     */
    socket.on("disconnect", () => {
      for (const [userId, sockId] of connectedUsers.entries()) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`❌ User disconnected: ${userId}`);
          break;
        }
      }
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};

// Export Map để controller có thể dùng
module.exports.connectedUsers = connectedUsers;
