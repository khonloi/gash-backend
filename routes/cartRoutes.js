const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middleware/authMiddleware");
const {
  getAllCartItems,
  getCartItemById,
  createCartItem,
  updateCartItem,
  deleteCartItem,
} = require("../controllers/cartController");

// Create a new cart item (User for own cart, Admin/Manager)
router.post("/", authenticateJWT, createCartItem);

// Get all cart items (Admin/Manager or own carts for User)
router.get("/", authenticateJWT, getAllCartItems);

// Get a single cart item by ID (Admin/Manager or own cart for User)
router.get("/:id", authenticateJWT, getCartItemById);

// Update a cart item (Admin/Manager or own cart for User)
router.put("/:id", authenticateJWT, updateCartItem);

// Delete a cart item (Admin/Manager or own cart for User)
router.delete("/:id", authenticateJWT, deleteCartItem);

module.exports = router;
