const Cart = require("../models/Carts");
const ProductVariants = require("../models/ProductVariants");
const Products = require("../models/Products");
const ProductColors = require("../models/ProductColors");
const ProductSizes = require("../models/ProductSizes");

// Lấy toàn bộ giỏ hàng theo acc_id
const getAllCartItems = async (req, res) => {
  try {
    const { acc_id } = req.query;
    const filter = acc_id ? { acc_id } : {};

    const cartItems = await Cart.find(filter)
      .populate({
        path: "variant_id",
        model: "ProductVariants",
        populate: [
          {
            path: "pro_id",
            model: "Products",
            select: "pro_name pro_price imageURL fullImageURL",
          },
          { path: "color_id", model: "ProductColors", select: "color_name" },
          { path: "size_id", model: "ProductSizes", select: "size_name" },
          { path: "image_id", model: "ProductImages" },
        ],
      });

    res.status(200).json(cartItems);
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ message: "Error fetching cart items" });
  }
};

// Lấy 1 sản phẩm trong giỏ theo ID
const getCartItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const cartItem = await Cart.findById(id).populate({
      path: "variant_id",
      model: "ProductVariants",
      populate: [
        {
          path: "pro_id",
          model: "Products",
          select: "pro_name pro_price imageURL fullImageURL",
        },
        { path: "color_id", model: "ProductColors", select: "color_name" },
        { path: "size_id", model: "ProductSizes", select: "size_name" },
        { path: "image_id", model: "ProductImages" },
      ],
    });

    if (!cartItem) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    res.status(200).json(cartItem);
  } catch (error) {
    console.error("Error fetching cart item:", error);
    res.status(500).json({ message: "Error fetching cart item" });
  }
};

// Thêm sản phẩm vào giỏ hàng
const createCartItem = async (req, res) => {
  try {
    const { acc_id, variant_id, pro_quantity, pro_price } = req.body;

    if (!acc_id || !variant_id || !pro_quantity || !pro_price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Kiểm tra nếu sản phẩm đã tồn tại trong giỏ
    let existingItem = await Cart.findOne({ acc_id, variant_id });
    if (existingItem) {
      existingItem.pro_quantity += pro_quantity;
      existingItem.Total_price = existingItem.pro_quantity * existingItem.pro_price;
      await existingItem.save();
      return res.status(200).json(existingItem);
    }

    const cartItem = new Cart({
      acc_id,
      variant_id,
      pro_quantity,
      pro_price,
      Total_price: pro_quantity * pro_price,
    });

    await cartItem.save();
    res.status(201).json(cartItem);
  } catch (error) {
    console.error("Error creating cart item:", error);
    res.status(500).json({ message: "Error creating cart item" });
  }
};

// Cập nhật số lượng sản phẩm trong giỏ
const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { pro_quantity } = req.body;

    if (!pro_quantity) {
      return res.status(400).json({ message: "Quantity is required" });
    }

    const cartItem = await Cart.findById(id);
    if (!cartItem) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    cartItem.pro_quantity = pro_quantity;
    cartItem.Total_price = cartItem.pro_quantity * cartItem.pro_price;
    await cartItem.save();

    res.status(200).json(cartItem);
  } catch (error) {
    console.error("Error updating cart item:", error);
    res.status(500).json({ message: "Error updating cart item" });
  }
};

// Xóa sản phẩm khỏi giỏ hàng
const deleteCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Cart.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    res.status(200).json({ message: "Cart item removed" });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    res.status(500).json({ message: "Error deleting cart item" });
  }
};

module.exports = {
  getAllCartItems,
  getCartItemById,
  createCartItem,
  updateCartItem,
  deleteCartItem,
};
