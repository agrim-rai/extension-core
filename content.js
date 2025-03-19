// content.js

/**
 * Content script for Syntax Sentry Chrome Extension
 * This script initializes all tracking modules and manages their lifecycle
 */

// Initialize configuration first
(function() {
    // Global variables for tracking
    let totalMouseDistance = 0;
    let lastMouseX = null;
    let lastMouseY = null;
    let keyPressCount = 0;
    let copyPasteCount = 0;
    
    // Load configuration
    const loadConfig = async () => {
        try {
            // Try to get config from storage
            const storageData = await new Promise(resolve => {
                chrome.storage.local.get('syntaxSentryConfig', resolve);
            });
            
            // If config exists in storage, use it
            if (storageData && storageData.syntaxSentryConfig) {
                window.syntaxSentryConfig = storageData.syntaxSentryConfig;
                console.log("Syntax Sentry: Loaded configuration from storage");
            } else {
                // Otherwise load from config.js
                const configScript = document.createElement('script');
                configScript.src = chrome.runtime.getURL('config.js');
                configScript.onload = function() {
                    console.log("Syntax Sentry: Loaded configuration from config.js");
                    this.remove();
                };
                (document.head || document.documentElement).appendChild(configScript);
            }
        } catch (err) {
            console.error("Syntax Sentry: Error loading configuration", err);
        }
    };

    // Get session data safely
    const getSessionData = () => {
        if (window.syntaxSentrySession && typeof window.syntaxSentrySession.getSessionData === 'function') {
            return window.syntaxSentrySession.getSessionData();
        }
        
        // Fallback if session manager isn't available
        try {
            const storageKey = (window.syntaxSentryConfig && window.syntaxSentryConfig.session.storageKey) || 
                              "syntax_sentry_session";
            const sessionData = JSON.parse(localStorage.getItem(storageKey)) || {};
            
            // Ensure we have a problemTitle
            if (!sessionData.problemTitle && sessionData.problemSlug) {
                sessionData.problemTitle = sessionData.problemSlug
                    .split('-')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }
            
            return sessionData;
        } catch (err) {
            console.error("Syntax Sentry: Error getting session data", err);
            return {
                sessionId: `fallback_${Date.now()}`,
                username: "unknown_user",
                problemSlug: "unknown_problem",
                problemTitle: "Unknown Problem",
                platform: window.location.hostname.replace(/\./g, '_')
            };
        }
    };

    // Send activity data to the backend
    const sendActivity = (eventType, details = {}) => {
        try {
            const session = getSessionData();
            
            // Check if user is signed in
            if (!window.syntaxSentrySession.isSignedIn()) {
                console.log("Syntax Sentry: User not signed in, skipping activity tracking");
                return;
            }
            
            // Ensure we have a problemTitle and problemId
            const problemTitle = session.problemTitle || "Unknown Problem";
            const problemId = session.problemSlug || "unknown_problem";
            
            const activityData = {
                eventType,
                sessionId: session.sessionId || `fallback_${Date.now()}`,
                username: session.username || "unknown_user",
                problemId,
                problemName: problemId,
                problemTitle: problemTitle,
                platform: session.platform || window.location.hostname.replace(/\./g, '_'),
                timestamp: Date.now(),
                ...details
            };
            
            // Use the API service if available
            if (window.syntaxSentryApi && typeof window.syntaxSentryApi.sendActivity === 'function') {
                window.syntaxSentryApi.sendActivity(activityData)
                    .catch(err => console.error("Syntax Sentry: Error sending activity", err));
            } else {
                // Fallback to direct fetch
                const apiUrl = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.baseUrl) || 
                              "https://extension-web-mu.vercel.app";
                const endpoint = (window.syntaxSentryConfig && window.syntaxSentryConfig.api.endpoints.activity) || 
                                "/api/activity";
                
                fetch(`${apiUrl}${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(activityData)
                }).catch(err => console.error("Syntax Sentry: Error sending activity", err));
            }
        } catch (err) {
            console.error("Syntax Sentry: Error in sendActivity", err);
        }
    };

    // Initialize all modules in the correct order
    const initializeModules = () => {
        // Load API service first
        const apiScript = document.createElement('script');
        apiScript.src = chrome.runtime.getURL('apiService.js');
        apiScript.onload = function() {
            this.remove();
            
            // Then load session manager
            const sessionScript = document.createElement('script');
            sessionScript.src = chrome.runtime.getURL('sessionManager.js');
            sessionScript.onload = function() {
                this.remove();
                
                // Then load all trackers in parallel
                const trackerScripts = [
                    'keyLogger.js',
                    'mouseMovementTracker.js',
                    'copyPasteTracker.js',
                    'tabSwitchTracker.js'  // Add this line

                ];
                
                trackerScripts.forEach(script => {
                    const trackerScript = document.createElement('script');
                    trackerScript.src = chrome.runtime.getURL(script);
                    trackerScript.onload = function() {
                        this.remove();
                    };
                    (document.head || document.documentElement).appendChild(trackerScript);
                });
                
                // Send page view event after modules are loaded
                setTimeout(() => {
                    sendActivity('page_view', {
                        url: window.location.href,
                        title: document.title,
                        referrer: document.referrer
                    });
                }, 1000);
            };
            (document.head || document.documentElement).appendChild(sessionScript);
        };
        (document.head || document.documentElement).appendChild(apiScript);
    };

    // Start initialization
    const init = async () => {
        await loadConfig();
        
        // Wait a short time to ensure config is loaded
        setTimeout(() => {
            initializeModules();
            console.log("Syntax Sentry: All modules initialized");
        }, 100);
    };

    // Initialize when the page is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TAB_SWITCH') {
            // Handle tab switch message
            const { fromUrl, fromTitle, toUrl, toTitle, timestamp } = message.data;
            
            // Get session data
            const session = getSessionData();
            
            // Create tab switch event
            const tabSwitchEvent = {
                eventType: 'tab_switch',
                sessionId: session.sessionId,
                username: session.username,
                problemId: session.problemSlug,
                problemName: session.problemSlug,
                problemTitle: session.problemTitle,
                platform: session.platform,
                fromUrl: fromUrl,
                fromTitle: fromTitle,
                toUrl: toUrl,
                toTitle: toTitle,
                timestamp: timestamp
            };
            
            // Send the event
            sendActivity('tab_switch', tabSwitchEvent);
        }
    });
    
    // Clean up when the page is unloaded
    window.addEventListener('beforeunload', () => {
        // Try to clean up trackers
        if (window.syntaxSentryKeyLogger && window.syntaxSentryKeyLogger.cleanup) {
            window.syntaxSentryKeyLogger.cleanup();
        }
        
        if (window.syntaxSentryMouseTracker && window.syntaxSentryMouseTracker.cleanup) {
            window.syntaxSentryMouseTracker.cleanup();
        }
        
        if (window.syntaxSentryCopyPasteTracker && window.syntaxSentryCopyPasteTracker.cleanup) {
            window.syntaxSentryCopyPasteTracker.cleanup();
        }
        
        if (window.syntaxSentryTabSwitchTracker && window.syntaxSentryTabSwitchTracker.cleanup) {
            window.syntaxSentryTabSwitchTracker.cleanup();
        }
        
        // Send final stats
        sendActivity('session_ended', {
            totalMouseDistance,
            keyPressCount,
            copyPasteCount,
            sessionDuration: Date.now() - (getSessionData().createdAt || Date.now())
        });
        
        console.log("Syntax Sentry: Cleaned up all trackers");
    });

})();

console.log("Syntax Sentry Content Script Loaded!");
    