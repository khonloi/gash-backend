const mongoose = require('mongoose');
const Conversations = require('../models/Conversation');
const Messages = require('../models/Message');

exports.getListService = async (query) => {
  const { status, accountId, isAdmin } = query;
  const filter = {};
  
  if (status) {
    filter.status = status;
  } else {
    filter.status = { $ne: 'closed' };
  }
  
  if (accountId && mongoose.isValidObjectId(accountId)) {
    filter.accountId = new mongoose.Types.ObjectId(accountId);
  }
  
  const pipeline = [
    { $match: filter },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: "$accountId", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
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
    { $match: { "lastMsgArray.0": { $exists: true } } },
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
    { $lookup: {
        from: "accounts",
        localField: "accountId",
        foreignField: "_id",
        as: "accountIdArray"
      }
    },
    { $lookup: {
        from: "accounts",
        localField: "staffId",
        foreignField: "_id",
        as: "staffIdArray"
      }
    },
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
    { $project: {
        "accountId.password": 0,
        "staffId.password": 0
      }
    },
    { $sort: { updatedAt: -1 } }
  ];

  const result = await Conversations.aggregate(pipeline);

  return result.map(convo => {
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
};

exports.getDetailService = async (id) => {
  const conversation = await Conversations.findById(id)
    .populate('accountId', 'username email')
    .populate('staffId', 'username email');

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const messages = await Messages.find({ conversationId: id }).sort({ createdAt: 1 });
  return { conversation, messages };
};

exports.closeService = async (id) => {
  const conversation = await Conversations.findById(id);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return await Conversations.findByIdAndUpdate(
    id,
    { status: 'closed' },
    { new: true }
  );
};

exports.createService = async (accountId, staffId) => {
  let conversation = await Conversations.findOne({
    accountId,
    status: { $in: ['open', 'pending'] },
  });

  if (conversation) {
    conversation.updatedAt = new Date();
    await conversation.save();
  } else {
    conversation = await Conversations.create({
      accountId,
      staffId: staffId || null,
      status: 'open',
    });
  }
  return conversation;
};

exports.takeService = async (id, staffId) => {
  const convo = await Conversations.findOneAndUpdate(
    { _id: id, status: 'open', staffId: null },
    { staffId, status: 'pending' },
    { new: true }
  );

  if (!convo) {
    throw new Error('Conversation already taken or closed');
  }
  return convo;
};
