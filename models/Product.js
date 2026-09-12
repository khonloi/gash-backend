const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [3, 'Product name must be at least 3 characters'],
    maxlength: [100, 'Product name cannot exceed 100 characters'],
    match: [/^[a-zA-ZÀ-ỹ0-9\s\-]+$/, 'Product name must contain only letters, numbers, spaces, and hyphens']
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Categories",
    required: true,
  },
  productImageIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "ProductImages",
    },
  ],
  productVariantIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "ProductVariants",
    },
  ],
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [10000, 'Description cannot exceed 10000 characters']
  },
  productStatus: {
    type: String,
    enum: ["active", "inactive", "pending", "discontinued"],
    default: "pending",
  }
}, {
  timestamps: true
});



module.exports = mongoose.model("Products", ProductSchema);