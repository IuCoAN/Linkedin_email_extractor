// LinkedIn Email Extractor - Background Script

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        // Set default settings
        const defaultSettings = {
            scanConnections: true,
            scanMessages: false,
            scanProfile: true,
            scanDepth: "1",
            validateEmails: true,
            filterDisposable: false,
            scanDelay: 3
        };
        
        // Save default settings
        chrome.storage.local.set({
            settings: defaultSettings,
            extractedEmails: []
        });
    }
});

// Listen for icon clicks (optional feature: scan current tab when icon is clicked)
chrome.action.onClicked.addListener((tab) => {
    // Only react if we're on LinkedIn
    if (tab.url.includes("linkedin.com")) {
        // Open the popup
        // Note: In Manifest V3, we can't programmatically open the popup,
        // but we can listen for this event if we want custom behavior
    }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadCSV") {
        // Handle CSV download if needed
        // Note: Most download functionality is handled in popup.js
    }
    
    return false; // Not handling response asynchronously
});

// Optional: Set badge with number of emails
function updateBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "#0a66c2" });
    } else {
        chrome.action.setBadgeText({ text: "" });
    }
}

// Optional: Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.extractedEmails) {
        const emails = changes.extractedEmails.newValue || [];
        updateBadge(emails.length);
    }
});