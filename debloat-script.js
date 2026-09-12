const fs = require('fs');
const targetFile = 'd:\\Project\\gash-backend\\controllers\\orderController.js';
let content = fs.readFileSync(targetFile, 'utf8');

// Insert imports at the top
if (!content.includes("require('../utils/orderFormatter')")) {
  content = "const { formatOrderResponse } = require('../utils/orderFormatter');\nconst { emitOrderUpdateEvent } = require('../utils/orderSocketHelper');\n" + content;
}

// 1. Debloat getOrderById
const getOrderByIdRegex = /exports\.getOrderById = async \(req, res\) => \{[\s\S]*?(?=exports\.updateOrderByAdmin)/;
const getOrderByIdReplacement = `exports.getOrderById = async (req, res) => {
  try {
    const order = await orderService.getOrderByIdService(req.params.id, req.user);
    const formattedOrder = formatOrderResponse(order);
    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: formattedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error retrieving order'
    });
  }
};

`;
content = content.replace(getOrderByIdRegex, getOrderByIdReplacement);

// 2. Debloat updateOrderByAdmin
// Find the socket emission chunk and replace it
const updateOrderByAdminRegex = /const io = req\.app\.get\('io'\);[\s\S]*?(?=res\.status\(200\)\.json)/;
const updateOrderByAdminReplacement = `const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) {
      let messageType = 'status_changed';
      if (oldPayStatus !== updatedOrder.pay_status && updatedOrder.pay_status) {
        messageType = 'payment_changed';
      } else if (updatedOrder.order_status === 'delivered' && oldOrderStatus !== 'delivered') {
        messageType = 'delivered';
      }
      await emitOrderUpdateEvent(io, updatedOrder, messageType);
    }
    `;
content = content.replace(updateOrderByAdminRegex, updateOrderByAdminReplacement);

// 3. Debloat vnpayReturn
const vnpayReturnRegex = /const io = req\.app\.get\('io'\);[\s\S]*?(?=if \(result\.code === "00"\))/;
const vnpayReturnReplacement = `const io = req.app.get('io');
    if (io && orderId) {
      const updatedOrder = await Order.findById(orderId).populate('acc_id', 'username name email phone').lean();
      if (updatedOrder && updatedOrder.acc_id) {
        await emitOrderUpdateEvent(io, updatedOrder, 'payment_changed');
      }
    }
    `;
content = content.replace(vnpayReturnRegex, vnpayReturnReplacement);

// 4. Debloat vnpayIpn
const vnpayIpnRegex = /const io = req\.app\.get\('io'\);[\s\S]*?(?=res\.status\(200\)\.json\(result\);)/;
const vnpayIpnReplacement = `const io = req.app.get('io');
    if (io && req.query.vnp_TxnRef) {
      const orderId = req.query.vnp_TxnRef;
      const updatedOrder = await Order.findById(orderId).populate('acc_id', 'username name email phone').lean();
      if (updatedOrder && updatedOrder.acc_id) {
        await emitOrderUpdateEvent(io, updatedOrder, 'payment_changed');
      }
    }
    `;
content = content.replace(vnpayIpnRegex, vnpayIpnReplacement);

// 5. Debloat checkout
const checkoutSocketRegex = /const io = req\.app\.get\('io'\);[\s\S]*?(?=return res\.status\(201\)\.json)/;
const checkoutSocketReplacement = `const io = req.app.get('io');
    if (io && userId) {
      io.to(\`user_\${userId.toString()}\`).emit('cartUpdated', { action: 'cleared', accountId: userId });
      const populatedOrder = await Order.findById(savedOrder._id).populate('acc_id', 'username name email phone').lean();
      await emitOrderUpdateEvent(io, populatedOrder, 'created');
    }
    `;
content = content.replace(checkoutSocketRegex, checkoutSocketReplacement);

// 6. Debloat cancelOrder
const cancelSocketRegex = /const io = req\.app\.get\('io'\);[\s\S]*?(?=res\.status\(200\)\.json)/;
const cancelSocketReplacement = `const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) {
      await emitOrderUpdateEvent(io, updatedOrder, 'cancelled');
    }
    `;
content = content.replace(cancelSocketRegex, cancelSocketReplacement);

fs.writeFileSync(targetFile, content, 'utf8');
console.log("Debloat script completed!");
