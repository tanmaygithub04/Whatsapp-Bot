// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Webhook for WhatsApp messages// Webhook for interactive responses (button clicks)
// router.post('/interaction', whatsappController.handleInteraction);

router.post('/webhook', whatsappController.processMessage);

// Send a message via WhatsApp (for testing/dashboard use)
router.post('/send', async (req, res) => {
  try {
    const { recipient, message } = req.body;
    
    if (!recipient || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const whatsappService = require('../services/whatsappService');
    const result = await whatsappService.sendMessage(recipient, message);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;