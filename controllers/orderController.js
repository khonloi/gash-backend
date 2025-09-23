const orderService = require('../services/orderService');
const vnpayService = require('../services/vnpayService');

exports.createOrder = async (req, res) => {
  try {
    const savedOrder = await orderService.createOrderService(req.body, req.user);
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io && savedOrder && savedOrder.acc_id) {
      io.emit('orderUpdated', { userId: savedOrder.acc_id, order: savedOrder });
    }
    res.status(201).json({
      message: 'Order created successfully',
      order: savedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error creating order' });
  }
};

exports.getAllOrders = async (req, res) => {
  // console.log('[getAllOrders] Endpoint hit', req.method, req.path);
  try {
    // console.log('[getAllOrders] req.user:', req.user);
    const orders = await orderService.getAllOrdersService(req.user);
    // console.log('[getAllOrders] result orders:', orders);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving orders' });
  }
};

exports.searchOrders = async (req, res) => {
  // console.log('[searchOrders] Endpoint hit', req.method, req.path);
  try {
    // console.log('[searchOrders] req.user:', req.user);
    // console.log('[searchOrders] req.query:', req.query);
    const orders = await orderService.searchOrdersService(req.query, req.user);
    // console.log('[searchOrders] result orders:', orders);
    res.status(200).json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error searching orders' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await orderService.getOrderByIdService(req.params.id, req.user);
    res.status(200).json(order);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving order' });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const updatedOrder = await orderService.updateOrderService(req.params.id, req.body, req.user);
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io && updatedOrder && updatedOrder.acc_id) {
      // Always emit userId as string (handle both populated and non-populated acc_id)
      const userId = typeof updatedOrder.acc_id === 'object' && updatedOrder.acc_id._id
        ? updatedOrder.acc_id._id.toString()
        : updatedOrder.acc_id.toString();
      io.emit('orderUpdated', { userId, order: updatedOrder });
    }
    res.status(200).json({
      message: 'Order updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating order' });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const result = await orderService.deleteOrderService(req.params.id, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error deleting order' });
  }
};

exports.createVnpayPaymentUrl = async (req, res) => {
  try {
    const { orderId, bankCode, language } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const paymentUrl = await vnpayService.createPaymentUrl(orderId, bankCode, language, req.user, req);

    res.status(200).json({
      success: true,
      message: 'Payment URL created successfully',
      paymentUrl
    });
  } catch (error) {
    console.error("Payment URL creation error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error creating payment URL',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    if (!req.query || Object.keys(req.query).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid return data from VNPay'
      });
    }

    const result = await vnpayService.handleReturn(req.query);

    if (result.code === "00") {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        data: result
      });
    }
  } catch (error) {
    console.error("VNPay return error:", error);
    res.status(error.status || 400).json({
      success: false,
      message: error.message || 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    if (!req.query || Object.keys(req.query).length === 0) {
      return res.status(400).json({
        RspCode: '99',
        Message: 'Invalid IPN data'
      });
    }

    const result = await vnpayService.handleIpn(req.query);

    // VNPay yêu cầu response phải có RspCode và Message
    res.status(200).json(result);
  } catch (error) {
    console.error("VNPay IPN error:", error);
    res.status(200).json({
      RspCode: '99',
      Message: 'Internal server error'
    });
  }
}; 