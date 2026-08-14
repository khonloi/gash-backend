const mongoose = require('mongoose');

const ProductSizesSchema = new mongoose.Schema({
  productSizeName: {
    type: String,
    required: [true, 'Size name is required'],
    minlength: [1, 'Size name must be at least 1 character'],
    maxlength: [12, 'Size name cannot exceed 12 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProductSizes', ProductSizesSchema);