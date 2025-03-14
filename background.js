

let globalClipboardHistory = [];

// Tab monitoring state
let tabState = {
    activeTabs: new Map(),
    tabSwitches: [],
    totalTabSwitches: 0,
    suspiciousPatterns: {
        rapidSwitches: 0,
        lastSwitch: Date.now(),
        flaggedTabs: new Set()
    }
};

// Screen recording state
let recordingState = {
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    startTime: null,
    stream: null
};

// Window state monitoring
let windowState = {
    isMinimized: false,
    lastFocusChange: Date.now()
};

// Keylogger state
let keyloggerState = {
    keystrokes: [],
    lastKeystroke: Date.now(),
    suspiciousPatterns: {
        rapidKeystrokes: 0,
        lastKeystroke: Date.now()
    }
};

// Mouse movement tracking
let mouseMovementState = {
    totalDistance: 0,
    lastUpdate: Date.now()
};

// Helper function to safely set chrome storage
// In background.js - Fix the storage function
function safeStorageSet(data, callback) {
    chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
            console.error('Chrome storage error:', chrome.runtime.lastError);
            if (callback) callback(false, chrome.runtime.lastError);
        } else {
            console.log('Successfully stored data:', Object.keys(data));
            if (callback) callback(true);
        }
    });
}






// Update the message listener to handle clipboard data better
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.type === "clipboard") {
            console.log("Received clipboard data:", message.data.type);
            // Add to clipboard history without limiting
            if (!globalClipboardHistory) {
                globalClipboardHistory = [];
            }
            globalClipboardHistory.push(message.data);
            
            // Store in chrome storage for persistence
            safeStorageSet({ clipboardHistory: globalClipboardHistory }, (success) => {
                if (success) {
                    console.log("Clipboard history saved successfully");
                } else {
                    console.error("Failed to save clipboard history");
                }
            });
            
            // Send response
            sendResponse({ success: true });
        } else if (message.type === "KEYSTROKE") {
            // Handle individual keystrokes
            if (!keyloggerState.keystrokes) {
                keyloggerState.keystrokes = [];
            }
            keyloggerState.keystrokes.push(message.data);
            keyloggerState.lastKeystroke = Date.now();
            
            // Store updated state - using a batch approach to avoid excessive storage operations
            if (!keyloggerState.storageUpdatePending) {
                keyloggerState.storageUpdatePending = true;
                setTimeout(() => {
                    safeStorageSet({ keyloggerState });
                    keyloggerState.storageUpdatePending = false;
                }, 500); // Update storage every 500ms at most
            }
            
            // Send response
            sendResponse({ success: true });
        } else if (message.type === "UPDATE_KEYLOGGER_STATE") {
            // Update entire keylogger state
            keyloggerState = message.data;
            safeStorageSet({ keyloggerState });
            sendResponse({ success: true });
        } else if (message.type === "UPDATE_ACTIVITY_STATE") {
            // Store activity state
            safeStorageSet({ activityState: message.data });
            sendResponse({ success: true });
        } else if (message.type === "UPDATE_MOUSE_MOVEMENT") {
            // Update mouse movement tracking
            if (!mouseMovementState) {
                mouseMovementState = {
                    totalDistance: 0,
                    lastUpdate: Date.now()
                };
            }
            mouseMovementState.totalDistance = message.data.totalDistance;
            mouseMovementState.lastUpdate = message.data.timestamp;
            
            // Store updated state
            safeStorageSet({ mouseMovementState });
            sendResponse({ success: true });
        } else if (message.type === "SUSPICIOUS_ACTIVITY") {
            // Handle suspicious activity reports
            chrome.storage.local.get(['suspiciousActivity'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('Error getting suspicious activity:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    return;
                }
                
                const suspiciousActivity = result.suspiciousActivity || [];
                suspiciousActivity.push(message.data);
                safeStorageSet({ suspiciousActivity });
                sendResponse({ success: true });
            });
        } else if (message.type === "GET_RECORDING_STATE") {
            sendResponse({
                isRecording: recordingState.isRecording,
                startTime: recordingState.startTime
            });
        } else if (message.type === "START_RECORDING") {
            startScreenRecording()
                .then((result) => {
                    sendResponse(result || { success: true });
                })
                .catch((error) => {
                    console.error("Error starting recording:", error);
                    sendResponse({ success: false, error: error.message });
                });
        } else if (message.type === "STOP_RECORDING") {
            const result = stopScreenRecording();
            sendResponse({ success: result });
        }
    } catch (error) {
        console.error("Error handling message:", error);
        sendResponse({ success: false, error: error.message });
    }
    
    // Return true to indicate async response
    return true;
});






// Monitor tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const now = Date.now();
    const lastSwitch = tabState.suspiciousPatterns.lastSwitch;
    const timeSinceLastSwitch = now - lastSwitch;
    
    // Get the previous tab info
    const previousTabId = tabState.activeTabs.get('current');
    let previousTabInfo = null;
    if (previousTabId) {
        try {
            const previousTab = await chrome.tabs.get(previousTabId);
            previousTabInfo = {
                url: previousTab.url,
                title: previousTab.title
            };
        } catch (error) {
            console.error('Error getting previous tab info:', error);
        }
    }
    
    // Get the new tab info
    let newTabInfo = null;
    try {
        const newTab = await chrome.tabs.get(activeInfo.tabId);
        newTabInfo = {
            url: newTab.url,
            title: newTab.title
        };
    } catch (error) {
        console.error('Error getting new tab info:', error);
    }
    
    // Record tab switch with detailed information
    const switchEntry = {
        fromTabId: previousTabId || null,
        toTabId: activeInfo.tabId,
        timestamp: now,
        timeSinceLastSwitch,
        formattedTime: new Date(now).toLocaleTimeString(),
        from: previousTabInfo ? {
            url: previousTabInfo.url,
            title: previousTabInfo.title
        } : null,
        to: newTabInfo ? {
            url: newTabInfo.url,
            title: newTabInfo.title
        } : null
    };
    
    tabState.tabSwitches.push(switchEntry);
    tabState.totalTabSwitches++;
    tabState.activeTabs.set('current', activeInfo.tabId);
    
    // Check for suspicious patterns
    if (timeSinceLastSwitch < 2000) {
        tabState.suspiciousPatterns.rapidSwitches++;
    } else {
        tabState.suspiciousPatterns.rapidSwitches = 0;
    }
    
    tabState.suspiciousPatterns.lastSwitch = now;
    
    // Store updated state
    safeStorageSet({ tabState });
});

// Monitor tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        tabState.activeTabs.set(tabId, {
            url: tab.url,
            title: tab.title,
            lastUpdated: Date.now()
        });
        safeStorageSet({ tabState });
    }
});

// Monitor window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
    const now = Date.now();
    windowState.lastFocusChange = now;
    
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Window lost focus
        windowState.isMinimized = true;
        
        // Flag suspicious activity
        chrome.storage.local.get(['suspiciousActivity'], (result) => {
            const suspiciousActivity = result.suspiciousActivity || [];
            suspiciousActivity.push({
                type: 'windowMinimized',
                timestamp: now,
                details: {
                    duration: now - windowState.lastFocusChange
                }
            });
            chrome.storage.local.set({ suspiciousActivity });
        });
    } else {
        windowState.isMinimized = false;
    }
    
    chrome.storage.local.set({ windowState });
});

// Fixed screen recording function
async function startScreenRecording() {
    try {
        if (recordingState.isRecording) {
            console.log("Already recording, ignoring request");
            return { success: true, message: "Already recording" };
        }
        
        console.log("Starting screen recording...");
        
        // Reset recording state
        recordingState.recordedChunks = [];
        recordingState.startTime = Date.now();
        
        // Use try-catch to handle potential errors with getDisplayMedia
        try {
            // Check if chrome.desktopCapture is available
            if (chrome.desktopCapture) {
                console.log("Using chrome.desktopCapture API");
                // Use chrome.desktopCapture API
                return new Promise((resolve, reject) => {
                    chrome.desktopCapture.chooseDesktopMedia(
                        ['screen', 'window', 'tab'],
                        function(streamId) {
                            if (streamId) {
                                navigator.mediaDevices.getUserMedia({
                                    video: {
                                        mandatory: {
                                            chromeMediaSource: 'desktop',
                                            chromeMediaSourceId: streamId
                                        }
                                    }
                                }).then(stream => {
                                    handleStream(stream);
                                    resolve({ success: true });
                                }).catch(error => {
                                    console.error("Error accessing media:", error);
                                    reject(error);
                                });
                            } else {
                                reject(new Error('No stream selected'));
                            }
                        }
                    );
                });
            } else {
                console.log("Using navigator.mediaDevices.getDisplayMedia API");
                // Fallback to navigator.mediaDevices.getDisplayMedia
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { mediaSource: 'screen' }
                });
                handleStream(stream);
                return { success: true };
            }
        } catch (error) {
            console.error('Error accessing display media:', error);
            throw new Error('Failed to access screen: ' + error.message);
        }
        
        function handleStream(stream) {
            console.log("Stream obtained, setting up recorder");
            recordingState.stream = stream;
            recordingState.isRecording = true;
            
            // Set up media recorder with appropriate options
            let options;
            try {
                options = { mimeType: 'video/webm; codecs=vp9' };
                recordingState.mediaRecorder = new MediaRecorder(stream, options);
            } catch (e) {
                console.error("VP9 codec not supported, trying VP8");
                try {
                    options = { mimeType: 'video/webm; codecs=vp8' };
                    recordingState.mediaRecorder = new MediaRecorder(stream, options);
                } catch (e) {
                    console.error("VP8 codec not supported, trying default");
                    recordingState.mediaRecorder = new MediaRecorder(stream);
                }
            }
            
            // Set up event handlers
            recordingState.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    console.log(`Received chunk of size: ${event.data.size}`);
                    recordingState.recordedChunks.push(event.data);
                }
            };
            
            // Handle recording stop
            recordingState.mediaRecorder.onstop = () => {
                console.log("Recording stopped, processing data");
                if (recordingState.recordedChunks.length === 0) {
                    console.error("No data recorded");
                    return;
                }
                
                const blob = new Blob(recordingState.recordedChunks, {
                    type: 'video/webm'
                });
                
                console.log(`Created blob of size: ${blob.size}`);
                
                // Create download link
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `screen-recording-${new Date().toISOString()}.webm`;
                
                // Append to document and trigger download
                document.body.appendChild(a);
                a.click();
                
                // Clean up
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                
                // Stop all tracks
                if (recordingState.stream) {
                    recordingState.stream.getTracks().forEach(track => track.stop());
                }
                
                // Reset state
                recordingState.isRecording = false;
                recordingState.stream = null;
                
                // Save state
                safeStorageSet({ recordingState });
            };
            
            // Start recording
            console.log("Starting media recorder");
            recordingState.mediaRecorder.start(1000); // Capture every second
            
            // Save state
            safeStorageSet({ recordingState });
            
            // Add event listener for stream end
            stream.getVideoTracks()[0].onended = () => {
                console.log("Video track ended");
                if (recordingState.mediaRecorder && recordingState.isRecording) {
                    recordingState.mediaRecorder.stop();
                }
            };
        }
    } catch (error) {
        console.error('Error in startScreenRecording:', error);
        throw error;
    }
}

function stopScreenRecording() {
    try {
        console.log("Stopping screen recording...");
        if (recordingState.mediaRecorder && recordingState.isRecording) {
            recordingState.mediaRecorder.stop();
            
            // Stop all tracks
            if (recordingState.stream) {
                recordingState.stream.getTracks().forEach(track => track.stop());
            }
            
            return true;
        }
        console.log("No active recording to stop");
        return false;
    } catch (error) {
        console.error('Error stopping recording:', error);
        return false;
    }
}

// Initialize storage
chrome.storage.local.get(['tabState', 'windowState', 'recordingState'], (result) => {
    if (result.tabState) {
        tabState = result.tabState;
    }
    if (result.windowState) {
        windowState = result.windowState;
    }
    if (result.recordingState) {
        recordingState = result.recordingState;
    }
});

// Add initialization function
function initialize() {
    // Add downloads permission to manifest if not already there
    chrome.permissions.contains({ permissions: ['downloads'] }, (result) => {
        if (!result) {
            chrome.permissions.request({ permissions: ['downloads'] });
        }
    });
}

// Run initialization
initialize();