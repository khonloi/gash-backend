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
      ref: "newProducts",
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
    pinBy: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      default: null,
    },
    unpinBy: {
      type: Schema.Types.ObjectId,
      ref: 'Accounts',
      default: null,
    },
  }
);

module.exports = mongoose.model("LiveProduct", LiveProductSchema);
