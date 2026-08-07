const mongoose = require('mongoose');

const CategoriesSchema = new mongoose.Schema({
  categoryName: {
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

// Compound unique index: unique only when isDeleted: false
// Allows recreating a category with a name that was previously deleted
CategoriesSchema.index({ categoryName: 1, isDeleted: 1 }, {
  unique: true,
  partialFilterExpression: { isDeleted: false }
});

module.exports = mongoose.model('Categories', CategoriesSchema);