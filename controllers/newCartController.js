const newCartService = require('../services/newCartService');

class NewCartController {
  // POST /api/newCart - Create
  async createCartItem(req, res) {
    try {
      const cartData = req.body; // Expects { accountId, variantId, productQuantity }
      const newCartItem = await newCartService.createCartItem(req.user.id, cartData);
      const response = { ...newCartItem.toObject(), cartId: newCartItem._id };
      delete response._id;
      res.status(201).json({ success: true, data: response });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /api/newCart/account/:accountId - Get by account
  async getCartByAccount(req, res) {
    try {
      const { accountId } = req.params;
      const cartItems = await newCartService.getCartByAccountId(req.user.id, accountId);
      const response = cartItems.map(item => ({ ...item.toObject(), cartId: item._id }));
      res.json({ success: true, data: response });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }

  // GET /api/newCart/:cartId - Get by ID
  async getCartItemById(req, res) {
    try {
      const { cartId } = req.params;
      const cartItem = await newCartService.getCartItemById(req.user.id, cartId);
      const response = { ...cartItem.toObject(), cartId: cartItem._id };
      delete response._id;
      res.json({ success: true, data: response });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }

  // PUT /api/newCart/:cartId - Update
  async updateCartItem(req, res) {
    try {
      const { cartId } = req.params;
      const updateData = req.body; // Expects { productQuantity?, selected? }
      const updatedCartItem = await newCartService.updateCartItem(req.user.id, cartId, updateData);
      const response = { ...updatedCartItem.toObject(), cartId: updatedCartItem._id };
      delete response._id;
      res.json({ success: true, data: response });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }

  // DELETE /api/newCart/:cartId - Delete
  async deleteCartItem(req, res) {
    try {
      const { cartId } = req.params;
      const result = await newCartService.deleteCartItem(req.user.id, cartId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }
}

module.exports = new NewCartController();