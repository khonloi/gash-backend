const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductVariantSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Products',
    required: true
  },
  productColorId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductColors',
    required: true
  },
  productSizeId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductSizes',
    required: true
  },
  variantImage: {
    type: String,
    required: true
  },
  variantPrice: {
    type: Number,
    required: [true, 'Variant price is required'],
    min: [0, 'Variant price cannot be negative']
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative']
  },
  variantStatus: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  }
}, {
  timestamps: true
});



module.exports = mongoose.model('ProductVariants', ProductVariantSchema);