document.addEventListener('DOMContentLoaded', function() {
    // Get the current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        
        // Check if we're on a LeetCode problem page
        if (currentTab.url && currentTab.url.includes('leetcode.com/problems/')) {
            document.querySelector('.status').textContent = 'Active';
            document.querySelector('.info').textContent = 'Monitoring LeetCode activity...';
        } else {
            document.querySelector('.status').textContent = 'Inactive';
            document.querySelector('.info').textContent = 'Please navigate to a LeetCode problem page';
        }
    });
}); 