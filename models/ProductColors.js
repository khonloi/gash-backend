const mongoose = require('mongoose');

const ProductColorsSchema = new mongoose.Schema({
  productColorName: {
    type: String,
    required: [true, 'Color name is required'],
    minlength: [2, 'Color name must be at least 2 characters'],
    maxlength: [30, 'Color name cannot exceed 30 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add index on productColorName for faster lookups
ProductColorsSchema.index({ productColorName: 1 });

module.exports = mongoose.model('ProductColors', ProductColorsSchema);