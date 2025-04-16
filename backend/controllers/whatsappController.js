const taskService = require('../services/taskService');
const whatsappService = require('../services/whatsappService');
const parserService = require('../services/parserService');
const notificationService = require('../services/notificationService');
const reminderService = require('../services/reminderService');
// const nlpTaskExtractor = require('../services/nlpTaskExtractor');


//  * Process incoming WhatsApp messages from webhook

exports.processMessage = async (req, res) => {
  try {
    const { body } = req;
    console.log('Webhook received:', JSON.stringify(body));

    // Check webhook event type
    if (body.event && body.event.type) {
      // We'll only process message events, skip status updates
      if (body.event.type !== 'messages') {
        console.log(`Skipping webhook event type: ${body.event.type}`);
        return res.status(200).json({ status: 'success' });
      }
      
      // Process message events
      if (!body.messages || !body.messages.length) {
        console.log('No messages found in webhook payload');
        return res.status(200).json({ status: 'success' }); // Still return success
      }

      // Process all messages in the array
      for (const message of body.messages) {
        // Skip processing messages sent by our own system (from_me = true)
        if (message.from_me === true) {
          console.log('Skipping message sent by our system:', message.id);
          continue;
        }
        
        // Handle button responses/interactive messages
        if (message.type === 'reply' && message.reply && message.reply.buttons_reply) {
          console.log('Processing button response:', message.reply.buttons_reply);
          await handleButtonResponse(message);
          continue;
        }
        
        // Check if regular message has the expected structure
        if (!message || !message.text || !message.text.body) {
          console.log('Invalid message format:', message);
          continue;
        }
        
        const messageText = message.text.body;
        const sender = message.from || message.chat_id.split('@')[0];
        
        // Process only command messages (starting with /)
        if (messageText.startsWith('/')) {
          console.log('Processing command message:', messageText);
          await handleDirectMessage(message);
        } else {
          console.log('Received non-command message, ignoring:', messageText);
        }
      }
    } else {
      console.log('Invalid webhook format: missing event type');
    }
    
    // Always acknowledge receipt to webhook provider
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
};

/**
 * Handle button clicks and interactive responses
 */
exports.handleInteraction = async (req, res) => {
  try {
    const { body } = req;
    console.log('Interaction received:', JSON.stringify(body));

    // Validate interaction payload
    if (!body || !body.interaction) {
      return res.status(400).json({ error: 'Invalid interaction payload' });
    }

    const { interaction } = body;
    const { type, data, sender } = interaction;

    // Handle task completion
    if (type === 'button' && data.action === 'complete_task') {
      const taskId = data.taskId;
      const updatedTask = await taskService.completeTask(taskId);
      
      if (updatedTask) {
        // Send unified task completion notification
        await notificationService.sendTaskCompletionNotification(updatedTask, sender);
        
        // Update real-time dashboard
        const io = req.app.get('tasksNamespace');
        io.emit('task_updated', updatedTask);
      }
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error handling interaction:', error);
    return res.status(500).json({ error: 'Failed to process interaction' });
  }
};

/**
 * Handle direct messages for task creation and management
 */
async function handleDirectMessage(message) {
  console.log('Processing command message:', message);
  
  // Check if the message has the expected structure
  if (!message || !message.text || !message.text.body) {
    console.log('Invalid message format:', message);
    return;
  }
  
  const messageText = message.text.body;
  const sender = message.from || message.chat_id.split('@')[0];
  
  // Process commands (all messages should start with /)
  if (!messageText.startsWith('/')) {
    console.log('Non-command message received in handleDirectMessage, ignoring');
    return;
  }

  // Split the command into segments (e.g., /create task, @john, 2023-12-31, notes)
  const commandParts = messageText.split(' ', 2);
  const command = commandParts[0].toLowerCase();
  const restOfMessage = messageText.substring(command.length).trim();
  
  switch (command) {
    case '/create':
      // Parse task creation command: /create <TASK>, <ASSIGNEE(S)>, <[Optional] Time>, <NOTES>
      try {
        const taskData = parserService.parseCreateCommand(restOfMessage, sender);
        if (taskData) {
          // Create the task
          const task = await taskService.createTask(taskData);
          console.log('Task added in db');

          // Schedule reminder if due date exists
          reminderService.scheduleReminder(task);

          // Send a single notification to all assignees with interactive buttons
          await notifyAllAboutNewTask(task);
          console.log('Notification sent to all assignees');
        } else {
          // Send help message if parsing failed
          await whatsappService.sendMessage(
            sender, 
            'Could not understand your task creation command.\n' +
            'Format: /create Description, @assignee1 @assignee2, YYYY-MM-DD, notes'
          );
        }
      } catch (error) {
        console.error('Error creating task:', error);
        await whatsappService.sendMessage(sender, 'There was an error processing your task creation. Please try again.');
      }
      break;
    
    case '/tasks':
      // Call the existing processCommand function for task listing
      return await parserService.processCommand(messageText, sender);
      
    case '/help':
      // Send help information
      await whatsappService.sendMessage(
        sender, 
        'Available commands:\n' +
        '/create <TASK>, <ASSIGNEE(S)>, <[Optional] Time>, <NOTES> - Create a new task\n' +
        '/tasks - List all your active tasks\n' +
        '/tasks/assignee - List tasks assigned to a specific person\n' +
        '/help - Show this help message'
      );
      break;
      
    default:
      // Check if it's a nested command like /tasks/john
      if (command.startsWith('/tasks/')) {
        return await processCommand(messageText, sender);
      } else {
        await whatsappService.sendMessage(sender, 'Unknown command. Type /help for available commands.');
      }
  }
}

/**
 * Notify all relevant parties about a new task with a single notification approach
 */
async function notifyAllAboutNewTask(task) {
  // Notification for assignees with completion button
  const assigneeMessage = `📋 New task assigned to you!\n\n` +
    `*${task.description}*\n` +
    `From: ${task.creator}\n` +
    `${task.dueDate ? `Due on: ${task.dueDate.toISOString().split('T')[0]}\n` : ''}` +
    `${task.notes ? `Notes: ${task.notes}\n` : ''}`
  
  const buttons = [
    {
      type: "quick_reply",
      id: `complete_${task._id}`,
      title: 'Mark as Done'
    }
  ];
  
  // Send to each assignee
  for (const assignee of task.assignees) {
    // Skip if creator is also an assignee (they'll get the creator notification)
    // if (assignee === task.creator) continue;
    if(process.env.NODE_ENV === 'production'){
      console.log('Sending notification to:::::', assignee);
      await whatsappService.sendMessageWithButtons(assignee, assigneeMessage, buttons);
    } else {
      await whatsappService.sendMessage(assignee, assigneeMessage);
    }
  }
  
  // Notification for creator
  const creatorMessage = `✅ Task created successfully!\n\n` +
    `*${task.description}*\n` +
    `Assigned to: ${task.assignees.join(', ')}\n` +
    `${task.dueDate ? `Due on: ${task.dueDate.toISOString().split('T')[0]}\n` : ''}` +
    `ID: ${task._id}`;
  
  await whatsappService.sendMessage(task.creator, creatorMessage);
}



/**
 * Handle button responses from interactive messages
 */
async function handleButtonResponse(message) {
  try {
    // Extract necessary information
    const buttonData = message.reply.buttons_reply;
    console.log('Button data:', JSON.stringify(buttonData));
    
    const buttonId = buttonData.id;
    const sender = message.from;
    
    console.log(`Processing button click from ${sender}, button ID: ${buttonId}`);
    
    // Handle "Mark as Done" button clicks
    if (buttonId.includes('complete_')) {
      // Extract the task ID from the button ID
      // Format is typically "ButtonsV3:complete_TASK_ID"
      const taskIdMatch = buttonId.match(/complete_([a-f0-9]+)/i);
      
      if (!taskIdMatch || !taskIdMatch[1]) {
        console.error('Could not extract task ID from button ID:', buttonId);
        return;
      }
      
      const taskId = taskIdMatch[1];
      console.log(`Completing task ${taskId} via button click from ${sender}`);
      
      // Complete the task
      const completedTask = await taskService.completeTask(taskId, sender);
      
      // Cancel any pending reminders for this task
      reminderService.cancelReminder(taskId);
      
      // Send completion notifications
      await notificationService.sendTaskCompletionNotification(completedTask, sender);
      
      console.log(`Task ${taskId} completed successfully via button click`);
    }
  } catch (error) {
    console.error('Error handling button response:', error);
    // Try to notify the user of the error
    if (message && message.from) {
      try {
        await whatsappService.sendMessage(
          message.from, 
          'Sorry, there was an error processing your request. Please try again or contact support.'
        );
      } catch (notificationError) {
        console.error('Error sending error notification:', notificationError);
      }
    }
  }
}

