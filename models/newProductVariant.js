const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const newProductVariantSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'newProducts',
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
    required: true
  },
  stockQuantity: {
    type: Number,
    required: true
  },
  variantStatus: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt timestamp before saving
newProductVariantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('newProductVariants', newProductVariantSchema);