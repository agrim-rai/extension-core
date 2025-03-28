// copyPasteTracker.js

/**
 * Tracks copy and paste events and sends them to the backend
 */
class CopyPasteTracker {
    constructor() {
        // Load configuration
        this.config = window.syntaxSentryConfig || {
            tracking: {
                copyPaste: {
                    enabled: true,
                    maxContentLength: 5000, // Maximum length of content to send
                    truncateMessage: "... [content truncated]"
                }
            },
            debug: true
        };
        
        this.copyCount = 0;
        this.pasteCount = 0;
        this.init();
        
        // Retry failed events periodically
        setInterval(() => this.retryFailedEvents(), 120000); // Every 2 minutes
    }

    /**
     * Log a message if debug mode is enabled
     */
    log(...args) {
        if (this.config.debug) {
            console.log("[Syntax Sentry CopyPasteTracker]", ...args);
        }
    }

    /**
     * Initialize the copy/paste tracker
     */
    init() {
        if (!this.config.tracking.copyPaste.enabled) {
            this.log("Copy/Paste tracking disabled in configuration");
            return;
        }
        
        document.addEventListener("copy", (event) => this.handleCopy(event));
        document.addEventListener("paste", (event) => this.handlePaste(event));
        
        // Expose total copy/paste count to window for other components to access
        if (typeof window !== 'undefined') {
            window.syntaxSentryCopyPasteCount = 0;
        }
        
        this.log("Copy/Paste tracker initialized");
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
     * Get information about the current page
     */
    getPageInfo() {
        return {
            url: window.location.href,
            tabTitle: document.title,
            path: window.location.pathname,
            hostname: window.location.hostname
        };
    }

    /**
     * Safely truncate content if it's too long
     */
    truncateContent(content) {
        if (!content) return "";
        
        const maxLength = this.config.tracking.copyPaste.maxContentLength;
        if (content.length <= maxLength) return content;
        
        return content.substring(0, maxLength) + this.config.tracking.copyPaste.truncateMessage;
    }

    /**
     * Handle copy events
     */
    handleCopy(event) {
        try {
            const copiedText = window.getSelection().toString();
            if (!copiedText.trim()) return;
    
            // Increment copy count
            this.copyCount++;
            
            // Update global counter
            if (typeof window !== 'undefined') {
                window.syntaxSentryCopyPasteCount = this.copyCount + this.pasteCount;
            }
            
            const session = this.getSessionData();
            const pageInfo = this.getPageInfo();
    
            // Get the active element to know where the user is copying from
            const activeElement = document.activeElement;
            const elementType = activeElement ? activeElement.tagName.toLowerCase() : 'unknown';
            const elementId = activeElement ? activeElement.id || 'unknown' : 'unknown';
    
            const copyData = {
                eventType: "copy",
                sessionId: session.sessionId || "unknown_session",
                username: session.username || "unknown_user",
                problemName: session.problemSlug || "unknown_problem",
                problemTitle: session.problemTitle || "Unknown Problem",
                platform: session.platform || "unknown_platform",
                timestamp: Date.now(),
                data: this.truncateContent(copiedText),
                contentLength: copiedText.length,
                copyCount: this.copyCount,
                pasteCount: this.pasteCount,
                sourceElement: JSON.stringify({  // Convert object to string
                    type: elementType,
                    id: elementId
                }),
                page: pageInfo
            };
            
            this.log(`Copy event detected (total: ${this.copyCount})`);
            this.sendEvent(copyData);
        } catch (err) {
            this.log("Error handling copy event:", err);
        }
    }

    /**
     * Handle paste events
     */
    // handlePaste(event) {
    //     try {
    //         const pastedText = (event.clipboardData || window.clipboardData).getData("text");
    //         if (!pastedText.trim()) return;
    
    //         // Increment paste count
    //         this.pasteCount++;
            
    //         // Update global counter
    //         if (typeof window !== 'undefined') {
    //             window.syntaxSentryCopyPasteCount = this.copyCount + this.pasteCount;
    //         }
            
    //         const session = this.getSessionData();
    //         const pageInfo = this.getPageInfo();
    
    //         // Get the active element to know where the user is pasting to
    //         const activeElement = document.activeElement;
    //         const elementType = activeElement ? activeElement.tagName.toLowerCase() : 'unknown';
    //         const elementId = activeElement ? activeElement.id || 'unknown' : 'unknown';
    
    //         if (typeof data.targetElement === 'object') {
    //             data.targetElement = JSON.stringify(data.targetElement);
    //           }
    //         const pasteData = {
    //             eventType: "paste",
    //             sessionId: session.sessionId || "unknown_session",
    //             username: session.username || "unknown_user",
    //             problemName: session.problemSlug || "unknown_problem",
    //             problemTitle: session.problemTitle || "Unknown Problem",
    //             platform: session.platform || "unknown_platform",
    //             timestamp: Date.now(),
    //             data: pastedText,
    //             contentLength: pastedText.length,
    //             copyCount: this.copyCount,
    //             pasteCount: this.pasteCount,
    //             targetElement: JSON.stringify({  // Convert object to string
    //                 type: elementType,
    //                 id: elementId
    //             }),
    //             page: pageInfo
    //         };
            

    //         this.log(`Paste event detected (total: ${this.pasteCount})`);
    //         this.sendEvent(pasteData);
    //     } catch (err) {
    //         this.log("Error handling paste event:", err);
    //     }
    // }


    handlePaste(event) {
        try {
            const pastedText = (event.clipboardData || window.clipboardData).getData("text");
            if (!pastedText.trim()) return;
    
            // Increment paste count
            this.pasteCount++;
            
            // Update global counter
            if (typeof window !== 'undefined') {
                window.syntaxSentryCopyPasteCount = this.copyCount + this.pasteCount;
            }
            
            const session = this.getSessionData();
            const pageInfo = this.getPageInfo();
    
            // Get the active element to know where the user is pasting to
            const activeElement = document.activeElement;
            const elementType = activeElement ? activeElement.tagName.toLowerCase() : 'unknown';
            const elementId = activeElement ? activeElement.id || 'unknown' : 'unknown';
    
            const pasteData = {
                eventType: "paste",
                sessionId: session.sessionId || "unknown_session",
                username: session.username || "unknown_user",
                problemName: session.problemSlug || "unknown_problem",
                problemTitle: session.problemTitle || "Unknown Problem",
                platform: session.platform || "unknown_platform",
                timestamp: Date.now(),
                data: pastedText,
                contentLength: pastedText.length,
                copyCount: this.copyCount,
                pasteCount: this.pasteCount,
                targetElement: `${elementType}_${elementId}`, // Simplified string representation
                page: pageInfo
            };
    
            this.log(`Paste event detected (total: ${this.pasteCount})`);
            this.sendEvent(pasteData);
        } catch (err) {
            this.log("Error handling paste event:", err);
        }
    }

    /**
     * Send event data to the backend
     */
    sendEvent(eventData) {
        try {
            // Add timestamp if not present
            if (!eventData.timestamp) {
                eventData.timestamp = Date.now();
            }
            
            // Use the API service if available
            if (window.syntaxSentryApi) {
                window.syntaxSentryApi.sendActivity(eventData)
                    .then(response => {
                        if (response && response.success === false) {
                            if (!response.queued) {
                                this.log("Failed to send copy/paste event:", response.error);
                            } else {
                                this.log("Copy/paste event queued for later sending");
                            }
                        }
                    })
                    .catch(err => {
                        this.log("Error sending copy/paste event:", err);
                        this.fallbackSendEvent(eventData);
                    });
            } else {
                // Fallback to direct fetch if API service not available
                this.fallbackSendEvent(eventData);
            }
        } catch (err) {
            this.log("Error in sendEvent:", err);
            // Try the fallback method as a last resort
            this.fallbackSendEvent(eventData);
        }
    }
    
    /**
     * Fallback method to send event data directly
     */
    fallbackSendEvent(eventData) {
        try {
            const apiUrl = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.baseUrl) || 
                           "https://extension-web-mu.vercel.app";
            const endpoint = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.endpoints.activity) || 
                             "/api/activity";
            
            // Add request ID for tracking
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            eventData._requestId = requestId;
            
            this.log(`[${requestId}] Fallback sending to ${apiUrl}${endpoint}`);
            
            // Truncate content if needed
            if (eventData.content && typeof eventData.content === 'string' && 
                eventData.content.length > this.config.tracking.copyPaste.maxContentLength) {
                eventData.content = this.truncateContent(eventData.content);
            }
            
            fetch(`${apiUrl}${endpoint}`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Request-ID": requestId
                },
                body: JSON.stringify(eventData),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.log(`[${requestId}] Fallback send successful:`, data);
            })
            .catch(err => {
                this.log(`[${requestId}] Fallback send error:`, err);
                this.storeFailedEvent(eventData);
            });
        } catch (err) {
            this.log("Error in fallbackSendEvent:", err);
            this.storeFailedEvent(eventData);
        }
    }
    
    /**
     * Store failed event in localStorage for later retry
     */
    storeFailedEvent(eventData) {
        try {
            // Get existing failed events
            let failedEvents = [];
            const storedEvents = localStorage.getItem('syntaxSentryFailedEvents');
            
            if (storedEvents) {
                failedEvents = JSON.parse(storedEvents);
                if (!Array.isArray(failedEvents)) {
                    failedEvents = [];
                }
            }
            
            // Add new failed event
            failedEvents.push({
                data: eventData,
                timestamp: Date.now()
            });
            
            // Keep only the last 50 events to avoid localStorage limits
            if (failedEvents.length > 50) {
                failedEvents = failedEvents.slice(-50);
            }
            
            // Store back to localStorage
            localStorage.setItem('syntaxSentryFailedEvents', JSON.stringify(failedEvents));
            
            this.log(`Stored failed event in localStorage. Total: ${failedEvents.length}`);
        } catch (err) {
            this.log("Error storing failed event:", err);
        }
    }
    
    /**
     * Get total copy and paste counts
     */
    getCounts() {
        return {
            copyCount: this.copyCount,
            pasteCount: this.pasteCount,
            total: this.copyCount + this.pasteCount
        };
    }
    
    /**
     * Clean up resources when the extension is unloaded
     */
    cleanup() {
        document.removeEventListener("copy", this.handleCopy);
        document.removeEventListener("paste", this.handlePaste);
        
        // Send final stats
        if (this.copyCount > 0 || this.pasteCount > 0) {
            const session = this.getSessionData();
            const summaryData = {
                eventType: "copy_paste_summary",
                sessionId: session.sessionId || "unknown_session",
                username: session.username || "unknown_user",
                problemName: session.problemSlug || "unknown_problem",
                problemTitle: session.problemTitle || "Unknown Problem",
                platform: session.platform || "unknown_platform",
                timestamp: Date.now(),
                copyCount: this.copyCount,
                pasteCount: this.pasteCount,
                totalEvents: this.copyCount + this.pasteCount
            };
            
            if (window.syntaxSentryApi) {
                window.syntaxSentryApi.sendActivity(summaryData)
                    .catch(err => this.log("Error sending final copy/paste stats:", err));
            }
        }
        
        this.log("Copy/Paste tracker cleaned up");
    }

    /**
     * Retry failed events stored in localStorage
     */
    retryFailedEvents() {
        try {
            // Check if we're online
            if (!navigator.onLine) {
                this.log("Device is offline, skipping retry of failed events");
                return;
            }
            
            // Get stored failed events
            const storedEvents = localStorage.getItem('syntaxSentryFailedEvents');
            if (!storedEvents) {
                return;
            }
            
            let failedEvents = [];
            try {
                failedEvents = JSON.parse(storedEvents);
                if (!Array.isArray(failedEvents)) {
                    failedEvents = [];
                }
            } catch (err) {
                this.log("Error parsing failed events:", err);
                localStorage.removeItem('syntaxSentryFailedEvents');
                return;
            }
            
            if (failedEvents.length === 0) {
                return;
            }
            
            this.log(`Retrying ${failedEvents.length} failed events`);
            
            // Process up to 10 events at a time
            const eventsToRetry = failedEvents.splice(0, 10);
            let successCount = 0;
            
            // Process each event
            const retryPromises = eventsToRetry.map(async (item) => {
                try {
                    // Use API service if available
                    if (window.syntaxSentryApi) {
                        const response = await window.syntaxSentryApi.sendActivity(item.data);
                        if (response && response.success !== false) {
                            successCount++;
                            return true;
                        }
                        return false;
                    } else {
                        // Use direct fetch as fallback
                        const apiUrl = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.baseUrl) || 
                                      "https://extension-web-mu.vercel.app";
                        const endpoint = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.endpoints.activity) || 
                                        "/api/activity";
                        
                        const response = await fetch(`${apiUrl}${endpoint}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(item.data),
                        });
                        
                        if (response.ok) {
                            successCount++;
                            return true;
                        }
                        return false;
                    }
                } catch (err) {
                    this.log("Error retrying event:", err);
                    return false;
                }
            });
            
            // Wait for all retries to complete
            Promise.all(retryPromises).then(results => {
                // Count successful retries
                const successfulRetries = results.filter(result => result).length;
                
                // Update localStorage with remaining failed events
                if (failedEvents.length > 0 || successfulRetries < eventsToRetry.length) {
                    // Add back events that failed to retry
                    const failedRetries = eventsToRetry.filter((_, index) => !results[index]);
                    const updatedFailedEvents = [...failedRetries, ...failedEvents];
                    
                    localStorage.setItem('syntaxSentryFailedEvents', JSON.stringify(updatedFailedEvents));
                    this.log(`Retry complete: ${successfulRetries} succeeded, ${updatedFailedEvents.length} remaining`);
                } else {
                    // All events successfully retried
                    localStorage.removeItem('syntaxSentryFailedEvents');
                    this.log("All failed events successfully retried");
                }
            });
        } catch (err) {
            this.log("Error in retryFailedEvents:", err);
        }
    }
}

// Create and export a singleton instance
const copyPasteTracker = new CopyPasteTracker();

// Export the service
if (typeof module !== 'undefined' && module.exports) {
    module.exports = copyPasteTracker;
} else {
    window.syntaxSentryCopyPasteTracker = copyPasteTracker;
}
