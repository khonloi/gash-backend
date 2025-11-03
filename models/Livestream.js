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
  // Current viewer count (stored in DB)
  currentViewers: {
    type: Number,
    default: 0,
    min: 0
  },
  // Peak and minimum viewer counts (stored in DB)
  peakViewers: {
    type: Number,
    default: 0,
    min: 0
  },
  minViewers: {
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