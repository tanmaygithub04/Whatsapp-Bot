// services/taskService.js
const Task = require('../models/Task');
const whatsappService = require('./whatsappService');
const { formatPhoneNumber } = require('../utils/phoneNumberUtil');

// Create a new task
async function createTask(taskData) {
  try {
    // Ensure phone numbers are formatted consistently before saving
    if (taskData.creator) {
      taskData.creator = formatPhoneNumber(taskData.creator);
    }
    
    if (taskData.assignees && Array.isArray(taskData.assignees)) {
      taskData.assignees = taskData.assignees.map(assignee => formatPhoneNumber(assignee));
    }
    
    const task = new Task(taskData);
    await task.save();
    
    // We'll let the notificationService handle sending messages
    // as per the user's request - removing duplicate notifications here
    return task;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}


// Get all active (open) tasks
async function getActiveTasks() {
  return await Task.find({ status: 'OPEN' }).sort({ createdAt: -1 });
}

// Get tasks for specific assignee
async function getTasksForAssignee(assignee) {
  // Format phone number before querying
  const formattedAssignee = formatPhoneNumber(assignee);
  return await Task.find({ 
    assignees: formattedAssignee,
    status: 'OPEN'
  }).sort({ dueDate: 1, createdAt: -1 });
}

// Get tasks for multiple assignees
async function getTasksForMultipleAssignees(assignees) {
  // Format all phone numbers before querying
  const formattedAssignees = assignees.map(assignee => formatPhoneNumber(assignee));
  return await Task.find({ 
    assignees: { $in: formattedAssignees },
    status: 'OPEN'
  }).sort({ dueDate: 1, createdAt: -1 });
}

// Get all tasks for a specific user (as creator or assignee), regardless of status
async function getTasksForUser(phone) {
  // Format phone number before querying
  const formattedPhone = formatPhoneNumber(phone);
  return await Task.find({
    $or: [
      { creator: formattedPhone },
      { assignees: formattedPhone }
    ]
  }).sort({ dueDate: 1, createdAt: -1 });
}

// Get only active tasks for a specific user (as creator or assignee)
async function getActiveTasksForUser(phone) {
  // Format phone number before querying
  const formattedPhone = formatPhoneNumber(phone);
  return await Task.find({
    $or: [
      { creator: formattedPhone },
      { assignees: formattedPhone }
    ],
    status: 'OPEN'
  }).sort({ dueDate: 1, createdAt: -1 });
}

// Get a single task by ID
async function getTaskById(id) {
  return await Task.findById(id);
}

// Update a task
async function updateTask(id, updateData) {
  // Format phone numbers in update data if present
  if (updateData.creator) {
    updateData.creator = formatPhoneNumber(updateData.creator);
  }
  
  if (updateData.assignees && Array.isArray(updateData.assignees)) {
    updateData.assignees = updateData.assignees.map(assignee => formatPhoneNumber(assignee));
  }
  
  return await Task.findByIdAndUpdate(id, updateData, { new: true });
}

// Delete a task
async function deleteTask(id) {
  return await Task.findByIdAndDelete(id);
}

// Mark task as completed (inactive)
async function completeTask(taskId, completedBy) {
  try {
    // Format the completedBy phone number
    const formattedCompletedBy = formatPhoneNumber(completedBy);
    
    const task = await Task.findById(taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    if (formattedCompletedBy && !task.assignees.includes(formattedCompletedBy) && task.creator !== formattedCompletedBy) {
      throw new Error('Not authorized to complete this task');
    }

    if (task.status === 'COMPLETED') {
      return task; // Already completed
    }
    
    // Mark task as completed (inactive)
    task.status = 'COMPLETED';
    task.completedAt = new Date();
    await task.save();
    
    return task;
  } catch (error) {
    console.error('Error completing task:', error);
    throw error;
  }
}

// Reopen a task that was previously completed
async function reopenTask(taskId, reopenedBy) {
  try {
    // Format the reopenedBy phone number
    const formattedReopenedBy = formatPhoneNumber(reopenedBy);
    
    const task = await Task.findById(taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    if (formattedReopenedBy && !task.assignees.includes(formattedReopenedBy) && task.creator !== formattedReopenedBy) {
      throw new Error('Not authorized to reopen this task');
    }

    if (task.status === 'OPEN') {
      return task; // Already open
    }
    
    // Mark task as open
    task.status = 'OPEN';
    task.completedAt = null;
    await task.save();
    
    return task;
  } catch (error) {
    console.error('Error reopening task:', error);
    throw error;
  }
}

// Update task notes
async function updateTaskNotes(taskId, notes, updatedBy) {
  try {
    // Format the updatedBy phone number
    const formattedUpdatedBy = formatPhoneNumber(updatedBy);
    
    const task = await Task.findById(taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }
    
    if (formattedUpdatedBy && !task.assignees.includes(formattedUpdatedBy) && task.creator !== formattedUpdatedBy) {
      throw new Error('Not authorized to update notes for this task');
    }
    
    // Update the notes
    task.notes = notes;
    await task.save();
    
    return task;
  } catch (error) {
    console.error('Error updating task notes:', error);
    throw error;
  }
}

// Check if user is authorized for task operations
async function isUserAuthorizedForTask(taskId, phone) {
  const formattedPhone = formatPhoneNumber(phone);
  const task = await Task.findById(taskId);
  
  if (!task) {
    return { authorized: false, error: 'Task not found', statusCode: 404 };
  }
  
  if (task.creator !== formattedPhone && !task.assignees.includes(formattedPhone)) {
    return { 
      authorized: false, 
      error: 'Unauthorized: Only the task creator or assignees can perform this action',
      statusCode: 403
    };
  }
  
  return { authorized: true, task };
}

module.exports = {
  createTask,
  getActiveTasks,
  getTasksForAssignee,
  getTasksForMultipleAssignees,
  getTasksForUser,
  getActiveTasksForUser,
  getTaskById,
  updateTask,
  deleteTask,
  completeTask,
  reopenTask,
  updateTaskNotes,
  isUserAuthorizedForTask
};