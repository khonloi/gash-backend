const initializeProductSocket = (io) => {
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

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

module.exports = initializeProductSocket;
