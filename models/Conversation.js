const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Accounts',
            required: true,
        },
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Accounts',
            required: false,
        },
        status: {
            type: String,
            enum: ['open', 'pending', 'closed'],
            default: 'open',
        },
    },
    { timestamps: true }
);

// Format JSON trả về
ConversationSchema.set('toJSON', {
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

module.exports = mongoose.model('Conversations', ConversationSchema);
