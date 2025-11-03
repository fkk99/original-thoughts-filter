// This script runs in the background and initializes default settings.

// On install, set the default state to 'enabled' and count to 0.
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        isEnabled: true,
        totalHiddenCount: 0
    }, () => {
        console.log('Original Thoughts Filter: Default state set to ON.');
    });
});

