const mongoose = require('mongoose');

const ProductSizesSchema = new mongoose.Schema({
  size_name: { type: String, required: true }
});

module.exports = mongoose.model('ProductSizes', ProductSizesSchema);