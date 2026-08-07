const Orders = require('../models/Orders');
const OrderDetails = require('../models/OrderDetails');
const ProductVariant = require('../models/ProductVariant');
const mongoose = require('mongoose');

/**
 * Restores stock quantities for all items in a cancelled order.
 * If a variant's stock goes from 0 → >0, its status is reactivated to 'active'.
 *
 * @param {mongoose.Types.ObjectId} orderId
 */
async function restoreStockForOrder(orderId) {
  const details = await OrderDetails.find({ orderId }).select('variantId Quantity');
  if (!details.length) return;

  for (const detail of details) {
    if (!detail.variantId) continue;

    const variant = await ProductVariant.findById(detail.variantId);
    if (!variant) continue;

    const wasOutOfStock = variant.stockQuantity === 0;
    variant.stockQuantity += detail.Quantity;

    // Reactivate if stock was previously depleted
    if (wasOutOfStock && variant.stockQuantity > 0) {
      variant.variantStatus = 'active';
    }
    await variant.save();
  }
}

class VNPayExpiryService {
  static startExpiryChecker() {
    // Check every minute for expired VNPay payment windows
    setInterval(async () => {
      try {
        const now = new Date();

        // Find orders that:
        // 1. Are VNPAY payment method
        // 2. Are still unpaid
        // 3. Have an expiry timestamp set
        // 4. The expiry has passed
        // 5. Are not already cancelled
        const expiredOrders = await Orders.find({
          paymentMethod: 'VNPAY',
          payStatus: 'unpaid',
          vnpay_expiry_time: { $ne: null, $lt: now },
          orderStatus: { $ne: 'cancelled' },
        }).select('_id');

        if (!expiredOrders.length) return;

        const expiredIds = expiredOrders.map((o) => o._id);
        const cancelReason = 'Payment timeout: VNPay payment not completed within 15 minutes';

        // Restore stock for each expired order before cancelling
        for (const order of expiredOrders) {
          try {
            await restoreStockForOrder(order._id);
          } catch (stockErr) {
            console.error(`Error restoring stock for order ${order._id}:`, stockErr.message);
            // Continue cancelling even if stock restoration fails — log for manual review
          }
        }

        // Bulk-cancel all expired orders in a single database write
        const result = await Orders.bulkWrite(
          expiredIds.map((id) => ({
            updateOne: {
              filter: { _id: id },
              update: {
                $set: {
                  orderStatus: 'cancelled',
                  cancelReason,
                  vnpay_payment_url: '',
                  vnpay_expiry_time: null,
                },
              },
            },
          }))
        );

        console.log(`VNPay expiry: cancelled ${result.modifiedCount} order(s) and restored their stock.`);
      } catch (error) {
        console.error('Error checking expired VNPay orders:', error);
      }
    }, 60000); // Run every 60 seconds

    console.log('VNPay expiry checker started');
  }
}

module.exports = VNPayExpiryService;