// keyLogger.js

/**
 * Tracks keyboard activity and sends it to the backend
 */
class KeyLogger {
    constructor() {
        // Load configuration
        this.config = window.syntaxSentryConfig || {
            tracking: {
                keyLogging: {
                    enabled: true,
                    sendInterval: 15000, // 15 seconds
                    batchSize: 50, // Maximum keys to send in one batch
                    ignoreKeys: ['Shift', 'Control', 'Alt', 'Meta'] // Keys to ignore
                }
            },
            debug: true
        };
        
        this.keyLogs = [];
        this.totalKeyPresses = 0;
        this.init();
    }

    /**
     * Log a message if debug mode is enabled
     */
    log(...args) {
        if (this.config.debug) {
            console.log("[Syntax Sentry KeyLogger]", ...args);
        }
    }

    /**
     * Initialize the key logger
     */
    init() {
        if (!this.config.tracking.keyLogging.enabled) {
            this.log("Key logging disabled in configuration");
            return;
        }
        
        document.addEventListener("keydown", (event) => this.logKey(event));
        
        // Set up interval for sending logs
        this.sendInterval = setInterval(
            () => this.sendKeyLogs(), 
            this.config.tracking.keyLogging.sendInterval
        );
        
        // Expose total key presses to window for other components to access
        if (typeof window !== 'undefined') {
            window.syntaxSentryKeyPressCount = 0;
        }
        
        this.log("Key logger initialized");
    }

    /**
     * Get session information from the session manager
     */
    getSessionData() {
        // Use the session manager if available
        if (window.syntaxSentrySession) {
            return window.syntaxSentrySession.getSessionData();
        }
        
        // Fallback to local storage if session manager not available
        try {
            return JSON.parse(localStorage.getItem("syntax_sentry_session")) || {};
        } catch (err) {
            this.log("Error retrieving session:", err);
            return {};
        }
    }

    /**
     * Log a key press event
     */
    logKey(event) {
        // Skip ignored keys
        if (this.config.tracking.keyLogging.ignoreKeys.includes(event.key)) {
            return;
        }
        
        // Get the active element to know where the user is typing
        const activeElement = document.activeElement;
        const elementType = activeElement ? activeElement.tagName.toLowerCase() : 'unknown';
        const elementId = activeElement ? activeElement.id || 'unknown' : 'unknown';
        
        // Increment total key press count
        this.totalKeyPresses++;
        
        // Update global variable for other components
        if (typeof window !== 'undefined') {
            window.syntaxSentryKeyPressCount = this.totalKeyPresses;
        }
        
        // Add key to logs
        this.keyLogs.push({
            key: event.key,
            timestamp: Date.now(),
            elementType,
            elementId
        });
        
        // If we've reached the batch size, send immediately
        if (this.keyLogs.length >= this.config.tracking.keyLogging.batchSize) {
            this.sendKeyLogs();
        }
    }

    /**
     * Send collected key logs to the backend
     */
    sendKeyLogs() {
        if (this.keyLogs.length === 0) return; // No keys pressed

        const session = this.getSessionData();
        
        // Prepare event data
        const eventData = {
            eventType: "key_press",
            sessionId: session.sessionId || "unknown_session",
            username: session.username || "unknown_user",
            problemName: session.problemSlug || "unknown_problem",
            problemTitle: session.problemTitle || "Unknown Problem",
            platform: session.platform || "unknown_platform",
            numberOfKeys: this.keyLogs.length,
            totalKeyPresses: this.totalKeyPresses,
            keyLogs: this.keyLogs,
            sentTimestamp: Date.now(),
        };

        this.log(`Sending ${this.keyLogs.length} key events (total: ${this.totalKeyPresses})`);
        
        // Use the API service if available
        if (window.syntaxSentryApi) {
            window.syntaxSentryApi.sendActivity(eventData)
                .then(response => {
                    if (response && response.success === false && !response.queued) {
                        this.log("Failed to send key logs:", response.error);
                    }
                })
                .catch(err => this.log("Error sending key logs:", err));
        } else {
            // Fallback to direct fetch if API service not available
            const apiUrl = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.baseUrl) || 
                           "https://extension-web-mu.vercel.app";
            const endpoint = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.endpoints.activity) || 
                             "/api/activity";
                             
            fetch(`${apiUrl}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventData),
            }).catch(err => this.log("Error sending key logs:", err));
        }

        // Reset log after sending
        this.keyLogs = [];
    }
    
    /**
     * Get the total number of key presses
     */
    getTotalKeyPresses() {
        return this.totalKeyPresses;
    }
    
    /**
     * Clean up resources when the extension is unloaded
     */
    cleanup() {
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
        }
        
        // Send any remaining logs
        if (this.keyLogs.length > 0) {
            this.sendKeyLogs();
        } else if (this.totalKeyPresses > 0) {
            // Send final stats even if no current logs
            const session = this.getSessionData();
            const eventData = {
                eventType: "key_press_summary",
                sessionId: session.sessionId || "unknown_session",
                username: session.username || "unknown_user",
                problemName: session.problemSlug || "unknown_problem",
                problemTitle: session.problemTitle || "Unknown Problem",
                platform: session.platform || "unknown_platform",
                totalKeyPresses: this.totalKeyPresses,
                sentTimestamp: Date.now(),
            };
            
            if (window.syntaxSentryApi) {
                window.syntaxSentryApi.sendActivity(eventData)
                    .catch(err => this.log("Error sending final key stats:", err));
            }
        }
        
        document.removeEventListener("keydown", this.logKey);
        this.log("Key logger cleaned up");
    }
}

// Create and export a singleton instance
const keyLogger = new KeyLogger();

// Export the service
if (typeof module !== 'undefined' && module.exports) {
    module.exports = keyLogger;
} else {
    window.syntaxSentryKeyLogger = keyLogger;
}
