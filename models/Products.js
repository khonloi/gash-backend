const mongoose = require("mongoose");

const ProductsSchema = new mongoose.Schema({
  pro_name: {
    type: String,
    required: [true, "Product name is required"],
    maxlength: [100, "Product name cannot exceed 100 characters"],
  },
  cat_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Categories",
    required: [true, "Category ID is required"],
  },
  pro_price: {
    type: Number,
    required: [true, "Product price is required"],
    min: [0, "Price cannot be negative"],
  },
  imageURL: {
    type: String,
    validate: {
      validator: function (v) {
        return !v || /^(http|https):\/\/[^ "]+$/.test(v) || v.startsWith("/uploads/");
      },
      message: "Image URL must be a valid URL or start with /uploads/",
    },
  },
  description: {
    type: String,
    maxlength: [1000, "Description cannot exceed 1000 characters"],
  },
  status_product: {
    type: String,
    required: [true, "Product status is required"],
    enum: {
      values: ["active", "discontinued", "out_of_stock"],
      message: "Product status must be active, discontinued, or out_of_stock",
    },
  },
});

// Virtual để build full image URL
ProductsSchema.virtual("fullImageURL").get(function () {
  if (!this.imageURL) return null;
  // Nếu đã là URL đầy đủ thì return luôn
  if (this.imageURL.startsWith("http")) return this.imageURL;
  // Nếu chỉ lưu '/uploads/jeans.png'
  return `${process.env.BASE_URL || "http://localhost:5000"}${this.imageURL}`;
});

ProductsSchema.set("toJSON", { virtuals: true });
ProductsSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Products", ProductsSchema);
