// background.js

/**
 * Background service worker for Syntax Sentry Chrome Extension
 * Handles configuration management and messaging between components
 */

// Default configuration
const defaultConfig = {
  api: {
    baseUrl: "https://extension-web-mu.vercel.app",
    endpoints: { 
      activity: "/api/activity" 
    },
    request: { 
      maxRetries: 3, 
      retryDelay: 1000, 
      timeout: 10000 
    }
  },
  session: {
    expiryTime: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
    storageKey: "syntax_sentry_session"
  },
  tracking: {
    keyLogging: {
      enabled: true,
      sendInterval: 15000, // 15 seconds
      batchSize: 50,
      ignoreKeys: ['Shift', 'Control', 'Alt', 'Meta']
    },
    mouseMovement: {
      enabled: true,
      threshold: 566, // 15 cm in pixels (assuming 96 DPI)
      sampleRate: 50
    },
    copyPaste: {
      enabled: true,
      maxContentLength: 5000,
      truncateMessage: "... [content truncated]"
    },
    // Add this section for tab switching
    tabSwitching: {
      enabled: true,
      maxUrlLength: 1000,
      maxTitleLength: 200
  }

  },
  debug: true
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Syntax Sentry Installed and Ready!");
  
  try {
    // Store default configuration
    await chrome.storage.local.set({ syntaxSentryConfig: defaultConfig });
    console.log("Default configuration stored");
    
    // Initialize any other extension state
    await chrome.storage.local.set({ 
      syntaxSentryStats: {
        installDate: Date.now(),
        eventsTracked: 0,
        sessionsCreated: 0,
        lastActive: Date.now()
      }
    });
  } catch (err) {
    console.error("Error initializing extension:", err);
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }
  
  console.log("Received message:", message.type);
  
  switch (message.type) {
    case "GET_CONFIG":
      // Return the current configuration
      chrome.storage.local.get('syntaxSentryConfig', (result) => {
        sendResponse({ 
          success: true, 
          config: result.syntaxSentryConfig || defaultConfig 
        });
      });
      return true; // Keep the message channel open for async response
      
    case "UPDATE_CONFIG":
      // Update configuration
      if (message.config) {
        chrome.storage.local.set({ syntaxSentryConfig: message.config }, () => {
          sendResponse({ success: true });
        });
        return true; // Keep the message channel open for async response
      }
      sendResponse({ success: false, error: "No configuration provided" });
      return false;
      
    case "RESET_CONFIG":
      // Reset to default configuration
      chrome.storage.local.set({ syntaxSentryConfig: defaultConfig }, () => {
        sendResponse({ success: true });
      });
      return true; // Keep the message channel open for async response
      
    case "LOG_EVENT":
      // Update stats when events are tracked
      if (message.eventType) {
        chrome.storage.local.get('syntaxSentryStats', (result) => {
          const stats = result.syntaxSentryStats || {
            installDate: Date.now(),
            eventsTracked: 0,
            sessionsCreated: 0,
            lastActive: Date.now()
          };
          
          stats.eventsTracked++;
          stats.lastActive = Date.now();
          
          if (message.eventType === "session_created") {
            stats.sessionsCreated++;
          }
          
          chrome.storage.local.set({ syntaxSentryStats: stats });
        });
      }
      sendResponse({ success: true });
      return false;
  }
  
  return false;
});

// Handle tab updates to refresh content scripts if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only react if the URL matches our patterns and the page has completed loading
  if (changeInfo.status === 'complete' && tab.url) {
    const urlPatterns = [
      /leetcode\.com\/problems\//,
      /hackerrank\.com\/challenges\//,
      /codeforces\.com\/problemset\/problem\//
    ];
    
    // Check if the URL matches any of our patterns
    const shouldInject = urlPatterns.some(pattern => pattern.test(tab.url));
    
    if (shouldInject) {
      console.log("Tab updated, refreshing content scripts if needed:", tab.url);
      
      // Store tab information for tracking
      chrome.storage.local.get('syntaxSentryTabInfo', (result) => {
        const tabInfo = result.syntaxSentryTabInfo || {};
        tabInfo[tabId] = {
          url: tab.url,
          title: tab.title,
          lastUpdated: Date.now()
        };
        chrome.storage.local.set({ syntaxSentryTabInfo: tabInfo });
      });
    }
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up tab information when tab is closed
  chrome.storage.local.get('syntaxSentryTabInfo', (result) => {
    const tabInfo = result.syntaxSentryTabInfo || {};
    delete tabInfo[tabId];
    chrome.storage.local.set({ syntaxSentryTabInfo: tabInfo });
  });
});

// Handle tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  const { tabId } = activeInfo;
  
  // Get information about the previously active tab
  chrome.storage.local.get('syntaxSentryTabInfo', (result) => {
    const tabInfo = result.syntaxSentryTabInfo || {};
    const previousTab = Object.values(tabInfo).find(tab => tab.lastUpdated < Date.now());
    
    if (previousTab) {
      // Send message to content script about tab switch
      chrome.tabs.sendMessage(tabId, {
        type: 'TAB_SWITCH',
        data: {
          fromUrl: previousTab.url,
          fromTitle: previousTab.title,
          toUrl: tabInfo[tabId]?.url || '',
          toTitle: tabInfo[tabId]?.title || '',
          timestamp: Date.now()
        }
      }).catch(err => console.log("Could not send tab switch message:", err));
    }
  });
});
