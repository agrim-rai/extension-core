// Background script for Syntax Sentry
chrome.runtime.onInstalled.addListener(() => {
    console.log("Syntax Sentry extension installed.");
});

// Listener for tab switching events
chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        if (tab.url && tab.url.includes("leetcode.com/problems/")) {
            sendActivity("tab_switched", { tabId: activeInfo.tabId, url: tab.url, time: new Date().toISOString() });
        }
    });
});

// Listener for tab updates (detects if user navigates away or refreshes the page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && tab.url.includes("leetcode.com/problems/")) {
        sendActivity("tab_updated", { tabId, url: tab.url, time: new Date().toISOString() });
    }
});

// Detect when the user closes the tab
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    sendActivity("tab_closed", { tabId, time: new Date().toISOString() });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "log_activity") {
        fetch("http://localhost:3000/api/activity", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(message.data)
        })
        .then(response => response.json())
        .then(data => console.log("Activity logged:", data))
        .catch(error => console.error("Error logging activity:", error));
    }
});
