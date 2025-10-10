const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LivestreamSchema = new Schema(
  {
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      required: true,
    },
    rtmpUrl: {
      type: String,
    },
    streamUrl: {
      type: String,
    },
    peakViewers: {
      type: Number,
      default: 0,
    },
    minViewers: {
      type: Number,
      default: 0,
    },
    totalViewers: {
      type: Number,
      default: 0,
    },
    startTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endTime: {
      type: Date,
    },
  }
);

module.exports = mongoose.model("Livestream", LivestreamSchema);
