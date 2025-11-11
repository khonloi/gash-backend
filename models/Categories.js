const mongoose = require('mongoose');

const CategoriesSchema = new mongoose.Schema({
  cat_name: {
    type: String,
    required: [true, 'Category name is required'],
    minlength: [3, 'Category name must be at least 3 characters'],
    maxlength: [30, 'Category name cannot exceed 30 characters']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound unique index: chỉ unique khi isDeleted: false
// Cho phép tạo lại category với tên đã bị xóa
CategoriesSchema.index({ cat_name: 1, isDeleted: 1 }, {
  unique: true,
  partialFilterExpression: { isDeleted: false }
});

module.exports = mongoose.model('Categories', CategoriesSchema);