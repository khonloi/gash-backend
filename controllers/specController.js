const specService = require('../services/specService');

// --- Product Colors ---
exports.createProductColor = async (req, res) => {
  try {
    const savedColor = await specService.createProductColorService(req.body);
    res.status(201).json({ message: 'Product color created successfully', color: savedColor });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error creating product color' });
  }
};
exports.getAllProductColors = async (req, res) => {
  try {
    const colors = await specService.getAllProductColorsService();
    res.status(200).json(colors);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving product colors' });
  }
};
exports.getProductColorById = async (req, res) => {
  try {
    const color = await specService.getProductColorByIdService(req.params.id);
    res.status(200).json(color);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving product color' });
  }
};
exports.updateProductColor = async (req, res) => {
  try {
    const color = await specService.updateProductColorService(req.params.id, req.body);
    res.status(200).json({ message: 'Product color updated successfully', color });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating product color' });
  }
};
exports.deleteProductColor = async (req, res) => {
  try {
    const result = await specService.deleteProductColorService(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error deleting product color' });
  }
};

// --- Product Sizes ---
exports.createProductSize = async (req, res) => {
  try {
    const savedSize = await specService.createProductSizeService(req.body);
    res.status(201).json({ message: 'Product size created successfully', size: savedSize });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error creating product size' });
  }
};
exports.getAllProductSizes = async (req, res) => {
  try {
    const sizes = await specService.getAllProductSizesService();
    res.status(200).json(sizes);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving product sizes' });
  }
};
exports.getProductSizeById = async (req, res) => {
  try {
    const size = await specService.getProductSizeByIdService(req.params.id);
    res.status(200).json(size);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error retrieving product size' });
  }
};
exports.updateProductSize = async (req, res) => {
  try {
    const size = await specService.updateProductSizeService(req.params.id, req.body);
    res.status(200).json({ message: 'Product size updated successfully', size });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error updating product size' });
  }
};
exports.deleteProductSize = async (req, res) => {
  try {
    const result = await specService.deleteProductSizeService(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Error deleting product size' });
  }
};
