const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  creator: {
    type: String, // Phone number of creator
    required: true
  },
  assignees: [{
    type: String, // Phone numbers of assignees
    required: true
  }],
  dueDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['OPEN', 'COMPLETED'],
    default: 'OPEN'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  overdueNotificationSent: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Task', TaskSchema);