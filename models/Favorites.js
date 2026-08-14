const mongoose = require("mongoose");

const FavoritesSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Accounts",
    required: [true, "Account ID is required"],
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [true, "Product ID is required"],
  },
});

module.exports = mongoose.model("Favorites", FavoritesSchema);
