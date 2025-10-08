const mongoose = require("mongoose");

const newCartSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accounts", // Reference to Accounts collection/model
      required: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "newProductVariants", // Reference to newProductVariants collection/model
      required: true,
    },
    productQuantity: {
      type: String,
      required: true,
    },
    productPrice: {
      type: Number,
      required: true,
    },
    selected: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Adds createdAt/updatedAt for tracking
  }
);

module.exports = mongoose.model("NewCart", newCartSchema);
