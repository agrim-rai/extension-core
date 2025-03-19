// mouseMovementTracker.js

/**
 * Tracks mouse movement and sends events when threshold is reached
 */
class MouseMovementTracker {
    constructor() {
        // Load configuration
        this.config = window.syntaxSentryConfig || {
            tracking: {
                mouseMovement: {
                    enabled: true,
                    threshold: 7559, // 200 cm in pixels (assuming 96 DPI)
                    sampleRate: 50 // Only track every Nth mouse move event
                }
            },
            debug: true
        };
        
        this.movementDistance = 0;
        this.totalDistance = 0;
        this.lastX = null;
        this.lastY = null;
        this.moveCount = 0;
        this.init();
    }

    /**
     * Log a message if debug mode is enabled
     */
    log(...args) {
        if (this.config.debug) {
            console.log("[Syntax Sentry MouseTracker]", ...args);
        }
    }

    /**
     * Initialize the mouse movement tracker
     */
    init() {
        if (!this.config.tracking.mouseMovement.enabled) {
            this.log("Mouse movement tracking disabled in configuration");
            return;
        }
        
        document.addEventListener("mousemove", (event) => this.trackMovement(event));
        this.log("Mouse movement tracker initialized");
        
        // Expose total distance to window for other components to access
        if (typeof window !== 'undefined') {
            window.syntaxSentryTotalMouseDistance = 0;
        }
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
     * Track mouse movement and calculate distance
     */
    trackMovement(event) {
        // Sample rate implementation - only process every Nth event to reduce CPU usage
        this.moveCount++;
        if (this.moveCount % this.config.tracking.mouseMovement.sampleRate !== 0) {
            return;
        }
        
        if (this.lastX === null || this.lastY === null) {
            this.lastX = event.clientX;
            this.lastY = event.clientY;
            return;
        }

        // Calculate distance moved
        const dx = event.clientX - this.lastX;
        const dy = event.clientY - this.lastY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Get the element under the cursor
        const elementUnderCursor = document.elementFromPoint(event.clientX, event.clientY);
        const elementType = elementUnderCursor ? elementUnderCursor.tagName.toLowerCase() : 'unknown';
        const elementId = elementUnderCursor ? elementUnderCursor.id || 'unknown' : 'unknown';

        // Update distances
        this.movementDistance += distance;
        this.totalDistance += distance;
        
        // Update global variable for other components
        if (typeof window !== 'undefined') {
            window.syntaxSentryTotalMouseDistance = this.totalDistance;
        }
        
        this.lastX = event.clientX;
        this.lastY = event.clientY;

        // If threshold reached, send event
        if (this.movementDistance >= this.config.tracking.mouseMovement.threshold) {
            this.sendEvent({
                distance: this.movementDistance,
                totalDistance: this.totalDistance,
                elementType,
                elementId,
                x: event.clientX,
                y: event.clientY
            });
            this.movementDistance = 0; // Reset counter for next event
        }
    }

    /**
     * Send mouse movement event to the backend
     */
    sendEvent(details) {
        const session = this.getSessionData();
        
        const eventData = {
            eventType: "mouse_movement",
            sessionId: session.sessionId || "unknown_session",
            username: session.username || "unknown_user",
            problemName: session.problemSlug || "unknown_problem",
            problemTitle: session.problemTitle || "Unknown Problem",
            platform: session.platform || "unknown_platform",
            timestamp: Date.now(),
            details: details || {},
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };

        this.log("Mouse movement threshold reached, sending event");
        
        // Use the API service if available
        if (window.syntaxSentryApi) {
            window.syntaxSentryApi.sendActivity(eventData)
                .then(response => {
                    if (response && response.success === false && !response.queued) {
                        this.log("Failed to send mouse movement event:", response.error);
                    }
                })
                .catch(err => this.log("Error sending mouse movement event:", err));
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
            }).catch(err => this.log("Error sending mouse movement event:", err));
        }
    }
    
    /**
     * Get the total distance moved
     */
    getTotalDistance() {
        return this.totalDistance;
    }
    
    /**
     * Clean up resources when the extension is unloaded
     */
    cleanup() {
        document.removeEventListener("mousemove", this.trackMovement);
        
        // Send final stats before cleanup
        if (this.totalDistance > 0) {
            this.sendEvent({
                finalStats: true,
                totalDistance: this.totalDistance
            });
        }
        
        this.log("Mouse movement tracker cleaned up");
    }
}

// Create and export a singleton instance
const mouseMovementTracker = new MouseMovementTracker();

// Export the service
if (typeof module !== 'undefined' && module.exports) {
    module.exports = mouseMovementTracker;
} else {
    window.syntaxSentryMouseTracker = mouseMovementTracker;
}
