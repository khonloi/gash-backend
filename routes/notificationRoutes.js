const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");

// ====================== USER ROUTES ======================
router.get("/user/:userId", notificationController.getUserNotifications);
router.put("/mark-read/:id", notificationController.markAsRead);
router.delete("/clear/:userId", notificationController.clearAll);

// 🆕 USER XOÁ 1 THÔNG BÁO CỤ THỂ
router.delete("/user/:userId/:id", notificationController.deleteUserNotification);

// ====================== ADMIN ROUTES ======================
router.post("/admin/create", notificationController.createNotification);
router.get("/admin/all", notificationController.getAllNotifications);
router.delete("/admin/:id", notificationController.deleteNotification);
// 🧩 Edit an existing notification
router.patch("/admin/:id", notificationController.updateNotification);

// ====================== 🆕 BỔ SUNG THÊM CHO LINH HOẠT ======================

// 🧩 Gửi thông báo cho TẤT CẢ USER (broadcast)
router.post(
  "/admin/broadcast",
  async (req, res, next) => {
    req.body.recipientType = "all";
    next();
  },
  notificationController.createNotification
);

// 🧩 Gửi thông báo cho 1 USER CỤ THỂ bằng userId trong URL
router.post(
  "/admin/send/:userId",
  async (req, res, next) => {
    req.body.recipientType = "specific";
    req.body.userId = req.params.userId;
    next();
  },
  notificationController.createNotification
);

// ====================== 🆕 TEMPLATE MANAGEMENT ======================
router.get("/admin/templates", notificationController.getAllTemplates);
router.post("/admin/templates", notificationController.createTemplate);
router.patch("/admin/templates/:id", notificationController.updateTemplate);
router.delete("/admin/templates/:id", notificationController.deleteTemplate);
router.get("/preferences/:userId", notificationController.getUserPreferences);
router.put("/preferences/:userId", notificationController.updateUserPreferences);

module.exports = router;
