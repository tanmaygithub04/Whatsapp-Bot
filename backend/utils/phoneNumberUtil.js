/**
 * Utility functions for consistent phone number formatting across the application
 */

/**
 * Standardizes a phone number by:
 * 1. Removing any non-digit characters (spaces, dashes, parentheses)
 * 2. Removing WhatsApp suffixes like @c.us
 * 3. Ensuring it starts with country code if specified
 * 
 * @param {string} phoneNumber - The phone number to format
 * @param {boolean} ensureCountryCode - Whether to check for country code (not implemented yet)
 * @returns {string} - Standardized phone number
 */
const formatPhoneNumber = (phoneNumber, ensureCountryCode = false) => {
  if (!phoneNumber) return '';
  
  // Remove WhatsApp suffixes if present (e.g., @c.us)
  let formatted = phoneNumber.split('@')[0];
  
  // Remove all non-digit characters
  formatted = formatted.replace(/\D/g, '');
  
  // Future enhancement: Check for and add country code if missing
  // if (ensureCountryCode && !formatted.startsWith('+') && formatted.length < 11) {
  //   formatted = `+1${formatted}`; // Default to +1 for US/Canada
  // }
  
  return formatted;
};

module.exports = {
  formatPhoneNumber
}; 