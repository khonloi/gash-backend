const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LiveProductSchema = new Schema(
  {
    liveId: {
      type: Schema.Types.ObjectId,
      ref: "Livestream",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Products",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    removedAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    addBy: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      default: null,
    },
    removeBy: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      default: null,
    },
  }
);

// Indexes for better query performance
LiveProductSchema.index({ liveId: 1, isActive: 1 }); // Main query
LiveProductSchema.index({ liveId: 1, isPinned: -1, addedAt: -1 }); // Sorted query

module.exports = mongoose.model("LiveProduct", LiveProductSchema);
