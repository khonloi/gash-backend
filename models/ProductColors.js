const mongoose = require('mongoose');

const ProductColorsSchema = new mongoose.Schema({
  color_name: { 
    type: String, 
    required: [true, 'Color name is required'], 
    maxlength: [30, 'Color name cannot exceed 30 characters'] 
  }
}, {
  timestamps: true // Thêm tự động tạo createdAt và updatedAt
});

// Thêm index cho color_name để tăng tốc độ tìm kiếm
ProductColorsSchema.index({ color_name: 1 });

module.exports = mongoose.model('ProductColors', ProductColorsSchema);