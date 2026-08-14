const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LiveReactionSchema = new Schema(
    {
        liveId: {
            type: Schema.Types.ObjectId,
            ref: "Livestream",
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "Accounts",
            required: true,
        },
        reactionType: {
            type: String,
            enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        }
    }
);

// Index for faster queries
LiveReactionSchema.index({ liveId: 1 });
LiveReactionSchema.index({ liveId: 1, userId: 1 }); // Index for querying user reactions

module.exports = mongoose.model("LiveReaction", LiveReactionSchema);

