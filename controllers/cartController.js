const cartService = require('../services/cartService');

class CartController {
  // POST /api/cart - Create
  async createCartItem(req, res) {
    try {
      const cartData = req.body; // Expects { accountId, variantId, productQuantity }
      const newCartItem = await cartService.createCartItem(req.user.id, cartData);
      const response = { ...newCartItem.toObject(), cartId: newCartItem._id };
      delete response._id;

      // 🔔 Emit Socket.IO event for cart update
      const io = req.app.get('io');
      if (io && cartData.accountId) {
        // Emit to user's room for instant badge update
        io.to(cartData.accountId.toString()).emit('cartUpdated', {
          action: 'created',
          accountId: cartData.accountId
        });
      }

      res.status(201).json({ success: true, data: response });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /api/cart/account/:accountId - Get by account
  async getCartByAccount(req, res) {
    try {
      const { accountId } = req.params;
      const cartItems = await cartService.getCartByAccountId(req.user.id, accountId);
      const response = cartItems.map(item => ({ ...item.toObject(), cartId: item._id }));
      res.json({ success: true, data: response });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }

  // GET /api/cart/:cartId - Get by ID
  async getCartItemById(req, res) {
    try {
      const { cartId } = req.params;
      const cartItem = await cartService.getCartItemById(req.user.id, cartId);
      const response = { ...cartItem.toObject(), cartId: cartItem._id };
      delete response._id;
      res.json({ success: true, data: response });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }

  // PUT /api/cart/:cartId - Update
  async updateCartItem(req, res) {
    try {
      const { cartId } = req.params;
      const updateData = req.body; // Expects { productQuantity?, selected? }
      const updatedCartItem = await cartService.updateCartItem(req.user.id, cartId, updateData);
      const response = { ...updatedCartItem.toObject(), cartId: updatedCartItem._id };
      delete response._id;

      // 🔔 Emit Socket.IO event for cart update
      const io = req.app.get('io');
      if (io && updatedCartItem.accountId) {
        io.to(updatedCartItem.accountId.toString()).emit('cartUpdated', {
          action: 'updated',
          accountId: updatedCartItem.accountId
        });
      }

      res.json({ success: true, data: response });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }

  // DELETE /api/cart/:cartId - Delete
  async deleteCartItem(req, res) {
    try {
      const { cartId } = req.params;
      
      // Get cart item before deletion to emit event
      let accountId = null;
      try {
        const cartItem = await cartService.getCartItemById(req.user.id, cartId);
        if (cartItem && cartItem.accountId) {
          accountId = cartItem.accountId.toString();
        }
      } catch (err) {
        // Ignore error if cart item not found
      }

      const result = await cartService.deleteCartItem(req.user.id, cartId);

      // 🔔 Emit Socket.IO event for cart update
      const io = req.app.get('io');
      if (io && accountId) {
        io.to(accountId).emit('cartUpdated', {
          action: 'deleted',
          accountId: accountId
        });
      }

      res.json({ success: true, ...result });
    } catch (error) {
      res.status(403).json({ success: false, message: error.message });
    }
  }
}

module.exports = new CartController();