const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LiveCommentSchema = new Schema(
  {
    liveId: {
      type: Schema.Types.ObjectId,
      ref: "Livestream",
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      required: true,
    },
    commentText: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      default: null
    },
    isPinned: {
      type: Boolean,
      default: false
    }
  }
);

// Indexes for better query performance
LiveCommentSchema.index({ liveId: 1, isDeleted: 1, createdAt: -1 }); // Main query
LiveCommentSchema.index({ liveId: 1, isPinned: -1, createdAt: -1 }); // Pinned comments query
LiveCommentSchema.index({ liveId: 1, isDeleted: 1 }); // Admin query

module.exports = mongoose.model("LiveComment", LiveCommentSchema);
