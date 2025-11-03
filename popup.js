// This script runs when the popup is opened.

// Get references to all the HTML elements we need
const toggleSwitch = document.getElementById('toggle-switch');
const toggleLabel = document.getElementById('toggle-label');
const hiddenCountEl = document.getElementById('hidden-count');
const reloadButton = document.getElementById('reload-button');

// Function to update the label text based on the switch state
function updateLabel(isEnabled) {
    if (isEnabled) {
        toggleLabel.textContent = 'Filter is ON';
    } else {
        toggleLabel.textContent = 'Filter is OFF';
    }
}

// 1. Initialize the popup state when it's opened
document.addEventListener('DOMContentLoaded', () => {
    // Get the current saved values from chrome.storage
    chrome.storage.sync.get(['isEnabled', 'totalHiddenCount'], (data) => {
        // Set the toggle switch to the saved state
        toggleSwitch.checked = data.isEnabled;

        // Update the label to match
        updateLabel(data.isEnabled);

        // Set the hidden count
        hiddenCountEl.textContent = data.totalHiddenCount || 0;
    });
});

// 2. Listen for changes on the toggle switch
toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;

    // Save the new state to storage
    chrome.storage.sync.set({ isEnabled: isEnabled });

    // Update the label
    updateLabel(isEnabled);
});

// 3. Listen for clicks on the reload button
reloadButton.addEventListener('click', () => {
    // Find the currently active LinkedIn tab and reload it
    chrome.tabs.query({ active: true, url: "*://*.linkedin.com/*" }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.reload(tabs[0].id);
        } else {
            // If no active LinkedIn tab, just close the popup
            // (or you could open a new LinkedIn tab)
            window.close();
        }
    });
});

// 4. (Optional but good) Listen for real-time changes to storage
// This ensures the count updates *while* the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.totalHiddenCount) {
        hiddenCountEl.textContent = changes.totalHiddenCount.newValue || 0;
    }
});

