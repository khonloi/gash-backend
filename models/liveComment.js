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
      ref: "Account",
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
  }
);

module.exports = mongoose.model("LiveComment", LiveCommentSchema);
