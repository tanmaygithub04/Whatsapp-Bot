import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { formatPhoneNumber } from '../utils/phoneNumberUtil';
import './Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const Dashboard = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Function to fetch tasks for a phone number
  const fetchTasks = async () => {
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const response = await axios.get(`${API_BASE_URL}/tasks/user/${formattedPhone}`);
      setTasks(response.data.data || []);
      if (response.data.data.length === 0) {
        setSuccessMessage('No tasks found for this phone number');
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to fetch tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mark a task as complete
  const completeTask = async (taskId) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      console.log("completing task", taskId , "for phone", formattedPhone);
      await axios.patch(`${API_BASE_URL}/tasks/${taskId}/complete?phone=${formattedPhone}`);
      // Update local tasks state
      setTasks(tasks.map(task => 
        task._id === taskId ? { ...task, status: 'COMPLETED' } : task
      ));
      setSuccessMessage('Task marked as complete!');
      
      // Refresh tasks after a short delay
      setTimeout(() => fetchTasks(), 1500);
    } catch (err) {
      console.error('Error completing task:', err);
      setError('Failed to mark task as complete');
    } finally {
      setLoading(false);
    }
  };

  // Reopen a completed task
  const reopenTask = async (taskId) => {
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      await axios.patch(`${API_BASE_URL}/tasks/${taskId}/reopen?phone=${formattedPhone}`);
      // Update local tasks state
      setTasks(tasks.map(task => 
        task._id === taskId ? { ...task, status: 'OPEN' } : task
      ));
      setSuccessMessage('Task reopened!');
      
      // Refresh tasks after a short delay
      setTimeout(() => fetchTasks(), 1500);
    } catch (err) {
      console.error('Error reopening task:', err);
      setError('Failed to reopen task');
    } finally {
      setLoading(false);
    }
  };

  // Open notes edit modal
  const openEditNotes = (task) => {
    setEditingTask(task);
    setNotes(task.notes || '');
  };

  // Close notes edit modal
  const closeEditNotes = () => {
    setEditingTask(null);
    setNotes('');
  };

  // Save updated notes
  const saveNotes = async () => {
    if (!editingTask) return;
    
    setLoading(true);
    setError('');
    setSuccessMessage('');
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      await axios.patch(`${API_BASE_URL}/tasks/${editingTask._id}/notes?phone=${formattedPhone}`, {
        notes: notes
      });
      
      // Update local tasks state
      setTasks(tasks.map(task => 
        task._id === editingTask._id ? { ...task, notes: notes } : task
      ));
      
      setSuccessMessage('Notes updated successfully!');
      closeEditNotes();
      
      // Refresh tasks after a short delay
      setTimeout(() => fetchTasks(), 1500);
    } catch (err) {
      console.error('Error updating notes:', err);
      setError('Failed to update notes');
    } finally {
      setLoading(false);
    }
  };

  // Delete a task
  const deleteTask = async (taskId) => {
    // Confirmation dialog
    if (!window.confirm('Are you sure you want to delete this task permanently?')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Note: The backend DELETE route doesn't currently check authorization.
      // For production, the backend should be updated to verify ownership/assignment.
      await axios.delete(`${API_BASE_URL}/tasks/${taskId}`);

      // Update local tasks state by removing the deleted task
      setTasks(tasks.filter(task => task._id !== taskId));
      setSuccessMessage('Task deleted successfully!');

      // Optionally clear success message after a delay
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    try {
      return format(new Date(dateString), 'PPP p'); // e.g., "Apr 29, 2023 12:00 PM"
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="dashboard-container">
      <h1>Task Dashboard</h1>
      
      <div className="phone-input-section">
        <p>Enter your phone number to see tasks assigned to you:</p>
        <div className="input-row">
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Enter your phone number (with country code)"
            disabled={loading}
          />
          <button 
            onClick={fetchTasks} 
            disabled={loading}
            className="primary-button"
          >
            {loading ? 'Loading...' : 'View My Tasks'}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}
      </div>

      {tasks.length > 0 && (
        <div className="tasks-section">
          <h2>Your Tasks</h2>
          <div className="tasks-list">
            {tasks.map(task => (
              <div key={task._id} className={`task-card ${task.status === 'COMPLETED' ? 'completed' : ''}`}>
                <div className="task-header">
                  <h3>{task.description}</h3>
                  <span className={`status-badge ${task.status.toLowerCase()}`}>
                    {task.status}
                  </span>
                </div>
                
                <div className="task-details">
                  <p><strong>Created:</strong> {formatDate(task.createdAt)}</p>
                  {task.dueDate && (
                    <p className={new Date(task.dueDate) < new Date() ? 'overdue' : ''}>
                      <strong>Due:</strong> {formatDate(task.dueDate)}
                    </p>
                  )}
                  {task.notes && (
                    <div className="task-notes">
                      <strong>Notes:</strong>
                      <p>{task.notes}</p>
                    </div>
                  )}
                </div>
                
                <div className="task-actions">
                  {task.status === 'OPEN' ? (
                    <button 
                      onClick={() => completeTask(task._id)}
                      className="complete-button"
                      disabled={loading}
                    >
                      Mark Complete
                    </button>
                  ) : (
                    <button 
                      onClick={() => reopenTask(task._id)}
                      className="reopen-button"
                      disabled={loading}
                    >
                      Reopen Task
                    </button>
                  )}
                  <button 
                    onClick={() => openEditNotes(task)}
                    className="notes-button"
                    disabled={loading}
                  >
                    Edit Notes
                  </button>
                  <button
                    onClick={() => deleteTask(task._id)}
                    className="delete-button"
                    disabled={loading}
                  >
                    Delete Task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes edit modal */}
      {editingTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Notes for "{editingTask.description}"</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes here..."
              rows={5}
            />
            <div className="modal-actions">
              <button onClick={closeEditNotes} className="cancel-button">Cancel</button>
              <button onClick={saveNotes} className="save-button" disabled={loading}>
                {loading ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 