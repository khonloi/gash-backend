const mongoose = require('mongoose');

const livestreamSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  status: {
    type: String,
    enum: ['live', 'ended', 'scheduled'],
    default: 'live'
  },
  platform: {
    type: String,
    enum: ['livekit'],
    default: 'livekit'
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
  // Simple viewer count
  currentViewers: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
livestreamSchema.index({ hostId: 1 });
livestreamSchema.index({ status: 1 });
livestreamSchema.index({ startTime: -1 });
livestreamSchema.index({ roomName: 1 });

module.exports = mongoose.model('Livestream', livestreamSchema);