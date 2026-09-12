const mongoose = require("mongoose");

const FavoritesSchema = new mongoose.Schema({
  acc_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Accounts",
    required: [true, "Account ID is required"],
  },
  pro_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Products",
    required: [true, "Product ID is required"],
  },
});

module.exports = mongoose.model("Favorites", FavoritesSchema);
