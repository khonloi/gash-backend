const mongoose = require('mongoose');

const livestreamSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accounts',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['live', 'ended', 'scheduled'],
    default: 'live'
  },
  roomName: {
    type: String,
    unique: true,
    sparse: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  peakViewers: {
    type: Number,
    default: 0,
    min: 0
  },
  minViewers: {
    type: Number,
    default: 0,
    min: 0
  },
  liveProductIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveProduct'
  }],
  liveCommentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveComment'
  }]
}, {
  timestamps: true
});

// Indexes for better performance
livestreamSchema.index({ hostId: 1 });
livestreamSchema.index({ status: 1 });
livestreamSchema.index({ startTime: -1 });
livestreamSchema.index({ roomName: 1 });

// Compound indexes for common query patterns
livestreamSchema.index({ hostId: 1, status: 1 }); // For getHostLivestreams (hostId + status)
livestreamSchema.index({ status: 1, startTime: -1 }); // For getAllLive and getLiveNow (status + sort)

module.exports = mongoose.model('Livestream', livestreamSchema);