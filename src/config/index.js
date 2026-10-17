require('dotenv').config({ quiet: true });

/**
 * Centralized configuration for the fake Meta Cloud API
 * All environment variables are loaded here
 */
const config = {
  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // Database
  database: {
    path: process.env.DB_PATH || './data/fake-meta-api.db'
  },

  // Meta WhatsApp Business Account
  meta: {
    wabaId: process.env.WABA_ID || '123456789012345',
    phoneNumberId: process.env.PHONE_NUMBER_ID || '987654321098765',
    displayPhoneNumber: process.env.DISPLAY_PHONE_NUMBER || '+1234567890'
  },

  // Webhook
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://localhost:4000/webhook',
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here'
  },

  // Authentication
  auth: {
    accessToken: process.env.API_ACCESS_TOKEN || 'your_fake_bearer_token_here'
  },

  // Delays (in milliseconds)
  delays: {
    sent: {
      min: parseInt(process.env.DELAY_SENT_MIN || '500', 10),
      max: parseInt(process.env.DELAY_SENT_MAX || '2000', 10)
    },
    delivered: {
      min: parseInt(process.env.DELAY_DELIVERED_MIN || '3000', 10),
      max: parseInt(process.env.DELAY_DELIVERED_MAX || '5000', 10)
    },
    read: {
      min: parseInt(process.env.DELAY_READ_MIN || '5000', 10),
      max: parseInt(process.env.DELAY_READ_MAX || '10000', 10)
    }
  },

  // Behavior
  behavior: {
    readProbability: parseFloat(process.env.READ_PROBABILITY || '0.7')
  },

  // Error simulation
  errors: {
    patterns: process.env.ERROR_PATTERNS || '+99999:131026,+88888:131047,+77777:131031'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true'
  }
};

module.exports = config;
