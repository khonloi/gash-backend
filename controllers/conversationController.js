const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

exports.getList = async (req, res) => {
    try {
        const { status, accountId, staffId } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (accountId) filter.accountId = accountId;
        if (staffId) filter.staffId = staffId;

        const conversations = await Conversations.find(filter).sort({ updatedAt: -1 });
        res.json({ success: true, data: conversations });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getDetail = async (req, res) => {
    try {
        const conversation = await Conversations.findById(req.params.id);
        const messages = await Messages.find({ conversationId: req.params.id }).sort({ createdAt: 1 });

        if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

        res.json({ success: true, conversation, messages });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.close = async (req, res) => {
    try {
        const conversation = await Conversations.findByIdAndUpdate(
            req.params.id,
            { status: 'closed' },
            { new: true }
        );
        res.json({ success: true, data: conversation });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { accountId, staffId } = req.body;

        if (!accountId) {
            return res.status(400).json({ success: false, message: 'accountId is required' });
        }

        const conversation = await Conversations.create({
            accountId,
            staffId: staffId || null,
            status: 'open',
        });

        res.status(201).json({ success: true, data: conversation });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.take = async (req, res) => {
    try {
        const { staffId } = req.body;
        const convo = await Conversations.findOneAndUpdate(
            { _id: req.params.id, status: 'open' },
            { staffId, status: 'pending' },
            { new: true }
        );
        if (!convo) {
            return res.status(400).json({ success: false, message: 'Conversation đã nhận/đóng' });
        }
        res.json({ success: true, data: convo });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
