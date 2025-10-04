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
        attachments: {
            type: String,
            default: null,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Format JSON trả về
MessageSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        const ordered = { id: ret.id };
        Object.keys(ret).forEach(key => {
            if (key !== 'id') ordered[key] = ret[key];
        });
        return ordered;
    },
});

module.exports = mongoose.model('Messages', MessageSchema);
