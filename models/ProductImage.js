const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductImageSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Products'
  },
  imageUrl: {
    type: String,
    required: true
  },
  isMain: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});



module.exports = mongoose.model('ProductImages', ProductImageSchema);