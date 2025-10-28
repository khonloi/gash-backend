let ioInstance = null;

const initializeProductSocket = (io) => {
  ioInstance = io;
  
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Join product room for general product updates
    socket.on("joinProductRoom", () => {
      socket.join("productRoom");
      console.log("Client joined productRoom:", socket.id);
    });

    // Join variant room for product variant updates
    socket.on("joinVariantRoom", () => {
      socket.join("variantRoom");
      console.log("Client joined variantRoom:", socket.id);
    });

    // Join livestream product room
    socket.on("joinLiveProductRoom", (liveId) => {
      const room = `live_${liveId}`;
      socket.join(room);
      console.log(`Client joined ${room}:`, socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized!');
  }
  return ioInstance;
};

module.exports = initializeProductSocket;
module.exports.getIO = getIO;
