const Orders = require('../models/Orders');

class VNPayExpiryService {
  static startExpiryChecker() {
    // Check every minute for expired VNPay orders
    setInterval(async () => {
      try {
        const now = new Date();

        // Find orders that:
        // 1. Have VNPay as payment method
        // 2. Are unpaid
        // 3. Have an expiry time set
        // 4. Expiry time has passed
        // 5. Are not already cancelled
        const expiredOrders = await Orders.find({
          paymentMethod: 'VNPAY',
          payStatus: 'unpaid',
          vnpay_expiry_time: { $ne: null, $lt: now },
          orderStatus: { $ne: 'cancelled' }
        });

        for (const order of expiredOrders) {
          // Cancel the order due to VNPay expiry
          order.orderStatus = 'cancelled';
          order.cancelReason = 'Payment timeout: VNPay payment not completed within 15 minutes';
          // Clear VNPay payment data
          order.vnpay_payment_url = '';
          order.vnpay_expiry_time = null;
          await order.save();

          console.log(`Order ${order._id} cancelled due to VNPay payment expiry`);
        }

        if (expiredOrders.length > 0) {
          console.log(`Cancelled ${expiredOrders.length} expired VNPay orders`);
        }
      } catch (error) {
        console.error('Error checking expired VNPay orders:', error);
      }
    }, 60000); // Check every 60 seconds

    console.log('VNPay expiry checker started');
  }
}

module.exports = VNPayExpiryService;