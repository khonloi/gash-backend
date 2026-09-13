import { Request, Response } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import specificationService from '../services/specificationService.js';

// --- Product Colors ---

export const createProductColor = asyncHandler(async (req: Request, res: Response) => {
  const color = await specificationService.createColor(req.body);
  return successResponse(res, 201, color, 'Product color created successfully');
});

export const getAllProductColors = asyncHandler(async (req: Request, res: Response) => {
  const colors = await specificationService.getAllColors();
  return successResponse(res, 200, colors, 'Product colors retrieved successfully');
});

export const getProductColorById = asyncHandler(async (req: Request, res: Response) => {
  const color = await specificationService.getColorById(req.params.id as string);
  return successResponse(res, 200, color, 'Product color retrieved successfully');
});

export const updateProductColor = asyncHandler(async (req: Request, res: Response) => {
  const color = await specificationService.updateColor(req.params.id as string, req.body);
  return successResponse(res, 200, color, 'Product color updated successfully');
});

export const deleteProductColor = asyncHandler(async (req: Request, res: Response) => {
  await specificationService.deleteColor(req.params.id as string);
  return successResponse(res, 200, null, 'Product color deleted successfully');
});

// --- Product Sizes ---

export const createProductSize = asyncHandler(async (req: Request, res: Response) => {
  const size = await specificationService.createSize(req.body);
  return successResponse(res, 201, size, 'Product size created successfully');
});

export const getAllProductSizes = asyncHandler(async (req: Request, res: Response) => {
  const sizes = await specificationService.getAllSizes();
  return successResponse(res, 200, sizes, 'Product sizes retrieved successfully');
});

export const getProductSizeById = asyncHandler(async (req: Request, res: Response) => {
  const size = await specificationService.getSizeById(req.params.id as string);
  return successResponse(res, 200, size, 'Product size retrieved successfully');
});

export const updateProductSize = asyncHandler(async (req: Request, res: Response) => {
  const size = await specificationService.updateSize(req.params.id as string, req.body);
  return successResponse(res, 200, size, 'Product size updated successfully');
});

export const deleteProductSize = asyncHandler(async (req: Request, res: Response) => {
  await specificationService.deleteSize(req.params.id as string);
  return successResponse(res, 200, null, 'Product size deleted successfully');
});
