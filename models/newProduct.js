const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const newProductSchema = new Schema({
  productName: {
    type: String,
    required: true,
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Categories",
    required: true,
  },
  productImageIds: [
    {
      type: Schema.Types.ObjectId,
      ref: "newProductImages",
    },
  ],
  description: {
    type: String,
    required: true,
  },
  productStatus: {
    type: String,
    enum: ["active", "inactive", "pending", "discontinued"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update updatedAt timestamp before saving
newProductSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("newProducts", newProductSchema);
