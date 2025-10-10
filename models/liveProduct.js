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
      ref: "Product",
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
  }
);

module.exports = mongoose.model("LiveProduct", LiveProductSchema);
