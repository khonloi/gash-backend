const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversations',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Accounts',
      required: true,
    },
    messageText: {
      type: String,
      trim: true,
    },

    // 👉 attachments: dùng để lưu link ảnh / file upload
    attachments: {
      type: String,
      default: null,
    },

    // 👉 type: để phân biệt text / image / sticker / emoji
    type: {
      type: String,
      enum: ['text', 'image', 'sticker', 'emoji'],
      default: 'text',
    },

    // 👉 emoji/sticker URL (nếu có)
    imageUrl: {
      type: String,
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Format JSON trả về (giữ nguyên format của bạn)
MessageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;

    // sắp xếp id lên đầu
    const ordered = { id: ret.id };
    Object.keys(ret).forEach((key) => {
      if (key !== 'id') ordered[key] = ret[key];
    });
    return ordered;
  },
});

module.exports = mongoose.model('Messages', MessageSchema);