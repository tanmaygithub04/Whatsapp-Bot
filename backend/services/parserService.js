const taskService = require('./taskService'); // Added to provide access for processCommand
const notificationService = require('./notificationService'); // Added to provide access for processCommand
const whatsappService = require('./whatsappService'); // Added to provide access for processCommand

/**
 * Service for parsing messages into structured task data
 */

/**
 * Parse the /create command for task creation
 * Expected format: /create Description, @assignee1 @assignee2, YYYY-MM-DD, notes
 */
exports.parseCreateCommand = (message, creator) => {
  if (!message || typeof message !== 'string') {
    return null;
  }

  try {
    // Split by commas
    const parts = message.split(',').map(part => part.trim());
    
    // Need at least description and assignee
    if (parts.length < 2) {
      return null;
    }
    
    const description = parts[0];
    const assigneesPart = parts[1];
    
    // Parse assignees using internal function
    const assignees = extractAssignees(assigneesPart);
    
    if (!description || !assignees.length) {
      return null;
    }
    
    // Initialize task data
    const taskData = {
      description,
      assignees,
      creator
    };
    
    // Optional due date (third part)
    if (parts.length >= 3) {
      const dueDate = parseDate(parts[2]);
      if (dueDate) {
        taskData.dueDate = dueDate;
      }
    }
    
    // Optional notes (fourth part)
    if (parts.length >= 4) {
      taskData.notes = parts[3];
    }
    
    console.log('Task data:', taskData);
    return taskData;
  } catch (error) {
    console.error('Error parsing task creation command:', error);
    return null;
  }
};

/**
 * Process command messages (starting with /)
 */
exports.processCommand  =  async (message, sender) => {
  // Split the command into segments (e.g., /tasks/john would become ['tasks', 'john'])
  const commandParts = message.substring(1).split('/');
  const primaryCommand = commandParts[0].toLowerCase().trim();
  
  switch (primaryCommand) {
    case 'tasks':
      // Check if assignees are specified
      if (commandParts.length > 1 && commandParts[1].trim()) {
        // Get assignees - support colon-separated list
        const assigneeParam = commandParts[1].trim();
        if (assigneeParam.includes(':')) {
          // Multiple assignees separated by colons
          const assignees = assigneeParam.split(':').map(a => a.trim()).filter(a => a);
          
          if (assignees.length === 0) {
            await whatsappService.sendMessage(sender, 'Please specify at least one assignee.');
            break;
          }
          
          const tasks = await taskService.getTasksForMultipleAssignees(assignees);
          await notificationService.sendTaskList(
            sender, 
            tasks, 
            `Tasks for ${assignees.join(', ')}`
          );
        } else {
          // Single assignee
          const assignee = assigneeParam;
          const tasks = await taskService.getTasksForAssignee(assignee);
          await notificationService.sendTaskList(sender, tasks, `Tasks assigned to ${assignee}`);
        }
      } else {
        // Get all active tasks for the user (as creator or assignee)
        const tasks = await taskService.getTasksForUser(sender);
        await notificationService.sendTaskList(sender, tasks, "Your Active Tasks");
      }
      break;
      
    case 'help':
      // Send help information
      await whatsappService.sendMessage(sender, 
        'Available commands:\n' +
        '/create <TASK>, <ASSIGNEE(S)>, <[Optional] Time>, <NOTES> - Create a new task\n' +
        '/tasks - List all your active tasks\n' +
        '/tasks/assignee - List tasks assigned to a specific person\n' +
        '/tasks/assignee1:assignee2:assignee3 - List tasks for multiple assignees\n' +
        '/help - Show this help message'
      );
      break;
      
    default:
      await whatsappService.sendMessage(sender, 'Unknown command. Type /help for available commands.');
  }
} 


/**
 * Parse a message for a task update
 * Expected format: /update taskId, [description], [@assignee1 @assignee2], [YYYY-MM-DD], [notes]
 * 
 * @param {string} message - Raw message text
 * @returns {Object|null} - Parsed update data or null if parsing fails
 */
exports.parseTaskUpdateMessage = (message) => {
  if (!message || typeof message !== 'string' || !message.startsWith('/update')) {
    return null;
  }

  try {
    // Extract command and parts
    const commandParts = message.split(' ', 2);
    
    if (commandParts.length < 2) {
      return null;
    }
    
    const taskId = commandParts[1];
    
    // Remove the command part and split the rest by commas
    const updatePartsText = message.substring(message.indexOf(taskId) + taskId.length).trim();
    
    if (!updatePartsText) {
      return { taskId };
    }
    
    const updateParts = updatePartsText.split(',').map(part => part.trim()).filter(part => part);
    
    // Initialize update data
    const updateData = { taskId };
    
    // Process update parts - each part is optional
    if (updateParts.length >= 1 && !updateParts[0].includes('@')) {
      updateData.description = updateParts[0];
    }
    
    // Check for assignees in any part
    for (const part of updateParts) {
      if (part.includes('@')) {
        updateData.assignees = extractAssignees(part);
        break;
      }
    }
    
    // Check for date in any part
    for (const part of updateParts) {
      const date = parseDate(part);
      if (date) {
        updateData.dueDate = date;
        break;
      }
    }
    
    // Last part that's not a date or assignees list is considered notes
    const lastPart = updateParts[updateParts.length - 1];
    if (lastPart && !lastPart.includes('@') && !parseDate(lastPart)) {
      updateData.notes = lastPart;
    }
    
    return updateData;
  } catch (error) {
    console.error('Error parsing task update message:', error);
    return null;
  }
};

/**
 * Helper to extract assignees from text
 * 
 * @param {string} text - Text containing @mentions or phone numbers
 * @returns {string[]} - Array of extracted assignees (phone numbers)
 */
function extractAssignees(text) {
  if (!text) {
    return [];
  }
  
  // Extract @mentions
  const mentionPattern = /@(\S+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  // If mentions found, return them
  if (mentions.length > 0) {
    return mentions;
  }
  
  // If no @mentions, check for phone numbers
  const phonePattern = /\b\d{10,15}\b/g;
  const phones = [];
  
  while ((match = phonePattern.exec(text)) !== null) {
    phones.push(match[0]);
  }
  
  return phones;
}


/**
 * Helper to parse dates from text
 * 
 * @param {string} text - Text containing a date
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseDate(text) {
  if (!text) {
    return null;
  }
  
  // Try to parse in YYYY-MM-DD format
  const isoPattern = /(\d{4}-\d{2}-\d{2})/;
  const isoMatch = text.match(isoPattern);
  
  if (isoMatch) {
    const date = new Date(isoMatch[1]);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Try natural language date parsing (simplified)
  // In a real implementation, you'd use a library like chrono-node
  const today = new Date();
  
  if (text.toLowerCase().includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  if (text.toLowerCase().includes('next week')) {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }
  
  // Could add more natural language parsing here
  
  return null;
} 