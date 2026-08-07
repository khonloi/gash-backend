const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const ProductVariant = require("../models/ProductVariant");

class CartService {
  // Create a new cart item or update existing one
  async createCartItem(userId, data) {
    try {
      const { accountId, variantId, productQuantity } = data;

      // Ensure the requesting user is the cart's owner
      if (userId !== accountId) {
        throw new Error('Unauthorized: You can only create cart items for your own account');
      }

      // Parse productQuantity to number for calculations
      const quantityNum = parseInt(productQuantity, 10);
      if (isNaN(quantityNum) || quantityNum < 1) {
        throw new Error('Invalid productQuantity: Must be a positive number');
      }

      // Fetch variantPrice and stockQuantity from referenced ProductVariant
      const variant = await ProductVariant.findById(variantId);
      if (!variant) {
        throw new Error('Invalid variantId: Variant not found');
      }
      const productPrice = variant.variantPrice; // Derive price from variant

      // Check if a cart item already exists for this accountId and variantId
      const existingCartItem = await Cart.findOne({ accountId, variantId });
      if (existingCartItem) {
        // Calculate new total quantity
        const currentQuantity = parseInt(existingCartItem.productQuantity, 10);
        const newTotalQuantity = currentQuantity + quantityNum;

        // Check if new total quantity exceeds stockQuantity
        if (newTotalQuantity > variant.stockQuantity) {
          throw new Error(`Requested quantity (${newTotalQuantity}) exceeds available stock (${variant.stockQuantity})`);
        }

        // Update existing cart item
        existingCartItem.productQuantity = newTotalQuantity.toString();
        existingCartItem.updatedAt = Date.now();
        const updatedCartItem = await existingCartItem.save();
        await updatedCartItem.populate([
          { 
            path: 'variantId',
            populate: [
              { path: 'productId' },
              { path: 'productColorId' },
              { path: 'productSizeId' }
            ]
          }
        ]);
        return updatedCartItem;
      }

      // If no existing cart item, check stock and create new
      if (quantityNum > variant.stockQuantity) {
        throw new Error(`Requested quantity (${quantityNum}) exceeds available stock (${variant.stockQuantity})`);
      }

      const newCartItem = new Cart({
        accountId,
        variantId,
        productQuantity,
        productPrice
      });

      const savedCartItem = await newCartItem.save();
      // Populate after save
      await savedCartItem.populate([
        { 
          path: 'variantId',
          populate: [
            { path: 'productId' },
            { path: 'productColorId' },
            { path: 'productSizeId' }
          ]
        }
      ]);
      return savedCartItem;
    } catch (error) {
      throw new Error(`Create failed: ${error.message}`);
    }
  }

  // Get all cart items (only for the user's own account)
  async getCartByAccountId(userId, accountId) {
    try {
      // Ensure the user can only fetch their own cart
      if (userId !== accountId) {
        throw new Error('Unauthorized: You can only view your own cart');
      }
      const cartItems = await Cart.find({ accountId })
        .populate([
          { 
            path: 'variantId',
            populate: [
              { path: 'productId' },
              { path: 'productColorId' },
              { path: 'productSizeId' }
            ]
          }
        ]);
      return cartItems;
    } catch (error) {
      throw new Error(`Get by account failed: ${error.message}`);
    }
  }

  // Get cart item by cartId (_id)
  async getCartItemById(userId, cartId) {
    try {
      const cartItem = await Cart.findById(cartId)
        .populate([
          { 
            path: 'variantId',
            populate: [
              { path: 'productId' },
              { path: 'productColorId' },
              { path: 'productSizeId' }
            ]
          }
        ]);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }
      // Ensure the user can only fetch their own cart item
      if (userId !== cartItem.accountId.toString()) {
        throw new Error('Unauthorized: You can only view your own cart items');
      }
      return cartItem;
    } catch (error) {
      throw new Error(`Get by ID failed: ${error.message}`);
    }
  }

  // Update cart item (e.g., quantity or selection status)
  async updateCartItem(userId, cartId, updateData) {
    try {
      // Fetch cart item to verify ownership
      const cartItem = await Cart.findById(cartId);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }
      if (userId !== cartItem.accountId.toString()) {
        throw new Error('Unauthorized: You can only update your own cart items');
      }

      // If productQuantity is being updated, check against stockQuantity
      const { productQuantity, selected } = updateData;
      if (productQuantity) {
        const variant = await ProductVariant.findById(cartItem.variantId);
        if (!variant) {
          throw new Error('Invalid variantId: Variant not found');
        }
        const quantityNum = parseInt(productQuantity, 10);
        if (isNaN(quantityNum) || quantityNum < 1) {
          throw new Error('Invalid productQuantity: Must be a positive number');
        }
        if (quantityNum > variant.stockQuantity) {
          throw new Error(`Requested quantity (${quantityNum}) exceeds available stock (${variant.stockQuantity})`);
        }
      }

      const updatedCartItem = await Cart.findByIdAndUpdate(
        cartId,
        { productQuantity, selected, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).populate([
        { 
          path: 'variantId',
          populate: [
            { path: 'productId' },
            { path: 'productColorId' },
            { path: 'productSizeId' }
          ]
        }
      ]);
      return updatedCartItem;
    } catch (error) {
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  // Delete cart item
  async deleteCartItem(userId, cartId) {
    try {
      // Fetch cart item to verify ownership
      const cartItem = await Cart.findById(cartId);
      if (!cartItem) {
        throw new Error('Cart item not found');
      }
      if (userId !== cartItem.accountId.toString()) {
        throw new Error('Unauthorized: You can only delete your own cart items');
      }

      await Cart.findByIdAndDelete(cartId);
      return { message: 'Cart item deleted successfully' };
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
}

module.exports = new CartService();