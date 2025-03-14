// Format timestamp for display
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

// Format duration for display
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update recording status
function updateRecordingStatus(isRecording) {
    const startButton = document.getElementById('startRecording');
    const stopButton = document.getElementById('stopRecording');
    const statusDiv = document.getElementById('recordingStatus');
    const infoDiv = document.getElementById('recordingInfo');
    
    if (isRecording) {
        startButton.style.display = 'none';
        stopButton.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="normal">
                <span class="status-indicator status-active"></span>
                Recording Active
            </div>
        `;
        infoDiv.innerHTML = `Recording started at ${formatTimestamp(Date.now())}`;
    } else {
        startButton.style.display = 'block';
        stopButton.style.display = 'none';
        statusDiv.innerHTML = `
            <div class="normal">
                <span class="status-indicator status-inactive"></span>
                Recording Inactive
            </div>
        `;
        infoDiv.innerHTML = '';
    }
}

// Update tab activity display
function updateTabActivity() {
    chrome.storage.local.get(['tabState', 'suspiciousActivity', 'windowState'], (result) => {
        const tabState = result.tabState || {};
        const suspiciousActivity = result.suspiciousActivity || [];
        const windowState = result.windowState || {};
        
        // Update tab status
        const tabStatus = document.getElementById('tabStatus');
        const rapidSwitches = tabState.suspiciousPatterns?.rapidSwitches || 0;
        const isWindowMinimized = windowState.isMinimized || false;
        const totalTabSwitches = tabState.totalTabSwitches || 0;
        
        let statusHTML = `
            <div class="${rapidSwitches >= 3 ? 'suspicious' : 'normal'}">
                Rapid Tab Switches: ${rapidSwitches}
            </div>
            <div class="normal">
                Total Tab Switches: ${totalTabSwitches}
            </div>
        `;
        
        if (isWindowMinimized) {
            statusHTML += `
                <div class="suspicious">
                    Browser Window Minimized
                </div>
            `;
        }
        
        tabStatus.innerHTML = statusHTML;
        
        // Update tab switches with detailed information
        const tabSwitches = document.getElementById('tabSwitches');
        if (tabState.tabSwitches) {
            const newContent = tabState.tabSwitches
                .reverse()
                .map(switchEvent => {
                    let fromInfo = switchEvent.from ? 
                        `<div class="tab-info-detail">From: ${switchEvent.from.title || 'Unknown'}</div>
                         <div class="tab-info-url">${switchEvent.from.url || 'Unknown URL'}</div>` : '';
                    
                    let toInfo = switchEvent.to ?
                        `<div class="tab-info-detail">To: ${switchEvent.to.title || 'Unknown'}</div>
                         <div class="tab-info-url">${switchEvent.to.url || 'Unknown URL'}</div>` : '';
                    
                    return `
                        <div class="tab-info">
                            <div class="tab-info-content">
                                ${fromInfo}
                                ${toInfo}
                            </div>
                            <span class="timestamp">${switchEvent.formattedTime || formatTimestamp(switchEvent.timestamp)}</span>
                        </div>
                    `;
                })
                .join('');
            
            if (tabSwitches.innerHTML !== newContent) {
                tabSwitches.innerHTML = newContent;
            }
        }
        
        // Update suspicious activity
        const suspiciousDiv = document.getElementById('suspiciousActivity');
        const suspiciousContent = suspiciousActivity
            .reverse()
            .map(activity => `
                <div class="suspicious">
                    <span>${activity.type}</span>
                    <span class="timestamp">${formatTimestamp(activity.timestamp)}</span>
                </div>
            `)
            .join('');
        
        if (suspiciousDiv.innerHTML !== suspiciousContent) {
            suspiciousDiv.innerHTML = suspiciousContent;
        }
    });
}




function updateClipboardActivity() {
    chrome.storage.local.get(['clipboardHistory'], (result) => {
        const clipboardHistory = result.clipboardHistory || [];
        const clipboardDiv = document.getElementById('clipboardHistory');
        const clipboardStatus = document.getElementById('clipboardStatus');
        
        // Update clipboard status
        clipboardStatus.innerHTML = `
            <div class="normal">
                Total Clipboard Events: ${clipboardHistory.length}
            </div>
        `;
        
        // Update clipboard history
        if (clipboardHistory.length > 0) {
            const clipboardContent = clipboardHistory
                .slice() // Create a copy to avoid modifying the original
                .reverse() // Show newest first
                .slice(0, 30) // Show more recent items (increased from 20 to 30)
                .map(item => {
                    // Handle different types of clipboard items
                    let displayText = item.text || 'No content';
                    if (displayText.length > 50) {
                        displayText = displayText.substring(0, 50) + '...';
                    }
                    
                    return `
                        <div class="clipboard-item">
                            <span>${item.type}: ${displayText}</span>
                            <span class="timestamp">${formatTimestamp(item.timestamp)}</span>
                        </div>
                    `;
                })
                .join('');
            
            clipboardDiv.innerHTML = clipboardContent;
        } else {
            clipboardDiv.innerHTML = '<div class="normal">No clipboard activity recorded</div>';
        }
    });
}



// Update submission analysis display
function updateSubmissionAnalysis() {
    chrome.storage.local.get(['codeAnalysis'], (result) => {
        const codeAnalysis = result.codeAnalysis || [];
        const analysisDiv = document.getElementById('codeAnalysis');
        
        const analysisContent = codeAnalysis
            .reverse() // Show more items
            .map(analysis => `
                <div class="analysis-item">
                    <span>Comments: ${analysis.commentCount}</span>
                    <span class="timestamp">${formatTimestamp(analysis.timestamp)}</span>
                </div>
            `)
            .join('');
        
        if (analysisDiv.innerHTML !== analysisContent) {
            analysisDiv.innerHTML = analysisContent;
        }
    });
}



function updateKeystrokeActivity() {
    chrome.storage.local.get(['keyloggerState'], (result) => {
        const keyloggerState = result.keyloggerState || {};
        const keystrokeStatus = document.getElementById('keystrokeStatus');
        const keystrokeDiv = document.getElementById('keystrokeHistory');

        // Update keystroke status
        keystrokeStatus.innerHTML = `
            <div class="normal">
                Total Keystrokes: ${keyloggerState.keystrokes?.length || 0}
            </div>
        `;

        // Update keystroke history - showing more entries (increased from default)
        if (keyloggerState.keystrokes && keyloggerState.keystrokes.length > 0) {
            const keystrokeContent = keyloggerState.keystrokes
                .slice() // Create a copy to avoid modifying the original
                .reverse() // Show newest first
                .slice(0, 40) // Show more recent keystrokes (increased number)
                .map(keystroke => {
                    // Enhanced display with more context
                    let contextInfo = '';
                    if (keystroke.element) {
                        contextInfo = ` (${keystroke.element}${keystroke.id ? ' #' + keystroke.id : ''})`;
                    }
                    
                    return `
                        <div class="tab-info">
                            <span>Key: ${keystroke.key}${contextInfo}</span>
                            <span class="timestamp">${formatTimestamp(keystroke.timestamp)}</span>
                        </div>
                    `;
                })
                .join('');

            keystrokeDiv.innerHTML = keystrokeContent;
        } else {
            keystrokeDiv.innerHTML = '<div class="normal">No keystroke activity recorded</div>';
        }
    });
}






// Update mouse movement display
function updateMouseMovement() {
    chrome.storage.local.get(['mouseMovementState'], (result) => {
        const mouseMovementState = result.mouseMovementState || { totalDistance: 0 };
        const mouseMovementDiv = document.getElementById('mouseMovementStatus');
        
        if (mouseMovementDiv) {
            mouseMovementDiv.innerHTML = `
                <div class="normal">
                    Total Mouse Distance: ${mouseMovementState.totalDistance.toFixed(2)} cm
                </div>
            `;
        }
    });
}



// Add event listeners for recording buttons
document.getElementById('startRecording').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }, (response) => {
        if (response && response.success) {
            updateRecordingStatus(true);
        } else if (response && response.error) {
            // Display error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = `Recording error: ${response.error}`;
            document.body.appendChild(errorDiv);
            
            // Remove error message after 5 seconds
            setTimeout(() => {
                document.body.removeChild(errorDiv);
            }, 5000);
        }
    });
});

document.getElementById('stopRecording').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (response) => {
        if (response && response.success) {
            updateRecordingStatus(false);
        }
    });
});



// Update all displays
function updateAll() {
    updateTabActivity();
    updateClipboardActivity();
    updateSubmissionAnalysis();
    updateKeystrokeActivity();
    updateMouseMovement();

    // Check recording state
    chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
        if (response && response.isRecording) {
            updateRecordingStatus(true);
        } else {
            updateRecordingStatus(false);
        }
    });
}

// Initial update
updateAll();

// Update more frequently for real-time feeling
setInterval(updateAll, 1000); // Changed from 2000ms to 1000ms for more frequent updates

