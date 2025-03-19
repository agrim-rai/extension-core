// config.js

const config = {
  // API configuration
  api: {
    // Base URL for the API (change for production)
    baseUrl: "https://extension-web-mu.vercel.app",
    
    // Endpoints
    endpoints: {
      activity: "/api/activity"
    },
    
    // Request configuration
    request: {
      maxRetries: 3,
      retryDelay: 1000, // ms
      timeout: 10000 // ms
    }
  },
  
  // Session configuration
  session: {
    expiryTime: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
    storageKey: "syntax_sentry_session"
  },
  
  // Tracking configuration
  tracking: {
    mouseMovement: {
      threshold: 566, // 15 cm in pixels (assuming 96 DPI)
      sendInterval: 0 // 0 means send immediately when threshold is reached
    },
    keyLogger: {
      sendInterval: 15000 // 15 seconds
    },
    batchSize: 50 // Maximum number of events to store before forced send
  },
  
  // Debug mode (set to false in production)
  debug: true
};

// Export the configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = config;
} else {
  window.syntaxSentryConfig = config;
} 