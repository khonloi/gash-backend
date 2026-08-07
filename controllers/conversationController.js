// conversationController.js

const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

// Get conversation list
exports.getList = async (req, res) => {
  try {
    const { status, accountId, staffId, isAdmin } = req.query;
    const filter = {};
    
    // Exclude closed conversations unless explicitly requested
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'closed' };
    }
    
    if (accountId) filter.accountId = accountId;
    
    // CHANGED: Removed staff-specific filtering to allow all staff to view all conversations
    // Previously, non-admins with staffId only saw their assigned or open conversations
    // Now, if isAdmin or staffId provided, show all (admins and staff see everything)
    // If neither, still applies general filter, but in practice, staff provide staffId
    if (isAdmin === 'true' || isAdmin === true) {
      // Admin can see all conversations - no staff filtering needed
    } // Removed else if (staffId) block that added restrictive $or filter

    // ---- ONLY CONVERSATIONS THAT HAVE AT LEAST ONE MESSAGE ----
    const conversationsWithMsg = await Messages.distinct('conversationId');
    filter._id = { $in: conversationsWithMsg };

    const conversations = await Conversations.find(filter)
      .populate('accountId', 'username email')
      .populate('staffId', 'username email')
      .sort({ updatedAt: -1 });

    // Deduplicate to keep only 1 conversation per accountId
    const uniqueMap = new Map();
    for (const convo of conversations) {
      const accId = convo.accountId?._id?.toString() || convo.accountId?.toString();
      if (!uniqueMap.has(accId)) uniqueMap.set(accId, convo);
    }
    const result = Array.from(uniqueMap.values());

    // Compute lastMessage and unreadCount reliably
    for (const convo of result) {
      const lastMsg = await Messages.findOne({ conversationId: convo._id }).sort({ createdAt: -1 });
      convo.lastMessage = lastMsg 
        ? (lastMsg.messageText || (lastMsg.type === 'image' ? 'Image' : 'Media'))
        : 'No message';

      convo.unreadCount = await Messages.countDocuments({
        conversationId: convo._id,
        senderId: convo.accountId._id,  // Use populated _id
        isRead: false
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('getList error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get details + messages
exports.getDetail = async (req, res) => {
  try {
    const { staffId } = req.query;
    if (!staffId) {
      return res.status(400).json({ success: false, message: 'staffId is required in query' });
    }

    let conversation = await Conversations.findById(req.params.id)
      .populate('accountId', 'username email')
      .populate('staffId', 'username email');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // CHANGED: Removed authorization check to allow any staff to access any conversation
    // Previously: if (convoStaffId && convoStaffId !== staffId) { forbid }

    // CHANGED: Removed auto-assignment for open conversations
    // Previously: if open and no staff, assign to this staff and set to pending
    // Now: No auto-assignment; any staff can view without claiming

    const messages = await Messages.find({ conversationId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, conversation, messages });
  } catch (err) {
    console.error('getDetail error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Close conversation
exports.close = async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) {
      return res.status(400).json({ success: false, message: 'staffId is required in body' });
    }

    const conversation = await Conversations.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // CHANGED: Removed authorization check to allow any staff to close any conversation
    // Previously: if (convoStaffId !== staffId) { forbid }

    const updatedConversation = await Conversations.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    );
    res.json({ success: true, data: updatedConversation });
  } catch (err) {
    console.error('close error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create or retrieve existing conversation (prevents duplicates when user chats again)
exports.create = async (req, res) => {
  try {
    const { accountId, staffId } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }

    // Find existing conversation that is open or pending
    let conversation = await Conversations.findOne({
      accountId,
      status: { $in: ['open', 'pending'] },
    });

    // If existing, update timestamp for sorting
    if (conversation) {
      conversation.updatedAt = new Date();
      await conversation.save();
    } else {
      // None exists -> create new
      conversation = await Conversations.create({
        accountId,
        staffId: staffId || null,
        status: 'open',
      });
    }

    res.status(201).json({ success: true, data: conversation });
  } catch (err) {
    console.error('create error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Staff claim conversation
exports.take = async (req, res) => {
  try {
    const { staffId } = req.body;
    const convo = await Conversations.findOneAndUpdate(
      { _id: req.params.id, status: 'open', staffId: null },
      { staffId, status: 'pending' },
      { new: true }
    );

    if (!convo) {
      return res.status(400).json({ success: false, message: 'Conversation already taken or closed' });
    }

    res.json({ success: true, data: convo });
  } catch (err) {
    console.error('take error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};