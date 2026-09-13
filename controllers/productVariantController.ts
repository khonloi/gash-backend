import { Request, Response } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import productVariantService from '../services/productVariantService.js';

export const createProductVariant = asyncHandler(async (req: Request, res: Response) => {
  const result = await productVariantService.createVariant(req.body);
  const variant = result.variant;
  const wasUpdated = result.wasUpdated;

  if (wasUpdated) {
    req.app.get('io').to('variantRoom').emit('variantUpdated', variant);
    return successResponse(
      res, 200, variant,
      `Product variant updated successfully. Stock quantity: ${result.oldStockQuantity} + ${req.body.stockQuantity} = ${result.newStockQuantity}`
    );
  } else {
    req.app.get('io').to('variantRoom').emit('variantCreated', variant);
    return successResponse(res, 201, variant, 'Product variant added successfully');
  }
});

export const getAllProductVariants = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query;
  const variants = await productVariantService.getAllVariants(filters);
  return successResponse(res, 200, variants, 'Product variants retrieved successfully');
});

export const getProductVariantById = asyncHandler(async (req: Request, res: Response) => {
  const variant = await productVariantService.getVariantById(req.params.id as string);
  return successResponse(res, 200, variant, 'Product variant retrieved successfully');
});

export const updateProductVariant = asyncHandler(async (req: Request, res: Response) => {
  const variant = await productVariantService.updateVariant(req.params.id as string, req.body);
  req.app.get('io').to('variantRoom').emit('variantUpdated', variant);
  return successResponse(res, 200, variant, 'Product variant edited successfully');
});

export const deleteProductVariant = asyncHandler(async (req: Request, res: Response) => {
  await productVariantService.deleteVariant(req.params.id as string);
  req.app.get('io').to('variantRoom').emit('variantDeleted', req.params.id);
  return successResponse(res, 200, null, 'Product variant discontinued successfully');
});

export const bulkCreateProductVariants = asyncHandler(async (req: Request, res: Response) => {
  const variants = await productVariantService.bulkCreateVariants(req.body);
  variants.forEach((variant: any) => {
    req.app.get('io').to('variantRoom').emit('variantCreated', variant);
  });
  return successResponse(res, 201, variants, `${variants.length} product variant(s) created successfully`);
});
