// Content script for Syntax Sentry

function getLeetCodeUserDetails() {
    const usernameElement = document.querySelector('a[href^="/u/"]'); // Select the first <a> with /u/
    if (usernameElement) {
        const hrefValue = usernameElement.getAttribute("href"); // Get href="/u/username"
        const username = hrefValue.split("/u/")[1]; // Extract username from href
        const fullName = usernameElement.innerText.trim(); // Extract full name from <a> text
        return { username, fullName };
    }
    return { username: "Unknown", fullName: "Unknown" }; // Default if not found
}

function getLeetCodeProblemDetails() {
    const problemElement = document.querySelector('a[href^="/problems/"]'); // Select the first problem link
    const { problemTitle, problemUrl } = getLeetCodeProblemDetails();

    if (problemElement) {
        const problemUrl = problemElement.getAttribute("href"); // Extract href="/problems/add-two-numbers/"
        const problemTitle = problemElement.innerText.trim().split(". ").slice(1).join(". "); // Remove the problem number
        return { problemTitle, problemUrl: "https://leetcode.com" + problemUrl };
    }
    return { problemTitle: "Unknown", problemUrl: "Unknown" }; // Default if not found
}

(function() {
    console.log("Syntax Sentry activated on LeetCode problem page.");

    const backendUrl = "http://localhost:3000/api/activity";
    const { username, fullName } = getLeetCodeUserDetails();
    let keyPressCount = 0;
    let copyCount = 0;
    let pasteCount = 0;
    let pageOpenTime = Date.now();
    let lastActivityTime = Date.now();
    let idleTime = 0;
    
    function sendActivity(eventType, details = {}) {
        chrome.runtime.sendMessage({
            type: "log_activity",
            data: {
                eventType,
                username,
                fullName,
                problemTitle, 
                problemUrl, 
                details,
                timestamp: new Date().toISOString()
            }
        });
    }
    

    function updateIdleTime() {
        idleTime = Date.now() - lastActivityTime;
    }

    // Track tab visibility (minimize/maximize detection)
    document.addEventListener("visibilitychange", () => {
        sendActivity("tab_visibility", { state: document.visibilityState, time: new Date().toISOString() });
    });

    // Track mouse movement
    document.addEventListener("mousemove", (event) => {
        lastActivityTime = Date.now();
        sendActivity("mouse_movement", { x: event.clientX, y: event.clientY, time: new Date().toISOString() });
    });

    // Track clipboard events
    document.addEventListener("copy", (event) => {
        copyCount++;
        sendActivity("clipboard_copy", { copiedText: window.getSelection().toString(), time: new Date().toISOString(), totalCopies: copyCount });
    });
    document.addEventListener("paste", (event) => {
        pasteCount++;
        sendActivity("clipboard_paste", { pastedText: event.clipboardData.getData("text"), time: new Date().toISOString(), totalPastes: pasteCount });
    });

    // Detect tab switching
    window.addEventListener("blur", () => sendActivity("tab_switched", { action: "blur", time: new Date().toISOString() }));
    window.addEventListener("focus", () => sendActivity("tab_switched", { action: "focus", time: new Date().toISOString() }));

    // Key logger
    document.addEventListener("keydown", (event) => {
        keyPressCount++;
        lastActivityTime = Date.now();
        sendActivity("key_press", { key: event.key, time: new Date().toISOString(), totalKeysPressed: keyPressCount });
    });

    // Detect problem submission
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.innerText && node.innerText.includes("Accepted")) {
                        sendActivity("problem_submitted", { time: new Date().toISOString(), totalTimeOpen: (Date.now() - pageOpenTime) / 1000, totalKeysPressed: keyPressCount, totalCopies: copyCount, totalPastes: pasteCount, idleTime: idleTime / 1000 });
                    }
                });
            }
        });
    });

    setInterval(() => {
        if (totalMouseDistance > 1) { // Only send if moved significantly
            sendActivity("mouse_movement", { totalDistanceCm: totalMouseDistance });
            totalMouseDistance = 0; // Reset
        }
    }, 30000); // Every 30 seconds

    

    observer.observe(document.body, { childList: true, subtree: true });
    
    setInterval(updateIdleTime, 5000); // Update idle time every 5 seconds
})();

