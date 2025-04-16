const express = require('express');
const taskController = require('../controllers/taskController');
const router = express.Router();


// Get tasks for a specific phone number
router.get('/user/:phone', taskController.getTasksByPhone);

// Mark a task as complete (uses phone from query param)
router.patch('/:id/complete', taskController.completeTaskPublic);

// Reopen a completed task (uses phone from query param)
router.patch('/:id/reopen', taskController.reopenTaskPublic);

// Update task notes (uses phone from query param)
router.patch('/:id/notes', taskController.updateTaskNotesPublic);


// Update task details (description, dueDate etc. - NOT status/notes)
router.put('/:id', taskController.updateTask); 

// Delete a task
router.delete('/:id', taskController.deleteTask);

module.exports = router; 