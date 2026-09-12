const { createOrderNotification, emitOrderNotification } = require('./orderNotificationHelper');

async function emitOrderUpdateEvent(io, updatedOrder, messageType = 'status_changed') {
  if (!io || !updatedOrder || !updatedOrder.acc_id) return;

  const userId = typeof updatedOrder.acc_id === 'object' && updatedOrder.acc_id._id
    ? updatedOrder.acc_id._id.toString()
    : updatedOrder.acc_id.toString();

  // Ensure order is properly formatted with all fields
  const formattedOrder = {
    ...(updatedOrder.toObject ? updatedOrder.toObject() : updatedOrder),
    acc_id: updatedOrder.acc_id,
    name: updatedOrder.name,
    orderDate: updatedOrder.orderDate,
    updatedAt: updatedOrder.updatedAt || updatedOrder.createdAt,
    createdAt: updatedOrder.createdAt,
    cancelReason: updatedOrder.cancelReason
  };

  // Emit to specific user room for real-time updates
  io.to(`user_\${userId}`).emit('orderUpdated', { userId, order: formattedOrder });
  // Also emit to admin room so dashboard gets updates
  io.to('order_admins').emit('orderUpdated', { userId, order: formattedOrder });

  console.log(`📦 Order \${updatedOrder._id} updated, emitted to user_\${userId} and order_admins`);

  // 🔔 Create and emit order notification
  try {
    const notification = await createOrderNotification({
      userId,
      orderId: updatedOrder._id.toString(),
      orderStatus: updatedOrder.order_status,
      payStatus: updatedOrder.pay_status,
      messageType
    });

    // Small delay to ensure socket connection is established
    setTimeout(() => {
      emitOrderNotification(io, notification, userId);
    }, 100);
  } catch (notifError) {
    console.error('❌ Error creating order notification:', notifError);
  }
}

module.exports = {
  emitOrderUpdateEvent
};
