const express = require("express");
const router = express.Router();
const {
    authenticateJWT,
    authorizeRole,
} = require("../middleware/authMiddleware");
const {
    createProductColor,
    getAllProductColors,
    getProductColorById,
    updateProductColor,
    deleteProductColor,
    createProductSize,
    getAllProductSizes,
    getProductSizeById,
    updateProductSize,
    deleteProductSize,
    searchSpecifications
} = require("../controllers/specificationController");


// --- Product Colors Routes ---
router.post("/create-color", authenticateJWT, authorizeRole(["admin", "manager"]), createProductColor);
router.get("/get-all-colors", getAllProductColors);
router.get("/get-color-detail/:id", getProductColorById);
router.put("/update-color/:id", authenticateJWT, authorizeRole(["admin", "manager"]), updateProductColor);
router.delete("/delete-color/:id", authenticateJWT, authorizeRole(["admin", "manager"]), deleteProductColor);

// --- Product Sizes Routes ---
router.post("/create-size", authenticateJWT, authorizeRole(["admin", "manager"]), createProductSize);
router.get("/get-all-sizes", getAllProductSizes);
router.get("/get-size-detail/:id", getProductSizeById);
router.put("/update-size/:id", authenticateJWT, authorizeRole(["admin", "manager"]), updateProductSize);
router.delete("/delete-size/:id", authenticateJWT, authorizeRole(["admin", "manager"]), deleteProductSize);

module.exports = router;

