// conversationController.js

const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

// Get conversation list
exports.getList = async (req, res) => {
  try {
    const { status, accountId, isAdmin } = req.query;
    const filter = {};
    
    // Exclude closed conversations unless explicitly requested
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'closed' };
    }
    
    // Convert to ObjectId for aggregation $match
    const mongoose = require('mongoose');
    if (accountId && mongoose.isValidObjectId(accountId)) {
      filter.accountId = new mongoose.Types.ObjectId(accountId);
    }
    
    const pipeline = [
      { $match: filter },
      // Sort by updatedAt descending to keep the most recent conversation first when grouping
      { $sort: { updatedAt: -1 } },
      
      // Deduplicate to keep only 1 conversation per accountId (the latest one due to sort)
      { $group: {
          _id: "$accountId",
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      
      // Lookup the last message for the conversation
      { $lookup: {
          from: "messages",
          let: { convoId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$conversationId", "$$convoId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastMsgArray"
        }
      },
      
      // ONLY CONVERSATIONS THAT HAVE AT LEAST ONE MESSAGE
      { $match: { "lastMsgArray.0": { $exists: true } } },
      
      // Lookup unread messages (senderId = accountId, isRead = false)
      { $lookup: {
          from: "messages",
          let: { convoId: "$_id", accId: "$accountId" },
          pipeline: [
            { $match: {
                $expr: {
                  $and: [
                    { $eq: ["$conversationId", "$$convoId"] },
                    { $eq: ["$senderId", "$$accId"] },
                    { $eq: ["$isRead", false] }
                  ]
                }
              }
            },
            { $count: "count" }
          ],
          as: "unreadArray"
        }
      },
      
      // Populate accountId
      { $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountIdArray"
        }
      },
      
      // Populate staffId
      { $lookup: {
          from: "accounts",
          localField: "staffId",
          foreignField: "_id",
          as: "staffIdArray"
        }
      },
      
      // Final projection to format the output exactly as before
      { $project: {
          _id: 1,
          accountId: { $arrayElemAt: ["$accountIdArray", 0] },
          staffId: { $arrayElemAt: ["$staffIdArray", 0] },
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          
          lastMessage: {
            $let: {
              vars: { lastMsg: { $arrayElemAt: ["$lastMsgArray", 0] } },
              in: {
                $cond: {
                  if: { $not: ["$$lastMsg"] },
                  then: "No message",
                  else: {
                    $cond: {
                      if: "$$lastMsg.messageText",
                      then: "$$lastMsg.messageText",
                      else: {
                        $cond: {
                          if: { $eq: ["$$lastMsg.type", "image"] },
                          then: "Image",
                          else: "Media"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          
          unreadCount: {
            $let: {
              vars: { unread: { $arrayElemAt: ["$unreadArray", 0] } },
              in: { $ifNull: ["$$unread.count", 0] }
            }
          }
        }
      },
      
      // Ensure specific fields from populated accounts are returned (username, email)
      { $project: {
          "accountId.password": 0,
          "staffId.password": 0
        }
      },
      
      // Final sort since $group messes up the original sort order
      { $sort: { updatedAt: -1 } }
    ];

    const result = await Conversations.aggregate(pipeline);

    // Format the populated account arrays to objects with only _id, username, email
    const formattedResult = result.map(convo => {
      if (convo.accountId) {
        convo.accountId = {
          _id: convo.accountId._id,
          username: convo.accountId.username,
          email: convo.accountId.email
        };
      }
      if (convo.staffId) {
        convo.staffId = {
          _id: convo.staffId._id,
          username: convo.staffId.username,
          email: convo.staffId.email
        };
      }
      return convo;
    });

    res.json({ success: true, data: formattedResult });
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