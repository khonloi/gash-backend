// sockets/notificationSocket.js
const connectedUsers = new Map(); // Lưu userId -> socketId

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("📡 New notification socket connected:", socket.id);

    /**
     * Khi user kết nối (FE sẽ emit "userConnected" sau khi login)
     * => Lưu lại userId và socketId, join vào room
     */
    socket.on("userConnected", (userId) => {
      if (!userId) {
        console.warn("⚠️ userConnected received without userId");
        return;
      }
      
      const userIdStr = userId.toString();
      connectedUsers.set(userIdStr, socket.id);
      
      // Join both room formats for compatibility
      socket.join(userIdStr);
      socket.join(`user_${userIdStr}`);
      
      console.log(`✅ User ${userIdStr} joined notification rooms: ${userIdStr}, user_${userIdStr}`);
    });

    /**
     * Handle joinRoom event (for compatibility)
     */
    socket.on("joinRoom", (userId) => {
      if (!userId) return;
      const userIdStr = userId.toString();
      socket.join(userIdStr);
      socket.join(`user_${userIdStr}`);
      console.log(`✅ User ${userIdStr} joined notification rooms via joinRoom`);
    });

    /**
     * Khi user ngắt kết nối
     * => Xóa khỏi danh sách connectedUsers
     */
    socket.on("disconnect", () => {
      for (const [userId, sockId] of connectedUsers.entries()) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`❌ User disconnected from notifications: ${userId}`);
          break;
        }
      }
      console.log(`❌ Notification socket disconnected: ${socket.id}`);
    });
  });
};

// Export Map để controller có thể dùng
module.exports.connectedUsers = connectedUsers;
