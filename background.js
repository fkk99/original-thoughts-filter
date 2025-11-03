// Set default state on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        isEnabled: true,
        totalHiddenCount: 0
    }, () => {
        console.log('AI Slop Filter: Default state set.');
    });
});

