
const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

// 🟢 Lấy danh sách conversation
exports.getList = async (req, res) => {
  try {
    const { status, accountId, staffId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (accountId) filter.accountId = accountId;
    if (staffId) filter.staffId = staffId;

    const conversations = await Conversations.find(filter)
      .populate('accountId', 'username email')
      .populate('staffId', 'username email')
      .sort({ updatedAt: -1 });

    // ✅ Gộp mỗi accountId chỉ 1 cuộc trò chuyện
    const uniqueMap = new Map();
    for (const convo of conversations) {
      const accId = convo.accountId?._id?.toString() || convo.accountId?.toString();
      if (!uniqueMap.has(accId)) uniqueMap.set(accId, convo);
    }

    res.json({ success: true, data: Array.from(uniqueMap.values()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🟢 Lấy chi tiết + tin nhắn
exports.getDetail = async (req, res) => {
  try {
    const conversation = await Conversations.findById(req.params.id)
      .populate('accountId', 'username email')
      .populate('staffId', 'username email');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await Messages.find({ conversationId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, conversation, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🟢 Đóng conversation
exports.close = async (req, res) => {
  try {
    const conversation = await Conversations.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🟢 Tạo hoặc lấy lại conversation (user chat lại không bị tạo mới)
exports.create = async (req, res) => {
  try {
    const { accountId, staffId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }

    // ✅ Tìm hội thoại cũ còn mở hoặc pending
    let conversation = await Conversations.findOne({
      accountId,
      status: { $in: ['open', 'pending'] },
    });

    // Nếu đã có, cập nhật lại thời gian cho dễ sort
    if (conversation) {
      conversation.updatedAt = new Date();
      await conversation.save();
    } else {
      // Chưa có -> tạo mới
      conversation = await Conversations.create({
        accountId,
        staffId: staffId || null,
        status: 'open',
      });
    }

    res.status(201).json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🟢 Staff nhận conversation
exports.take = async (req, res) => {
  try {
    const { staffId } = req.body;
    const convo = await Conversations.findOneAndUpdate(
      { _id: req.params.id, status: 'open' },
      { staffId, status: 'pending' },
      { new: true }
    );

    if (!convo) {
      return res.status(400).json({ success: false, message: 'Conversation đã nhận hoặc đã đóng' });
    }

    res.json({ success: true, data: convo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

