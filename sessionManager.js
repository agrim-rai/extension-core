// sessionManager.js

/**
 * Manages user sessions for tracking activities
 */
class SessionManager {
    constructor() {
        // Load configuration
        this.config = window.syntaxSentryConfig || {
            session: {
                expiryTime: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
                storageKey: "syntax_sentry_session"
            },
            debug: true
        };
        
        this.init();
    }

    /**
     * Log a message if debug mode is enabled
     */
    log(...args) {
        if (this.config.debug) {
            console.log("[Syntax Sentry Session]", ...args);
        }
    }

    /**
     * Initialize the session manager
     */
    init() {
        this.checkSession();
        
        // Listen for URL changes to detect problem changes
        this.currentUrl = window.location.href;
        setInterval(() => this.checkUrlChange(), 5000);
        
        // Re-check session periodically
        setInterval(() => this.checkSession(), 60000); // Every minute
    }

    /**
     * Check if URL has changed, indicating a new problem
     */
    checkUrlChange() {
        if (this.currentUrl !== window.location.href) {
            this.log("URL changed, checking if problem changed");
            this.currentUrl = window.location.href;
            
            const oldSession = this.getSession();
            const newProblemSlug = this.getProblemSlug();
            
            if (oldSession && oldSession.problemSlug !== newProblemSlug) {
                this.log("Problem changed, creating new session");
                this.createNewSession();
            }
        }
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId(username, problemSlug) {
        return `${username}_${problemSlug}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    /**
     * Check if a session exists and is valid
     */
    checkSession() {
        const session = this.getSession();

        if (!session || this.isSessionExpired(session)) {
            this.createNewSession();
            return false;
        }
        
        return true;
    }

    /**
     * Get the current session from storage
     */
    getSession() {
        try {
            return JSON.parse(localStorage.getItem(this.config.session.storageKey));
        } catch (err) {
            this.log("Error retrieving session:", err);
            return null;
        }
    }

    /**
     * Check if the session has expired
     */
    isSessionExpired(session) {
        const currentTime = Date.now();
        return (currentTime - session.createdAt) >= this.config.session.expiryTime;
    }

    /**
     * Create a new session
     */
    createNewSession() {
        const username = this.getUsername();
        const problemSlug = this.getProblemSlug();
        const problemTitle = this.getProblemTitle();
        const platform = this.getPlatform();
        
        const newSession = {
            sessionId: this.generateSessionId(username, problemSlug),
            username,
            problemSlug,
            problemTitle,
            platform,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        localStorage.setItem(this.config.session.storageKey, JSON.stringify(newSession));
        this.log("New session started:", newSession);
        
        return newSession;
    }

    /**
     * Update the last activity timestamp
     */
    updateLastActivity() {
        const session = this.getSession();
        if (session) {
            session.lastActivity = Date.now();
            localStorage.setItem(this.config.session.storageKey, JSON.stringify(session));
        }
    }

    /**
     * Get the current username
     */
    // getUsername() {
    //     try {
    //         // First try to get username from __NEXT_DATA__ script
    //         const nextDataScript = document.getElementById('__NEXT_DATA__');
    //         if (nextDataScript) {
    //             const nextData = JSON.parse(nextDataScript.textContent);
    //             const userStatus = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.userStatus;
    //             if (userStatus?.username) {
    //                 return userStatus.username;
    //             }
    //         }
            
    //         return `user_sdnsjdnjd}`;
    //     } catch (err) {
    //         console.log("Error getting username:", err);
    //         return `user_${Math.random().toString(36).substring(2, 10)}`;
    //     }
    // }


    getUsername() {
        try {
            // First try to get username from __NEXT_DATA__ script
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (nextDataScript) {
                try {
                    // Try parsing the full JSON
                    const nextData = JSON.parse(nextDataScript.textContent);
                    const userStatus = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.userStatus;
                    if (userStatus?.username) {
                        return userStatus.username;
                    }
                } catch (jsonError) {
                    // If full parsing fails, try to extract username using regex
                    const usernameMatch = nextDataScript.textContent.match(/"username"\s*:\s*"([^"]+)"/);
                    if (usernameMatch && usernameMatch[1]) {
                        return usernameMatch[1];
                    }
                }
            }
            
            // If we got here, try to find the username in any script tag
            const allScripts = document.getElementsByTagName('script');
            for (let i = 0; i < allScripts.length; i++) {
                const scriptContent = allScripts[i].textContent || '';
                const usernameMatch = scriptContent.match(/"username"\s*:\s*"([^"]+)"/);
                if (usernameMatch && usernameMatch[1]) {
                    return usernameMatch[1];
                }
            }
            
            return `user_sdnsjdnjd`;
        } catch (err) {
            console.log("Error getting username:", err);
            return `user_${Math.random().toString(36).substring(2, 10)}`;
        }
    }

    /**
     * Get the current problem slug from URL
     */
    getProblemSlug() {
        try {
            // First try to get problem ID from __NEXT_DATA__ script
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (nextDataScript) {
                const nextData = JSON.parse(nextDataScript.textContent);
                const question = nextData?.props?.pageProps?.dehydratedState?.queries?.[1]?.state?.data?.question;
                if (question?.questionId) {
                    return question.questionId.toString();
                }
            }

            // Fallback to URL-based extraction
            const leetcodeMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
            const hackerrankMatch = window.location.pathname.match(/\/challenges\/([^\/]+)/);
            const codeforcesMatch = window.location.pathname.match(/\/problemset\/problem\/\d+\/([^\/]+)/);
            
            return (leetcodeMatch && leetcodeMatch[1]) || 
                   (hackerrankMatch && hackerrankMatch[1]) || 
                   (codeforcesMatch && codeforcesMatch[1]) || 
                   `unknown_problem_${window.location.pathname.replace(/\//g, '_')}`;
        } catch (err) {
            this.log("Error getting problem slug:", err);
            return `unknown_problem_${Date.now()}`;
        }
    }
    
    /**
     * Get the current problem title from the DOM
     */
    getProblemTitle() {
        try {
            // First try to get problem title from __NEXT_DATA__ script
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (nextDataScript) {
                const nextData = JSON.parse(nextDataScript.textContent);
                const question = nextData?.props?.pageProps?.dehydratedState?.queries?.[1]?.state?.data?.question;
                if (question?.title) {
                    return question.title;
                }
            }

            // Fallback to DOM-based extraction
            const titleElements = document.querySelectorAll('.text-title-large, .text-text-primary, .no-underline.hover\\:text-blue-s');
            
            for (const element of titleElements) {
                if (element.textContent && element.textContent.trim()) {
                    let title = element.textContent.trim();
                    title = title.replace(/^\d+\.\s*/, '');
                    return title;
                }
            }
            
            // If we can't find it in the DOM, try to extract it from the URL
            const slug = this.getProblemSlug();
            if (slug && slug !== 'unknown_problem') {
                return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            }
            
            return "Unknown Problem";
        } catch (err) {
            this.log("Error getting problem title:", err);
            return "Unknown Problem";
        }
    }
    
    /**
     * Detect the current coding platform
     */
    getPlatform() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('leetcode')) return 'leetcode';
        if (hostname.includes('hackerrank')) return 'hackerrank';
        if (hostname.includes('codeforces')) return 'codeforces';
        if (hostname.includes('codechef')) return 'codechef';
        if (hostname.includes('hackerearth')) return 'hackerearth';
        
        return hostname.replace(/\./g, '_');
    }
    
    /**
     * Get the current session data for activity tracking
     */
    getSessionData() {
        // Ensure we have a valid session
        if (!this.checkSession()) {
            this.createNewSession();
        }
        
        // Update last activity time
        this.updateLastActivity();
        
        // Return the session data
        return this.getSession();
    }

    /**
     * Check if user is signed in
     */
    isSignedIn() {
        try {
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (nextDataScript) {
                const nextData = JSON.parse(nextDataScript.textContent);
                const userStatus = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.userStatus;
                return userStatus?.isSignedIn === true;
            }
            return false;
        } catch (err) {
            this.log("Error checking sign in status:", err);
            return false;
        }
    }
}

// Create and export a singleton instance
const sessionManager = new SessionManager();

// Export the service
if (typeof module !== 'undefined' && module.exports) {
    module.exports = sessionManager;
} else {
    window.syntaxSentrySession = sessionManager;
}
