// services/reminderService.js
const cron = require('node-cron');
const Task = require('../models/Task');
const whatsappService = require('./whatsappService');
const { format, subHours } = require('date-fns');

// Store scheduled jobs in memory.
// WARNING: This is not persistent. If the server restarts, reminders scheduled
// before the restart will be lost. Consider a persistent job queue for production.
const scheduledJobs = {};

/**
 * Formats a date object into a readable string.
 * @param {Date} date - The date to format.
 * @returns {string} - Formatted date string (e.g., "July 20, 2024 at 05:30 PM")
 */
const formatReadableDate = (date) => {
    return format(date, "MMMM d, yyyy 'at' hh:mm a");
};

/**
 * Schedules a WhatsApp reminder for a task.
 * @param {object} task - The task object from MongoDB.
 */
const scheduleReminder = (task) => {
    if (!task.dueDate) {
        console.log(`Task ${task._id} has no due date. No reminder scheduled.`);
        return;
    }

    // Calculate reminder time (6 hours before due date)
    const reminderTime = subHours(new Date(task.dueDate), 6);
    const now = new Date();

    // Only schedule if the reminder time is in the future
    if (reminderTime <= now) {
        console.log(`Reminder time for task ${task._id} (${reminderTime}) is in the past. No reminder scheduled.`);
        return;
    }

    // Format cron time: 'minute hour dayOfMonth month dayOfWeek'
    const cronTime = `${reminderTime.getMinutes()} ${reminderTime.getHours()} ${reminderTime.getDate()} ${reminderTime.getMonth() + 1} *`;

    console.log(`Scheduling reminder for task ${task._id} at ${formatReadableDate(reminderTime)} (Cron: ${cronTime})`);

    // Cancel any existing job for this task first
    cancelReminder(task._id.toString());

    // Schedule the cron job
    const job = cron.schedule(cronTime, async () => {
        console.log(`Sending reminder for task ${task._id}`);
        try {
            // Refetch task data in case it was updated/deleted
            const currentTask = await Task.findById(task._id);
            if (!currentTask || currentTask.status === 'COMPLETED') {
                console.log(`Task ${task._id} not found or already completed. Cancelling reminder.`);
                delete scheduledJobs[task._id.toString()]; // Clean up map
                job.stop(); // Stop the cron job instance
                return;
            }

            const readableDueDate = formatReadableDate(currentTask.dueDate);
            const reminderText = `🔔 Reminder: Task "${currentTask.description}" is due on ${readableDueDate}.`;

            // Send reminder to creator
            if (currentTask.creator) {
                await whatsappService.sendMessage(currentTask.creator, reminderText);
                console.log(`Reminder sent to creator ${currentTask.creator} for task ${task._id}`);
            }

            // Send reminder to all assignees
            if (currentTask.assignees && currentTask.assignees.length > 0) {
                for (const assignee of currentTask.assignees) {
                    await whatsappService.sendMessage(assignee, reminderText);
                    console.log(`Reminder sent to assignee ${assignee} for task ${task._id}`);
                }
            }

            // Clean up after sending
            delete scheduledJobs[task._id.toString()];
            job.stop(); // Job is done

        } catch (error) {
            console.error(`Error sending reminder for task ${task._id}:`, error);
            // Keep the job scheduled in case it was a temporary error? Or stop?
            // For now, let's stop it to avoid repeated failures for the same issue.
            delete scheduledJobs[task._id.toString()];
            job.stop();
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // TODO: Make timezone configurable or detect user's timezone
    });

    // Store the job instance so we can potentially cancel it later
    scheduledJobs[task._id.toString()] = job;
};

/**
 * Cancels a scheduled reminder for a task.
 * @param {string} taskId - The ID of the task whose reminder should be cancelled.
 */
const cancelReminder = (taskId) => {
    const jobId = taskId.toString();
    if (scheduledJobs[jobId]) {
        console.log(`Cancelling existing reminder job for task ${taskId}`);
        scheduledJobs[jobId].stop();
        delete scheduledJobs[jobId];
    }
};

/**
 * Reschedules reminders on server startup for tasks that are still relevant.
 * Should be called once when the application initializes.
 */
const rescheduleRemindersOnStartup = async () => {
    console.log('Rescheduling reminders on startup...');
    try {
        const upcomingTasks = await Task.find({
            dueDate: { $ne: null }, // Has a due date
            status: 'OPEN'         // Is not completed
        }).exec();

        let rescheduledCount = 0;
        const now = new Date();

        for (const task of upcomingTasks) {
            const reminderTime = subHours(new Date(task.dueDate), 6);
            // Only reschedule if the reminder time is still in the future
            if (reminderTime > now) {
                scheduleReminder(task);
                rescheduledCount++;
            }
        }
        console.log(`Rescheduled ${rescheduledCount} reminders.`);
    } catch (error) {
        console.error('Error rescheduling reminders on startup:', error);
    }
};

module.exports = {
    scheduleReminder,
    cancelReminder,
    rescheduleRemindersOnStartup
};