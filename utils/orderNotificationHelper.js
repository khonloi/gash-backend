const Notification = require('../models/Notification');

/**
 * Order Notification Helper
 * 
 * This module handles web (Socket.IO) notifications for order updates.
 * Email notifications are handled by the frontend using EmailJS (similar to OTP emails).
 */

/**
 * Create a notification for order updates
 * @param {Object} params - Notification parameters
 * @param {String} params.userId - User ID to notify
 * @param {String} params.orderId - Order ID
 * @param {String} params.orderStatus - Current order status
 * @param {String} params.payStatus - Current payment status (optional)
 * @param {String} params.messageType - Type of update: 'created', 'status_changed', 'payment_changed', 'cancelled'
 * @returns {Promise<Object>} Created notification
 */
async function createOrderNotification({ userId, orderId, orderStatus, payStatus, messageType = 'status_changed' }) {
  try {
    // Map order status to user-friendly messages
    const statusMessages = {
      pending: 'is pending confirmation',
      confirmed: 'has been confirmed',
      shipping: 'is on the way',
      delivered: 'has been delivered',
      cancelled: 'has been cancelled'
    };

    const paymentMessages = {
      unpaid: 'Payment pending',
      paid: 'Payment received'
    };

    // Create notification based on message type
    let title = '';
    let message = '';

    switch (messageType) {
      case 'created':
        title = 'New Order Created';
        message = `Your order #${orderId.slice(-8)} has been successfully created and ${statusMessages[orderStatus] || 'is being processed'}.`;
        break;

      case 'status_changed':
        title = 'Order Status Updated';
        message = `Your order #${orderId.slice(-8)} ${statusMessages[orderStatus] || 'status has been updated'}.`;
        break;

      case 'payment_changed':
        title = 'Payment Status Updated';
        const paymentMsg = paymentMessages[payStatus] || `payment status is ${payStatus}`;
        message = `Your order #${orderId.slice(-8)} ${paymentMsg}.`;
        break;

      case 'cancelled':
        title = 'Order Cancelled';
        message = `Your order #${orderId.slice(-8)} has been cancelled.`;
        break;

      case 'delivered':
        title = 'Order Delivered';
        message = `Great news! Your order #${orderId.slice(-8)} has been delivered. Thank you for shopping with us!`;
        break;

      default:
        title = 'Order Update';
        message = `Your order #${orderId.slice(-8)} has been updated.`;
    }

    // Create notification
    const notification = new Notification({
      title,
      message,
      userId,
      type: 'order',
      isRead: false,
      isTemplate: false,
      createdAt: new Date(),
    });

    await notification.save();

    // Email notifications are handled by the frontend when they receive the Socket.IO notification
    // This follows the same pattern as OTP emails (sent from frontend using EmailJS)

    return notification;
  } catch (error) {
    console.error('❌ Error creating order notification:', error);
    throw error;
  }
}

/**
 * Emit notification via Socket.IO
 * @param {Object} io - Socket.IO instance
 * @param {Object} notification - Notification object
 * @param {String} userId - User ID to send notification to
 */
function emitOrderNotification(io, notification, userId) {
  if (!io || !notification || !userId) {
    console.warn('⚠️ Cannot emit notification: missing io, notification, or userId');
    return;
  }

  try {
    // Convert Mongoose document to plain object if needed
    let notificationData = notification;
    if (notification.toObject) {
      notificationData = notification.toObject();
    } else if (notification.toJSON) {
      notificationData = notification.toJSON();
    }
    
    // Ensure userId is properly formatted
    const userIdStr = userId.toString();
    
    // Check if notification data is valid
    if (!notificationData || !notificationData._id) {
      console.warn('⚠️ Invalid notification data:', notificationData);
      return;
    }
    
    // Emit to specific user room (notificationSocket uses userId.toString() as room name)
    io.to(userIdStr).emit('newNotification', notificationData);
    // Also emit badge update to update the notification count
    io.to(userIdStr).emit('notificationBadgeUpdate', { userId: userIdStr });
    
    // Also try emitting to user_${userId} room (for orderSocket compatibility)
    io.to(`user_${userIdStr}`).emit('newNotification', notificationData);
    io.to(`user_${userIdStr}`).emit('notificationBadgeUpdate', { userId: userIdStr });
    
    // Also emit to socket directly as a fallback
    const { connectedUsers } = require('../sockets/notificationSocket');
    const socketId = connectedUsers.get(userIdStr);
    if (socketId) {
      io.to(socketId).emit('newNotification', notificationData);
      io.to(socketId).emit('notificationBadgeUpdate', { userId: userIdStr });
      console.log(`   Also emitted directly to socket ${socketId}`);
    }
    
    // Log for debugging
    console.log(`🔔 Order notification emitted to user ${userIdStr} (rooms: ${userIdStr}, user_${userIdStr})`);
    console.log(`   Notification ID: ${notificationData._id}, Title: ${notificationData.title}`);
  } catch (error) {
    console.error('❌ Error emitting order notification:', error);
  }
}

module.exports = {
  createOrderNotification,
  emitOrderNotification,
};

