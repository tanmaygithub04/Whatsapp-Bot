# WhatsApp Task Manager

A full-stack application that integrates with WhatsApp to manage tasks and send reminders via messaging. Create, track, and complete tasks directly through WhatsApp messages or using the web dashboard.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Frontend Description](#frontend-description)
- [Backend Description](#backend-description)
- [API Documentation](#api-documentation)
- [Installation and Local Development](#installation-and-local-development)
- [Usage Examples](#usage-examples)
- [Deployment](#deployment)
- [Project Status and Roadmap](#project-status-and-roadmap)

## Architecture Overview

The application consists of three main components:

1. **WhatsApp Integration**: Receives and processes WhatsApp messages/interactions via webhooks
2. **Backend API**: Handles task management, user operations, and reminders
3. **Web Dashboard**: Provides a visual interface for task management

https://excalidraw.com/#json=BUA9GstqXVGDXLsbPltIa,qhFCNaA4X9kL8RiuxAMdig

## Technology Stack

### Frontend
- React.js
- Material-UI components
- Axios for API calls
- Date-fns for date formatting

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Whapi.Cloud API integration
- Node-cron for scheduling reminders
- JSON Web Tokens for authentication

## Features

- **WhatsApp Command Interface**:
  - Create tasks with `/create` command
  - List tasks with `/tasks` command
  - Get help with `/help` command
  
- **Interactive WhatsApp Buttons**:
  - Mark tasks as complete with one click
  
- **Automated Notifications**:
  - Task creation confirmation
  - Assignment notifications
  - Completion alerts
  - Reminders before due dates
  
- **Web Dashboard**:
  - View all assigned tasks
  - Complete/reopen tasks
  - Edit task notes
  - Delete tasks

## Frontend Description

The web dashboard provides a simple interface to manage tasks. Users enter their phone number to view tasks assigned to them, then can perform actions like completing tasks, reopening them, editing notes, and deleting tasks.

The UI is built with React and follows a clean, minimalist design with a WhatsApp-inspired color scheme. The dashboard displays task cards showing:
- Task description
- Creation and due dates
- Completion status
- Notes
- Action buttons

## Backend Description

The backend is an Express.js application organized in a modular structure:

- **Controllers**: Handle HTTP requests and WhatsApp webhook events
- **Services**: Contain business logic and data handling
- **Models**: Define the MongoDB schema for tasks
- **Routes**: Define API endpoints
- **Utils**: Provide helper functions

Key features implemented in the backend:

1. **WhatsApp Integration**:
   - Processes incoming webhook events
   - Handles text commands and interactive button responses
   - Sends formatted messages with buttons

2. **Task Management**:
   - CRUD operations for tasks
   - Authorization checks to ensure only creators or assignees can modify tasks
   - Status tracking (open/completed)

3. **Reminder System**:
   - Scheduled reminders for upcoming tasks
   - Uses node-cron for precise timing
   - Reminders automatically rescheduled on server restart

## API Documentation

### Task Endpoints

#### Get Tasks by Phone
```
GET /api/tasks/user/:phone
```
Returns all tasks where the specified phone number is either creator or assignee.

#### Get Task by ID
```
GET /api/tasks/:id
```
Returns a specific task by ID.

#### Create Task
```
POST /api/tasks
```
Creates a new task with the provided details.

**Request Body**:
```json
{
  "description": "Task description",
  "creator": "1234567890",
  "assignees": ["1234567890", "0987654321"],
  "dueDate": "2023-12-31T23:59:59Z",
  "notes": "Optional notes"
}
```

#### Complete Task
```
PATCH /api/tasks/:id/complete?phone=1234567890
```
Marks a task as complete.

#### Reopen Task
```
PATCH /api/tasks/:id/reopen?phone=1234567890
```
Reopens a completed task.

#### Update Task Notes
```
PATCH /api/tasks/:id/notes?phone=1234567890
```
Updates the notes for a task.

**Request Body**:
```json
{
  "notes": "New notes content"
}
```

#### Delete Task
```
DELETE /api/tasks/:id
```
Deletes a task.

### WhatsApp Webhook

```
POST /api/whatsapp/webhook
```
Receives and processes incoming WhatsApp messages and button interactions.

## Installation and Local Development

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- WhatsApp Business API account or Whapi.Cloud account

### Backend Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/whatsapp-task-manager.git
   cd whatsapp-task-manager/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/task-manager
   WHATSAPP_API_KEY=your_whapi_cloud_api_key
   WHAPI_BASE_URL=https://gate.whapi.cloud
   NODE_ENV=development
   ```

4. Start MongoDB:
   ```
   mongod --dbpath ~/mongodb-data
   ```

5. Start the backend server:
   ```
   npm start
   ```

### Exposing Backend for Webhook (ngrok)

For WhatsApp webhooks to reach your local development server, you need to expose your backend to the internet. [ngrok](https://ngrok.com/) is a simple tool that creates a secure tunnel to your localhost.

1. Install ngrok:
   ```
   # Using npm
   npm install -g ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. With your backend server running on port 5000, run ngrok:
   ```
   ngrok http 5000
   ```

3. ngrok will display a URL (e.g., `https://a1b2c3d4e5f6.ngrok.io`) that forwards to your local server. Copy this URL as you'll need it for the webhook setup.

   **Note**: The free tier of ngrok will generate a new URL each time you restart it. For development, you may need to update your webhook URL in Whapi.Cloud each time you restart ngrok.

### Setting Up Whapi.Cloud Account

Before configuring webhooks, you need to set up your Whapi.Cloud account and connect a WhatsApp number:

1. Sign up or log in at [Whapi.Cloud](https://whapi.cloud/)

2. Follow their onboarding process to connect a WhatsApp number:
   - Install the Whapi.Cloud app on your phone
   - Scan the QR code to link your WhatsApp account
   - Complete the verification process

3. After connecting your WhatsApp number, navigate to the API Keys section to generate an API key

4. Copy this API key and add it to your `.env` file as `WHATSAPP_API_KEY`

### Setting Up Webhook on Whapi.Cloud

To receive WhatsApp message events, you need to configure a webhook on your Whapi.Cloud account:

1. Create or log in to your account on [Whapi.Cloud](https://whapi.cloud/)

2. Navigate to the Dashboard and select your WhatsApp number

3. Go to "Webhooks" section

4. Configure the webhook with the following settings:
   - **Webhook URL**: Your ngrok URL + `/api/whatsapp/webhook` (e.g., `https://a1b2c3d4e5f6.ngrok.io/api/whatsapp/webhook`)
   - **Events to receive**: Enable at minimum:
     - `messages` (for receiving text commands)
     - `message_reply` (for button responses)
     - `status_v3` (optional, for delivery status)

5. Save your webhook configuration

6. Test the webhook connection:
   - Send a message to your WhatsApp business number
   - Check your backend server logs to see if the webhook event is received
   - You should see a log message like: `Webhook received: {...}`

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd ../frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file:
   ```
   REACT_APP_API_BASE_URL=http://localhost:5000/api
   ```

4. Start the frontend development server:
   ```
   npm start
   ```

5. Access the application at `http://localhost:3000`

## Usage Examples

### WhatsApp Commands

First, ensure your webhook is properly set up and your backend server is running and accessible via ngrok. Then, using your personal WhatsApp, send the following commands to your connected WhatsApp number:

1. **Create a task**:
   ```
   /create Buy groceries, 919818905678, 2023-12-31, Don't forget milk!
   ```
   This creates a task "Buy groceries" assigned to the phone number 919818905678, due on December 31, 2023.

2. **View your tasks**:
   ```
   /tasks
   ```
   Shows all tasks assigned to you or created by you.

3. **View tasks for specific assignee**:
   ```
   /tasks/919818905678
   ```
   Shows all tasks assigned to the specified phone number.

4. **Get help**:
   ```
   /help
   ```
   Displays available commands and their formats.

5. **Testing button responses**:
   After creating a task, you should receive a WhatsApp message with a "Mark as Done" button. Clicking this button should complete the task and send confirmation messages.

### Web Dashboard

1. Enter your phone number in the dashboard
2. View all your tasks (assigned to you or created by you)
3. Use the "Mark Complete" button to complete a task
4. Use the "Reopen Task" button to reactivate a completed task
5. Click "Edit Notes" to modify task notes
6. Click "Delete Task" to remove a task permanently

## Deployment

### Environment Variables

#### Backend
```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
WHATSAPP_API_KEY=your_whapi_cloud_api_key
WHAPI_BASE_URL=https://gate.whapi.cloud
NODE_ENV=production
```

#### Frontend
```
REACT_APP_API_BASE_URL=https://your-api-domain.com/api
```

## Troubleshooting

### Webhook Issues

1. **Webhook isn't receiving messages**:
   - Verify your ngrok tunnel is running (`ngrok http 5000`)
   - Check that your webhook URL in Whapi.Cloud matches your current ngrok URL
   - Ensure you've subscribed to the correct events (especially `messages` and `message_reply`)
   - Check your backend server logs for any errors

2. **Button clicks not working**:
   - Make sure the WhatsApp number is properly connected in Whapi.Cloud
   - Verify the button format in the code (`type: "quick_reply"`)
   - Check the backend logs for the incoming button response structure
   - Ensure the `handleButtonResponse` function is correctly processing the button payload

3. **Message format errors**:
   - Double check your command syntax (use `/help` to see the correct formats)
   - Ensure you're using commas to separate task parts in the `/create` command
   - Phone numbers should be in international format without the + symbol (e.g., 919818905678)

4. **Webhook payload debugging**:
   - Add additional `console.log` statements in the webhook handler to see the full message structure
   - Whapi.Cloud may change their webhook payload format, so compare what you receive against what the code expects

## Project Status and Roadmap

### Current Status
The project is currently in active development with core functionality implemented:
- WhatsApp integration for task creation and management
- Web dashboard for task visualization and management
- Reminder system
- Basic notification system

### Planned Features
- Group task management in WhatsApp groups
- Natural language processing for task creation without explicit commands
- User authentication for the web dashboard
- Mobile app version
- Advanced reporting and analytics
- Calendar integration
- Multi-language support
