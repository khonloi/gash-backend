const productVariantService = require('../services/newProductVariantService');

const createProductVariant = async (req, res) => {
  try {
    const variant = await productVariantService.createProductVariant(req.body);
    // Emit real-time event
    req.app.get('io').to('variantRoom').emit('variantCreated', variant);
    res.status(201).json({
      success: true,
      data: variant,
      message: 'Product variant created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getAllProductVariants = async (req, res) => {
  try {
    const filters = req.query;
    const variants = await productVariantService.getAllProductVariants(filters);
    res.status(200).json({
      success: true,
      data: variants,
      message: 'Product variants retrieved successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getProductVariantById = async (req, res) => {
  try {
    const variant = await productVariantService.getProductVariantById(req.params.id);
    res.status(200).json({
      success: true,
      data: variant,
      message: 'Product variant retrieved successfully'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

const updateProductVariant = async (req, res) => {
  try {
    const variant = await productVariantService.updateProductVariant(req.params.id, req.body);
    // Emit real-time event
    req.app.get('io').to('variantRoom').emit('variantUpdated', variant);
    res.status(200).json({
      success: true,
      data: variant,
      message: 'Product variant updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const deleteProductVariant = async (req, res) => {
  try {
    await productVariantService.deleteProductVariant(req.params.id);
    // Emit real-time event
    req.app.get('io').to('variantRoom').emit('variantDeleted', req.params.id);
    res.status(200).json({
      success: true,
      message: 'Product variant discontinued successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const bulkCreateProductVariants = async (req, res) => {
  try {
    const variants = await productVariantService.bulkCreateProductVariants(req.body);
    // Emit real-time events for each created variant
    variants.forEach(variant => {
      req.app.get('io').to('variantRoom').emit('variantCreated', variant);
    });
    res.status(201).json({
      success: true,
      data: variants,
      message: `${variants.length} product variant(s) created successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createProductVariant,
  getAllProductVariants,
  getProductVariantById,
  updateProductVariant,
  deleteProductVariant,
  bulkCreateProductVariants
};