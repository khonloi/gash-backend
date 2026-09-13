import { Request, Response } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import productService from '../services/productService.js';

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body);
  req.app.get('io').to('productRoom').emit('productCreated', product);
  return successResponse(res, 201, product, 'Product added successfully');
});

export const getAllProducts = asyncHandler(async (req: Request, res: Response) => {
  const filters = req.query;
  const userRole = (req as any).user?.role || 'customer';
  const products = await productService.getAllProducts(filters, userRole);
  return successResponse(res, 200, products, 'Products retrieved successfully');
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.id as string;
  const userRole = (req as any).user?.role || 'customer';
  const product = await productService.getProductById(productId, userRole);
  return successResponse(res, 200, product, 'Product retrieved successfully');
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.updateProduct(req.params.id as string, req.body);
  req.app.get('io').to('productRoom').emit('productUpdated', product);
  return successResponse(res, 200, product, 'Product updated successfully');
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.id as string);
  req.app.get('io').to('productRoom').emit('productDeleted', req.params.id);
  return successResponse(res, 200, null, 'Product discontinued successfully');
});

export const addProductImage = asyncHandler(async (req: Request, res: Response) => {
  const image = await productService.addProductImage(req.params.id as string, req.body);
  req.app.get('io').to('productRoom').emit('productImageAdded', { productId: req.params.id, image });
  return successResponse(res, 201, image, 'Product image added successfully');
});

export const deleteProductImage = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProductImage(req.params.id as string, req.params.imageId as string);
  req.app.get('io').to('productRoom').emit('productImageDeleted', { productId: req.params.id, imageId: req.params.imageId });
  return successResponse(res, 200, null, 'Product image deleted successfully');
});

export const searchProducts = asyncHandler(async (req: Request, res: Response) => {
  const searchParams = req.query;
  const userRole = (req as any).user?.role || 'customer';
  const products = await productService.searchProducts(searchParams, userRole);
  return successResponse(res, 200, products, 'Products searched successfully');
});
