import express, { Request, Response, NextFunction } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  searchProducts,
  updateProduct,
  deleteProduct,
  addProductImage,
  deleteProductImage
} from '../controllers/productController.js';
import { authenticateJWT, authorizeRole, optionalAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createProductSchema,
  updateProductSchema,
  addProductImageSchema
} from '../validations/productValidation.js';

const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.endsWith('/') && req.path !== '/') {
    return res.redirect(301, req.path.slice(0, -1));
  }
  next();
});

// Create a new product (restricted to manager/admin)
router.post(
  '/',
  authenticateJWT,
  authorizeRole(['manager', 'admin']),
  validateRequest(createProductSchema),
  createProduct
);

// Get all products (accessible to public, optional auth for role-based visibility)
router.get(
  '/',
  optionalAuth,
  getAllProducts
);

// Search products by name and status (accessible to public, optional auth for role-based visibility)
router.get(
  '/search',
  optionalAuth,
  searchProducts
);

// Get a single product by ID (accessible to public, optional auth for role-based visibility)
router.get(
  '/:id',
  optionalAuth,
  getProductById
);

// Update a product (restricted to manager/admin)
router.put(
  '/:id',
  authenticateJWT,
  authorizeRole(['manager', 'admin']),
  validateRequest(updateProductSchema),
  updateProduct
);

// Soft delete a product (restricted to manager/admin)
router.delete(
  '/:id',
  authenticateJWT,
  authorizeRole(['manager', 'admin']),
  deleteProduct
);

// Add a product image (restricted to manager/admin)
router.post(
  '/:id/images',
  authenticateJWT,
  authorizeRole(['manager', 'admin']),
  validateRequest(addProductImageSchema),
  addProductImage
);

// Delete a product image (restricted to manager/admin)
router.delete(
  '/:id/images/:imageId',
  authenticateJWT,
  authorizeRole(['manager', 'admin']),
  deleteProductImage
);

export default router;
