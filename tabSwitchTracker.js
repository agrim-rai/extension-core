// tabSwitchTracker.js

/**
 * Tab Switch Tracker for Syntax Sentry Chrome Extension
 * Monitors when users switch between tabs while solving coding problems
 */

class TabSwitchTracker {
    constructor() {
      // Load configuration
      this.config = window.syntaxSentryConfig || {
        debug: true,
        tracking: {
          tabSwitching: {
            enabled: true,
            maxUrlLength: 1000,
            maxTitleLength: 200
          }
        }
      };
      
      // Queue for storing events before sending
      this.eventQueue = [];
      
      // Flag to track if we're currently in focus
      this.isCurrentlyInFocus = document.visibilityState === 'visible';
      
      // Last tab data (to track what they switched from)
      this.lastTabData = null;
      
      // Initialize the tracker
      this.init();
    }
    
    /**
     * Log a message if debug mode is enabled
     */
    log(...args) {
      if (this.config.debug) {
        console.log("[Syntax Sentry Tab Tracker]", ...args);
      }
    }
    
    /**
     * Initialize the tab switch tracker
     */
    init() {
      // Store initial tab data
      this.lastTabData = {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
      };
      
      // Listen for visibility change events
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      
      // Listen for title changes
      const originalTitle = document.title;
      const titleObserver = new MutationObserver(() => {
        if (document.title !== originalTitle) {
          this.handleTitleChange(document.title);
        }
      });
      
      // Configure the observer to watch the document title
      titleObserver.observe(document.querySelector('title'), { 
        subtree: true, 
        characterData: true, 
        childList: true 
      });
      
      this.log("Tab switch tracker initialized");
    }
    
    /**
     * Handle visibility change events (tab focus/blur)
     */
    handleVisibilityChange() {
      const isVisible = document.visibilityState === 'visible';
      const timestamp = Date.now();
      
      if (isVisible && !this.isCurrentlyInFocus) {
        // Tab gained focus (switched to this tab)
        this.handleTabFocus(timestamp);
      } else if (!isVisible && this.isCurrentlyInFocus) {
        // Tab lost focus (switched away from this tab)
        this.handleTabBlur(timestamp);
      }
      
      this.isCurrentlyInFocus = isVisible;
    }
    
    /**
     * Handle tab focus events (user switches to this tab)
     */
    handleTabFocus(timestamp) {
      try {
        const currentTabData = {
          url: window.location.href,
          title: document.title,
          timestamp: timestamp
        };
        
        // Calculate time spent away
        const timeAwayMs = timestamp - (this.lastTabData?.timestamp || timestamp);
        
        // Get session data for tracking
        const sessionData = this.getSessionData();
        
        // Create tab switch event
        const tabSwitchEvent = {
          eventType: 'tab_switch_in',
          sessionId: sessionData.sessionId,
          username: sessionData.username,
          problemId: sessionData.problemSlug,
          problemName: sessionData.problemSlug,
          problemTitle: sessionData.problemTitle,
          platform: sessionData.platform,
          fromUrl: this.truncateString(this.lastTabData?.url || '', this.config.tracking.tabSwitching.maxUrlLength),
          fromTitle: this.truncateString(this.lastTabData?.title || '', this.config.tracking.tabSwitching.maxTitleLength),
          toUrl: this.truncateString(currentTabData.url, this.config.tracking.tabSwitching.maxUrlLength),
          toTitle: this.truncateString(currentTabData.title, this.config.tracking.tabSwitching.maxTitleLength),
          fromTimestamp: this.lastTabData?.timestamp,
          toTimestamp: timestamp,
          timeAwayMs: timeAwayMs,
          timestamp: timestamp
        };
        
        this.log("Tab focus detected:", tabSwitchEvent);
        
        // Send the event
        this.sendEvent(tabSwitchEvent);
        
        // Update last tab data
        this.lastTabData = currentTabData;
      } catch (err) {
        this.log("Error handling tab focus:", err);
      }
    }
    
    /**
     * Handle tab blur events (user switches away from this tab)
     */
    handleTabBlur(timestamp) {
      try {
        const currentTabData = {
          url: window.location.href,
          title: document.title,
          timestamp: timestamp
        };
        
        // Calculate time spent on tab
        const timeOnTabMs = timestamp - (this.lastTabData?.timestamp || timestamp);
        
        // Get session data for tracking
        const sessionData = this.getSessionData();
        
        // Create tab switch event
        const tabSwitchEvent = {
          eventType: 'tab_switch_out',
          sessionId: sessionData.sessionId,
          username: sessionData.username,
          problemId: sessionData.problemSlug,
          problemName: sessionData.problemSlug,
          problemTitle: sessionData.problemTitle,
          platform: sessionData.platform,
          fromUrl: this.truncateString(currentTabData.url, this.config.tracking.tabSwitching.maxUrlLength),
          fromTitle: this.truncateString(currentTabData.title, this.config.tracking.tabSwitching.maxTitleLength),
          timeOnTabMs: timeOnTabMs,
          timestamp: timestamp
        };
        
        this.log("Tab blur detected:", tabSwitchEvent);
        
        // Send the event
        this.sendEvent(tabSwitchEvent);
        
        // Update last tab data
        this.lastTabData = currentTabData;
      } catch (err) {
        this.log("Error handling tab blur:", err);
      }
    }
    
    /**
     * Handle title changes while the tab is in focus
     */
    handleTitleChange(newTitle) {
      if (!this.isCurrentlyInFocus || !this.lastTabData) return;
      
      const timestamp = Date.now();
      const oldTitle = this.lastTabData.title;
      
      // Only track meaningful title changes
      if (newTitle !== oldTitle) {
        const sessionData = this.getSessionData();
        
        const titleChangeEvent = {
          eventType: 'title_change',
          sessionId: sessionData.sessionId,
          username: sessionData.username,
          problemId: sessionData.problemSlug,
          problemName: sessionData.problemSlug,
          problemTitle: sessionData.problemTitle,
          platform: sessionData.platform,
          oldTitle: this.truncateString(oldTitle, this.config.tracking.tabSwitching.maxTitleLength),
          newTitle: this.truncateString(newTitle, this.config.tracking.tabSwitching.maxTitleLength),
          url: this.truncateString(window.location.href, this.config.tracking.tabSwitching.maxUrlLength),
          timestamp: timestamp
        };
        
        this.log("Title change detected:", titleChangeEvent);
        
        // Send the event
        this.sendEvent(titleChangeEvent);
        
        // Update last tab data
        this.lastTabData = {
          url: this.lastTabData.url,
          title: newTitle,
          timestamp: timestamp
        };
      }
    }
    
    /**
     * Truncate strings to prevent oversized payloads
     */
    truncateString(str, maxLength) {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '... [truncated]';
    }
    
    /**
     * Get session data safely
     */
    getSessionData() {
      if (window.syntaxSentrySession && typeof window.syntaxSentrySession.getSessionData === 'function') {
        return window.syntaxSentrySession.getSessionData();
      }
      
      // Fallback if session manager isn't available
      try {
        const storageKey = (window.syntaxSentryConfig && window.syntaxSentryConfig.session.storageKey) || 
                           "syntax_sentry_session";
        const sessionData = JSON.parse(localStorage.getItem(storageKey)) || {};
        
        // Ensure we have the required fields
        return {
          sessionId: sessionData.sessionId || `fallback_${Date.now()}`,
          username: sessionData.username || "unknown_user",
          problemSlug: sessionData.problemSlug || "unknown_problem",
          problemTitle: sessionData.problemTitle || "Unknown Problem",
          platform: sessionData.platform || window.location.hostname.replace(/\./g, '_')
        };
      } catch (err) {
        this.log("Error getting session data", err);
        return {
          sessionId: `fallback_${Date.now()}`,
          username: "unknown_user",
          problemSlug: "unknown_problem",
          problemTitle: "Unknown Problem",
          platform: window.location.hostname.replace(/\./g, '_')
        };
      }
    }
    
    /**
     * Send event to the backend
     */
    sendEvent(event) {
      try {
        // Use the API service if available
        if (window.syntaxSentryApi && typeof window.syntaxSentryApi.sendActivity === 'function') {
          window.syntaxSentryApi.sendActivity(event)
            .catch(err => this.log("Error sending tab switch event", err));
        } else {
          // Queue event for later
          this.eventQueue.push(event);
          this.processEventQueue();
        }
      } catch (err) {
        this.log("Error sending event:", err);
        
        // Queue for later
        this.eventQueue.push(event);
      }
    }
    
    /**
     * Process queued events when API service becomes available
     */
    processEventQueue() {
      // If API service is now available
      if (window.syntaxSentryApi && typeof window.syntaxSentryApi.sendActivity === 'function') {
        while (this.eventQueue.length > 0) {
          const event = this.eventQueue.shift();
          window.syntaxSentryApi.sendActivity(event)
            .catch(err => this.log("Error processing queued event", err));
        }
      } else {
        // Try again later
        setTimeout(() => this.processEventQueue(), 5000);
      }
    }
    
    /**
     * Clean up event handlers
     */
    cleanup() {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.log("Tab switch tracker cleaned up");
    }
  }
  
  // Create and export a singleton instance
  const tabSwitchTracker = new TabSwitchTracker();
  
  // Export the service
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = tabSwitchTracker;
  } else {
    window.syntaxSentryTabSwitchTracker = tabSwitchTracker;
  }