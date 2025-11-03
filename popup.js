document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggle-switch');
    const filterStatus = document.getElementById('filter-status');
    const countDisplay = document.getElementById('hidden-count-value');

    // Function to update the UI based on storage data
    function updateUI(data) {
        if (data.isEnabled) {
            filterStatus.textContent = 'Filter is ON';
            toggleSwitch.checked = true;
        } else {
            filterStatus.textContent = 'Filter is OFF';
            toggleSwitch.checked = false;
        }

        countDisplay.textContent = data.totalHiddenCount || 0;
    }

    // 1. Initial Load: Get the current state from storage
    chrome.storage.sync.get(['isEnabled', 'totalHiddenCount'], (data) => {
        updateUI(data);
    });

    // 2. Toggle Listener: Save changes when the user clicks the toggle
    toggleSwitch.addEventListener('change', () => {
        const newState = toggleSwitch.checked;
        chrome.storage.sync.set({ isEnabled: newState }, () => {
            // Update the status text immediately on change
            filterStatus.textContent = newState ? 'Filter is ON' : 'Filter is OFF';
            console.log('AI Slop Filter: State saved:', newState);
        });
    });

    // 3. Storage Change Listener: Listen for changes from any script
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
            // Check if either state or count changed
            if (changes.isEnabled || changes.totalHiddenCount) {
                // Re-fetch all data to ensure UI is consistent
                chrome.storage.sync.get(['isEnabled', 'totalHiddenCount'], (data) => {
                    updateUI(data);
                });
            }
        }
    });
});
