const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productImageSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product'
  },
  imageUrl: {
    type: String,
    required: true
  },
  isMain: {
    type: Boolean,
    default: false
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

// Update updatedAt field before saving
productImageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ProductImage', productImageSchema, 'productimages');