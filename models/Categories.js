const mongoose = require('mongoose');

const CategoriesSchema = new mongoose.Schema({
  cat_name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
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

module.exports = mongoose.model('Categories', CategoriesSchema);