const mongoose = require('mongoose');
const Task = require('../models/Task');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-manager';

const sampleTasks = [
  {
    description: 'Complete project documentation',
    creator: '+1234567890',
    assignees: ['+1234567890', '+9876543210'],
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    notes: 'Include API documentation and setup instructions',
    status: 'OPEN'
  },
  {
    description: 'Review pull requests',
    creator: '+9876543210',
    assignees: ['+1234567890'],
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    notes: 'Check code quality and test coverage',
    status: 'OPEN'
  },
  {
    description: 'Deploy to production',
    creator: '+1234567890',
    assignees: ['+9876543210', '+1122334455'],
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    notes: 'Follow deployment checklist',
    status: 'COMPLETED',
    completedAt: new Date()
  }
];

async function initializeDb() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing tasks
    await Task.deleteMany({});
    console.log('Cleared existing tasks');

    // Insert sample tasks
    await Task.insertMany(sampleTasks);
    console.log('Inserted sample tasks');

    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the initialization
initializeDb(); 