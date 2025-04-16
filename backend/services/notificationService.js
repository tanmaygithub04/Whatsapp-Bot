const whatsappService = require('./whatsappService');
const moment = require('moment');
const { formatPhoneNumber } = require('../utils/phoneNumberUtil');

/**
 * Send a confirmation message to the task creator
 * 
 * @param {Object} task - The created task
 */
exports.sendTaskCreationConfirmation = async (task) => {
  try {
    if (!task || !task.creator) {
      console.error('Cannot send confirmation: Invalid task or missing creator');
      return;
    }

    // Ensure the creator phone number is formatted
    const creatorPhone = formatPhoneNumber(task.creator);
    const assigneesText = task.assignees.map(assignee => formatPhoneNumber(assignee)).join(', ');
    const dueDateText = task.dueDate ? `due on ${moment(task.dueDate).format('YYYY-MM-DD')}` : 'with no due date';
    
    const message = `✅ Task created successfully!\n\n` +
      `*${task.description}*\n` +
      `Assigned to: ${assigneesText}\n` +
      `${dueDateText}\n` +
      `ID: ${task._id}`;
    
    await whatsappService.sendMessage(creatorPhone, message);
  } catch (error) {
    console.error('Error sending task creation confirmation:', error);
  }
};

/**
 * Notify task assignees about the new task
 * 
 * @param {Object} task - The created task
 */
exports.notifyTaskAssignees = async (task) => {
  try {
    if (!task || !task.assignees || !task.assignees.length) {
      console.error('Cannot notify assignees: Invalid task or missing assignees');
      return;
    }

    const creatorText = `from ${task.creator}`;
    const dueDateText = task.dueDate ? `due on ${moment(task.dueDate).format('YYYY-MM-DD')}` : 'with no due date';
    
    const message = `📋 You have been assigned a new task!\n\n` +
      `*${task.description}*\n` +
      `${creatorText}\n` +
      `${dueDateText}\n` +
      `ID: ${task._id}`;
    
    // Add task completion button
    const buttons = [
      {
        id: `complete_${task._id}`,
        text: 'Mark as Done'
      }
    ];
    
    // Send to each assignee
    for (const assignee of task.assignees) {
      // Skip if creator is also an assignee
      if (assignee === task.creator) {
        continue;
      }
      
      await whatsappService.sendMessageWithButtons(assignee, message, buttons);
    }
  } catch (error) {
    console.error('Error notifying task assignees:', error);
  }
};

/**
 * Send task completion notification to the task creator and assignees
 * 
 * @param {Object} task - The completed task
 * @param {string} completedBy - Who completed the task
 */
exports.sendTaskCompletionNotification = async (task, completedBy) => {
  try {
    if (!task) {
      console.error('Cannot send completion notification: Invalid task');
      return;
    }

    const message = `✅ Task completed!\n\n` +
      `*${task.description}*\n` +
      `Completed by: ${completedBy}\n` +
      `Completed on: ${moment(task.completedAt).format('YYYY-MM-DD HH:mm')}\n` +
      `ID: ${task._id}`;
    
    // Send to creator (if not the completer)
    if (task.creator && task.creator !== completedBy) {
      await whatsappService.sendMessage(task.creator, message);
    }
    
    // Send to other assignees (if not the completer)
    if (task.assignees && task.assignees.length > 0) {
      for (const assignee of task.assignees) {
        if (assignee !== completedBy && assignee !== task.creator) {
          await whatsappService.sendMessage(assignee, message);
        }
      }
    }
    
    // Send confirmation to the completer
    if (completedBy) {
      await whatsappService.sendMessage(completedBy, 
        `✅ Task marked as completed successfully!\n\n` +
        `*${task.description}*`
      );
    }
  } catch (error) {
    console.error('Error sending task completion notification:', error);
  }
};

/**
 * Send task reminder to assignees
 * 
 * @param {Object} task - The task to remind about
 * @param {boolean} isOverdue - Whether the task is overdue or just due soon
 */
exports.sendTaskReminder = async (task, isOverdue = false) => {
  try {
    if (!task || !task.assignees || !task.assignees.length) {
      console.error('Cannot send reminder: Invalid task or missing assignees');
      return;
    }

    const status = isOverdue ? '*OVERDUE*' : 'due soon';
    const dueDateText = task.dueDate ? `${moment(task.dueDate).format('YYYY-MM-DD')}` : 'Not specified';
    
    const message = `⏰ *Task Reminder*\n\n` +
      `Task: *${task.description}*\n` +
      `Status: ${status}\n` +
      `Due date: ${dueDateText}\n` +
      `ID: ${task._id}`;
    
    // Add task completion button
    const buttons = [
      {
        id: `complete_${task._id}`,
        text: 'Mark as Done'
      }
    ];
    
    // Send to each assignee
    for (const assignee of task.assignees) {
      await whatsappService.sendMessageWithButtons(assignee, message, buttons);
    }
    
    // Mark notification as sent if overdue
    if (isOverdue && task.markOverdueNotificationSent) {
      await task.markOverdueNotificationSent();
    }
  } catch (error) {
    console.error('Error sending task reminder:', error);
  }
};

/**
 * Send a list of tasks to a user
 * 
 * @param {string} phone - The recipient's phone number
 * @param {Array} tasks - Array of tasks to list
 * @param {string} [customTitle] - Optional custom title for the task list
 */
exports.sendTaskList = async (phone, tasks, customTitle = 'Your Tasks') => {
  try {
    if (!phone || !Array.isArray(tasks)) {
      console.error('Cannot send task list: Invalid phone or tasks');
      return;
    }

    if (tasks.length === 0) {
      await whatsappService.sendMessage(phone, `No tasks found. 🎉`);
      return;
    }

    let message = `📋 *${customTitle}*\n\n`;
    
    tasks.forEach((task, index) => {
      const status = task.status === 'COMPLETED' ? '✅' : '⏳';
      const dueDateText = task.dueDate ? `Due: ${moment(task.dueDate).format('YYYY-MM-DD')}` : 'No due date';
      
      message += `${index + 1}. ${status} *${task.description}*\n`;
      message += `   ${dueDateText} | ID: ${task._id}\n\n`;
    });
    
    message += `\nReply with task ID to see more details.`;
    
    await whatsappService.sendMessage(phone, message);
  } catch (error) {
    console.error('Error sending task list:', error);
  }
};

/**
 * Send task details to a user
 * 
 * @param {string} phone - The recipient's phone number
 * @param {Object} task - The task details to send
 */
exports.sendTaskDetails = async (phone, task) => {
  try {
    if (!phone || !task) {
      console.error('Cannot send task details: Invalid phone or task');
      return;
    }

    // Format the recipient phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    const statusText = task.status === 'COMPLETED' ? '✅ Completed' : '⏳ Open';
    const dueDateText = task.dueDate ? `${moment(task.dueDate).format('YYYY-MM-DD')}` : 'Not specified';
    const notesText = task.notes ? task.notes : 'None';
    const assigneesText = task.assignees.map(assignee => formatPhoneNumber(assignee)).join(', ');
    const completedText = task.completedAt ? `\nCompleted on: ${moment(task.completedAt).format('YYYY-MM-DD HH:mm')}` : '';
    
    const message = `📝 *Task Details*\n\n` +
      `*${task.description}*\n\n` +
      `Status: ${statusText}\n` +
      `Created by: ${formatPhoneNumber(task.creator)}\n` +
      `Assigned to: ${assigneesText}\n` +
      `Due date: ${dueDateText}${completedText}\n\n` +
      `Notes: ${notesText}\n\n` +
      `ID: ${task._id}`;
    
    // Add buttons based on task status
    let buttons = [];
    
    if (task.status !== 'COMPLETED') {
      buttons.push({
        id: `complete_${task._id}`,
        text: 'Mark as Done'
      });
    }
    
    if (buttons.length > 0) {
      await whatsappService.sendMessageWithButtons(formattedPhone, message, buttons);
    } else {
      await whatsappService.sendMessage(formattedPhone, message);
    }
  } catch (error) {
    console.error('Error sending task details:', error);
  }
};

/**
 * Send task deletion notification to the task creator and assignees
 * 
 * @param {Object} task - The deleted task
 * @param {string} deletedBy - Who deleted the task (optional)
 */
exports.sendTaskDeletionNotification = async (task, deletedBy = 'admin') => {
  try {
    if (!task) {
      console.error('Cannot send deletion notification: Invalid task');
      return;
    }

    const message = `🗑️ Task deleted!\n\n` +
      `*${task.description}*\n` +
      `Deleted by: ${deletedBy}\n` +
      `Deleted on: ${moment().format('YYYY-MM-DD HH:mm')}\n` +
      `Task ID: ${task._id}`;
    
    // Collect unique recipients (both creator and assignees)
    const recipients = new Set();
    
    // Add creator
    if (task.creator) {
      recipients.add(formatPhoneNumber(task.creator));
    }
    
    // Add all assignees
    if (task.assignees && task.assignees.length > 0) {
      for (const assignee of task.assignees) {
        recipients.add(formatPhoneNumber(assignee));
      }
    }
    
    // Send message to all recipients
    for (const recipient of recipients) {
      try {
        await whatsappService.sendMessage(recipient, message);
        console.log(`Task deletion notification sent to ${recipient}`);
      } catch (err) {
        console.error(`Failed to send deletion notification to ${recipient}:`, err);
      }
    }
  } catch (error) {
    console.error('Error sending task deletion notification:', error);
  }
}; 