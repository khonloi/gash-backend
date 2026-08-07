const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const newProductVariantSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'newProducts',
      required: true,
    },
    productColorId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductColors',
      required: true,
    },
    productSizeId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductSizes',
      required: true,
    },
    variantImage: {
      type: String,
      required: true,
    },
    variantPrice: {
      type: Number,
      required: true,
      min: [0, 'Variant price cannot be negative'],
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: [0, 'Stock quantity cannot be negative'],
    },
    variantStatus: {
      type: String,
      enum: ['active', 'inactive', 'discontinued'],
      default: 'active',
    },
  },
  {
    // Replaces manual createdAt/updatedAt fields and the pre('save') updatedAt hook.
    // Mongoose timestamps: true also correctly updates updatedAt on findOneAndUpdate()
    // which the old pre('save') hook missed entirely.
    timestamps: true,
  }
);

// ===== Indexes =====
// All variants for a product (product detail page)
newProductVariantSchema.index({ productId: 1 });

// Active variants for a product (add to cart, inventory)
newProductVariantSchema.index({ productId: 1, variantStatus: 1 });

// Checkout race condition fix uses findOneAndUpdate with _id — covered by default _id index.
// Stock availability check: find active variants with stock
newProductVariantSchema.index({ variantStatus: 1, stockQuantity: 1 });

module.exports = mongoose.model('newProductVariants', newProductVariantSchema);