const mongoose = require('mongoose');

const ProductColorsSchema = new mongoose.Schema({
  color_name: {
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

// Thêm index cho color_name để tăng tốc độ tìm kiếm
ProductColorsSchema.index({ color_name: 1 });

module.exports = mongoose.model('ProductColors', ProductColorsSchema);