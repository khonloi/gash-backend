const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRole } = require('../middleware/authMiddleware');
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');

router.post('/create-category', authenticateJWT, authorizeRole(['admin', 'manager']), createCategory);
router.get('/get-all-categories', getAllCategories);
router.get('/get-category-detail/:id', getCategoryById);
router.put('/update-category/:id', authenticateJWT, authorizeRole(['admin', 'manager']), updateCategory);
router.delete('/delete-category/:id', authenticateJWT, authorizeRole(['admin', 'manager']), deleteCategory);

module.exports = router;