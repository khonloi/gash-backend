// orderDetailController.js
const orderDetailService = require('../services/orderDetailService');
const mongoose = require('mongoose');

exports.searchOrderDetails = async (req, res) => {
  try {
    const result = await orderDetailService.searchOrderDetails(req.query, req.user);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error searching order details', error: error.message });
  }
};

exports.createOrderDetail = async (req, res) => {
  try {
    const { order_id, variant_id, UnitPrice, Quantity, feedback } = req.body;

    // Validate required fields
    if (!order_id || !variant_id || !UnitPrice || !Quantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (UnitPrice < 0) {
      return res.status(400).json({ message: 'Unit price cannot be negative' });
    }
    if (Quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    // Validate feedback structure if provided
    // if (feedback) {
    //   if (feedback.rating && (feedback.rating < 1 || feedback.rating > 5)) {
    //     return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    //   }
    //   if (feedback.content && feedback.content.length > 500) {
    //     return res.status(400).json({ message: 'Feedback content cannot exceed 500 characters' });
    //   }
    // }

    const result = await orderDetailService.createOrderDetail(req.body, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error creating order detail', error: error.message });
  }
};


exports.getAllOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await orderDetailService.getAllOrderDetails(req.user, orderId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving order details', error: error.message });
  }
};

exports.getOrderDetailById = async (req, res) => {
  try {
    const result = await orderDetailService.getOrderDetailById(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Order detail not found' });
    }
    if (
      req.user.role !== 'admin' &&
      req.user.role !== 'manager' &&
      result.order_id.acc_id._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Access denied: Can only view own order detail' });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving order detail', error: error.message });
  }
};

exports.updateOrderDetail = async (req, res) => {
  try {
    const { UnitPrice, Quantity, feedback } = req.body;

    // Validate fields
    if (UnitPrice !== undefined && UnitPrice < 0) {
      return res.status(400).json({ message: 'Unit price cannot be negative' });
    }
    if (Quantity !== undefined && Quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const result = await orderDetailService.updateOrderDetail(req.params.id, req.body, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order detail', error: error.message });
  }
};

exports.deleteOrderDetail = async (req, res) => {
  try {
    const result = await orderDetailService.deleteOrderDetail(req.params.id, req.user);
    res.status(result.status).json(result.response);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting order detail', error: error.message });
  }
};

exports.getOrderDetailsByProduct = async (req, res) => {
  try {
    const result = await orderDetailService.getOrderDetailsByProduct(req.params.productId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving product feedback', error: error.message });
  }
};