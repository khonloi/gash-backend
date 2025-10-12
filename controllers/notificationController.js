const Notification = require("../models/Notification");

// 🧩 User: Lấy thông báo của chính mình
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.params.userId;
    const notifications = await Notification.find({
      $or: [{ userId }, { userId: null }], // user riêng + thông báo chung
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    console.error("❌ Lỗi getUserNotifications:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧩 User: Đánh dấu đã đọc
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error("❌ Lỗi markAsRead:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧩 User: Xóa tất cả thông báo
exports.clearAll = async (req, res) => {
  try {
    const userId = req.params.userId;
    await Notification.deleteMany({ userId });
    res.json({ message: "Cleared all notifications" });
  } catch (error) {
    console.error("❌ Lỗi clearAll:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧩 Admin: Gửi thông báo (cho 1 người hoặc tất cả)
exports.createNotification = async (req, res) => {
  try {
    console.log("📩 Body FE gửi lên:", req.body);

    const { title, message, userId, type } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Thiếu tiêu đề hoặc nội dung!" });
    }

    const notification = new Notification({
      title,
      message,
      userId: userId && userId !== "" ? userId : null,
      type: type && ["system", "order", "promotion"].includes(type)
        ? type
        : "system",
    });

    await notification.save();
    console.log("✅ Đã lưu thông báo:", notification);
    res.status(201).json(notification);
  } catch (error) {
    console.error("❌ Lỗi khi tạo notification:");
    console.error(error); // 👈 in toàn bộ lỗi chi tiết
    res.status(500).json({ error: error.message, full: error });
  }
};


// 🧩 Admin: Xem tất cả thông báo đã gửi
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error("❌ Lỗi getAllNotifications:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🧩 Admin: Xóa thông báo cụ thể
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("❌ Lỗi deleteNotification:", error);
    res.status(500).json({ error: error.message });
  }
};