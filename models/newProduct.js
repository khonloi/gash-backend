const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const newProductSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Categories',
      required: true,
    },
    productImageIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'newProductImages',
      },
    ],
    productVariantIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'newProductVariants',
      },
    ],
    description: {
      type: String,
      required: true,
    },
    productStatus: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'discontinued'],
      default: 'pending',
    },
  },
  {
    // timestamps: true replaces the manual createdAt/updatedAt fields
    // and the pre('save') hook that set updatedAt — Mongoose manages these automatically,
    // including on findOneAndUpdate() calls (with { timestamps: true } option).
    timestamps: true,
  }
);

// ===== Indexes =====
// Category page: list all products in a category
newProductSchema.index({ categoryId: 1 });

// Admin product list: filter by status
newProductSchema.index({ productStatus: 1 });

// Text search on product name (supports $regex queries efficiently)
newProductSchema.index({ productName: 1 });

// Compound: category + status (most common catalog query)
newProductSchema.index({ categoryId: 1, productStatus: 1 });

module.exports = mongoose.model('newProducts', newProductSchema);