// services/whatsappService.js
const axios = require('axios');
const { formatPhoneNumber } = require('../utils/phoneNumberUtil');

// Base URL for Whapi.Cloud API - ensure this is correct or default
const WHAPI_BASE_URL = process.env.WHAPI_BASE_URL || 'https://gate.whapi.cloud'; 
// API Key from environment variables
const API_KEY = process.env.WHATSAPP_API_KEY;

/**
 * Helper function to get Axios request configuration with Auth headers
 */
const getAxiosConfig = () => {
  if (!API_KEY) {
    throw new Error('WHATSAPP_API_KEY is not set in environment variables.');
  }
  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    }
  };
};

/**
 * Send a simple text message via Whapi.Cloud API
 * 
 * @param {string} to - Recipient phone number (e.g., 1234567890@c.us)
 * @param {string} text - Message text
 * @returns {Promise<Object>} - API response data
 */
async function sendMessage(to, text) {
  const recipient = formatPhoneNumber(to);
  const url = `${WHAPI_BASE_URL}/messages/text`;
  const payload = {
    to: recipient,
    body: text
  };
  const config = getAxiosConfig();

  try {
    console.log(`Sending text message to ${recipient} via Whapi...`);
    const response = await axios.post(url, payload, config);
    console.log(`Whapi text message sent successfully to ${recipient}. Status: ${response.status}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error(`Error sending text message to ${recipient} via Whapi:`, errorMsg);
    // Rethrow or handle as needed
    throw new Error(`Failed to send WhatsApp message: ${JSON.stringify(errorMsg)}`);
  }
}

/**
 * Send a message with interactive buttons via Whapi.Cloud API
 * Reference: Check Whapi.Cloud documentation for the exact payload structure.
 * This assumes a common structure for interactive button messages.
 * 
 * @param {string} to - Recipient phone number (e.g., 1234567890@c.us)
 * @param {string} text - Message body text
 * @param {Array} buttons - Array of button objects { id: string, text: string }
 * @returns {Promise<Object>} - API response data
 */
async function sendMessageWithButtons(recipient, text, buttons) {
  // const recipient = formatPhoneNumber(to);
  // Make sure to format the phone number consistently
  const formattedRecipient = formatPhoneNumber(recipient);
  
  // Ensure the endpoint is correct for interactive button messages
  const url = `${WHAPI_BASE_URL}/messages/interactive`; 
  
  const payload = {
    to: formattedRecipient,
    footer: {
      text: "Footer message"
    },
    header: {
      text: "Header with text"
    },
    type: "button", // Main message type
    body: {
    text: text
    },
    action:{
      buttons: buttons
    }
  };
  const config = getAxiosConfig();

  try {
    console.log(`Sending interactive message to ${formattedRecipient} via Whapi...`);
    const response = await axios.post(url, payload, config);
    console.log(`Whapi interactive message sent successfully to ${formattedRecipient}. Status: ${response.status}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error(`Error sending interactive message to ${formattedRecipient} via Whapi:`, errorMsg);
    // Rethrow or handle as needed
    throw new Error(`Failed to send WhatsApp interactive message: ${JSON.stringify(errorMsg)}`);
  }
}

// Export only the functions needed by other services/controllers
module.exports = {
  sendMessage,
  sendMessageWithButtons
};