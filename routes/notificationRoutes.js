const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// ===== USER =====
router.get("/user/:userId", notificationController.getUserNotifications);
router.put("/mark-read/:id", notificationController.markAsRead);
router.delete("/clear/:userId", notificationController.clearAll);

// ===== ADMIN =====
router.post("/admin/create", notificationController.createNotification);
router.get("/admin/all", notificationController.getAllNotifications);
router.delete("/admin/:id", notificationController.deleteNotification);

module.exports = router;