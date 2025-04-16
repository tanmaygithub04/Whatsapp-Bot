const taskService = require('../services/taskService');
const notificationService = require('../services/notificationService');
const reminderService = require('../services/reminderService');
const Task = require('../models/Task');
const whatsappService = require('../services/whatsappService');
const { formatPhoneNumber } = require('../utils/phoneNumberUtil');

/**
 * Get all tasks
 */

/**
 * Get tasks for a specific phone number (creator or assignee)
 */
exports.getTasksByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    // Use the consistent phone formatting utility
    const normalizedPhone = formatPhoneNumber(phone);
    console.log(`Looking for tasks with phone: ${normalizedPhone}`);
    
    const tasks = await taskService.getTasksForUser(normalizedPhone);
    console.log(`Found ${tasks.length} tasks for phone ${normalizedPhone}`);
    
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching tasks by phone:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
};


/**
 * Update a task (Generic: description, dueDate etc.)
 * Note: For status changes use completeTaskPublic/reopenTaskPublic.
 * Note: For note changes use updateTaskNotesPublic.
 */
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Prevent status/notes updates through this generic endpoint
    if (updateData.status !== undefined || updateData.notes !== undefined) {
        return res.status(400).json({ success: false, error: 'Please use specific endpoints for status (/complete, /reopen) or notes (/notes) updates.' });
    }

    if (!id) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    // Fetch the task *before* update to compare dueDate
    const originalTask = await taskService.getTaskById(id);
    if (!originalTask) {
        return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const updatedTask = await taskService.updateTask(id, updateData);

    // Reschedule reminder only if the due date has changed
    if (updateData.dueDate && new Date(updateData.dueDate).toISOString() !== new Date(originalTask.dueDate).toISOString()) {
        console.log(`Due date changed for task ${id}. Rescheduling reminder.`);
        reminderService.scheduleReminder(updatedTask);
    }

    res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
};

/**
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const phone = req.query.phone || 'admin'; // Get the phone from query param if available

    if (!id) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }

    // Fetch task details before deletion to use in notification
    const taskToDelete = await taskService.getTaskById(id);
    
    if (!taskToDelete) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Cancel any pending reminders before deleting
    reminderService.cancelReminder(id);

    // Delete the task
    const result = await taskService.deleteTask(id);

    if (!result) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Send notifications about task deletion
    try {
      await notificationService.sendTaskDeletionNotification(taskToDelete, phone);
    } catch (notificationError) {
      console.error(`Failed to send deletion notifications for task ${id}:`, notificationError);
      // Continue with response even if notification fails
    }

    res.status(200).json({ success: true, data: { message: 'Task deleted successfully' } });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
};

/**
 * Update task notes without authentication (phone number from query param)
 */
exports.updateTaskNotesPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const phone = req.query.phone;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Task ID is required' });
        }
        if (notes === undefined) {
            return res.status(400).json({ success: false, error: 'Notes field is required' });
        }
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // Use the authorization check from taskService
        const authCheck = await taskService.isUserAuthorizedForTask(id, phone);
        if (!authCheck.authorized) {
            return res.status(authCheck.statusCode).json({ success: false, error: authCheck.error });
        }

        // Use the updateTaskNotes service method
        const updatedTask = await taskService.updateTaskNotes(id, notes, phone);

        // Send notification to task creator and assignees via WhatsApp
        const notesUpdateMessage = `📝 Notes updated for task "${updatedTask.description}" by ${phone}:
New Notes: ${notes || ''}`;
        try {
            // Notify creator (if not the one who updated)
            if (updatedTask.creator !== phone) {
                 await whatsappService.sendMessage(updatedTask.creator, notesUpdateMessage);
            }
           
            // Notify assignees (if not the one who updated)
            for (const assignee of updatedTask.assignees) {
                if (assignee !== phone) {
                    await whatsappService.sendMessage(assignee, notesUpdateMessage);
                }
            }
        } catch(notificationError) {
            console.error(`Failed to send notes update WhatsApp notifications for task ${id}:`, notificationError);
        }

        res.status(200).json({ success: true, data: updatedTask });
    } catch (error) {
        console.error('Error updating task notes:', error);
        res.status(500).json({ success: false, error: 'Failed to update task notes' });
    }
};

/**
 * Complete a task without authentication (phone number from query param)
 */
exports.completeTaskPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const phone = req.query.phone;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Task ID is required' });
        }
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // Use the authorization check from taskService
        const authCheck = await taskService.isUserAuthorizedForTask(id, phone);
        if (!authCheck.authorized) {
            return res.status(authCheck.statusCode).json({ success: false, error: authCheck.error });
        }

        // Use the completeTask service method
        const completedTask = await taskService.completeTask(id, phone);

        // Cancel any pending reminders for this task
        reminderService.cancelReminder(id);

        // Send notifications via notification service
        try {
            await notificationService.sendTaskCompletionNotification(completedTask, phone);
        } catch(notificationError) {
            console.error(`Failed to send completion WhatsApp notifications for task ${id}:`, notificationError);
            // Continue with response even if notification fails
        }

        res.status(200).json({ success: true, data: completedTask });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ success: false, error: 'Failed to complete task' });
    }
};

/**
 * Reopen a task without authentication (phone number from query param)
 */
exports.reopenTaskPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const phone = req.query.phone;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Task ID is required' });
        }
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // Use the authorization check from taskService
        const authCheck = await taskService.isUserAuthorizedForTask(id, phone);
        if (!authCheck.authorized) {
            return res.status(authCheck.statusCode).json({ success: false, error: authCheck.error });
        }

        // Use the reopenTask service method
        const updatedTask = await taskService.reopenTask(id, phone);

        // Reschedule reminder if due date exists and is in the future
        if (updatedTask.dueDate) {
            reminderService.scheduleReminder(updatedTask);
        }

        // Send notification to task creator and assignees via WhatsApp
        const reopenMessage = `🔄 Task Reopened: "${updatedTask.description}" by ${phone}`;
        try {
            // Notify creator (if not the one who reopened)
            if (updatedTask.creator !== phone) {
                await whatsappService.sendMessage(updatedTask.creator, reopenMessage);
            }
            
            // Notify assignees (if not the one who reopened)
            for (const assignee of updatedTask.assignees) {
                if (assignee !== phone) {
                    await whatsappService.sendMessage(assignee, reopenMessage);
                }
            }
        } catch(notificationError) {
            console.error(`Failed to send reopen WhatsApp notifications for task ${id}:`, notificationError);
        }

        res.status(200).json({ success: true, data: updatedTask });
    } catch (error) {
        console.error('Error reopening task:', error);
        res.status(500).json({ success: false, error: 'Failed to reopen task' });
    }
}; 