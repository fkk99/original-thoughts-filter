// This script runs on linkedin.com
console.log("Original Thoughts Filter: Content script loaded.");

// --- Configuration ---
// The text to look for. The "em-dash".
const SLOP_INDICATOR = '—';

// LinkedIn's CSS class for a post (feed update). This is the main container.
const POST_SELECTOR = '.feed-shared-update-v2';

// LinkedIn's CSS class for a comment.
const COMMENT_SELECTOR = '.comments-comment-item';

// Selector for the text content *within* a post.
// We check this so we don't hide posts *about* em-dashes.
const POST_TEXT_SELECTOR = '.feed-shared-update-v2__description-wrapper';

// Selector for the text content *within* a comment.
const COMMENT_TEXT_SELECTOR = '.comments-comment-item__text-wrapper';

// --- State ---
// Local cache of the filter state.
let isEnabled = true;

// --- Helper Functions ---

/**
 * Checks if a given text element contains the slop indicator.
 * @param {HTMLElement} element - The HTML element to check.
 * @param {string} textSelector - The CSS selector for the text content.
 * @returns {boolean} - True if slop is found, false otherwise.
 */
function containsSlop(element, textSelector) {
    const textElement = element.querySelector(textSelector);
    if (textElement && textElement.textContent) {
        return textElement.textContent.includes(SLOP_INDICATOR);
    }
    return false;
}

/**
 * Hides an element and increments the total hidden count.
 * @param {HTMLElement} element - The element to hide.
 */
function hideElement(element) {
    // Only hide if it's not already hidden by us
    if (element.style.display !== 'none') {
        console.log("Original Thoughts Filter: Hiding slop.", element);
        element.style.display = 'none';

        // Increment the total hidden count in storage
        chrome.storage.sync.get('totalHiddenCount', (data) => {
            let count = data.totalHiddenCount || 0;
            chrome.storage.sync.set({ totalHiddenCount: count + 1 });
        });
    }
}

/**
 * Processes a single node (post or comment) to see if it should be hidden.
 * @param {HTMLElement} node - The element to check.
 */
function processNode(node) {
    // Ensure it's an element node before proceeding
    if (node.nodeType !== 1) return;

    // Check if it's a post
    if (node.matches(POST_SELECTOR)) {
        if (containsSlop(node, POST_TEXT_SELECTOR)) {
            hideElement(node);
        }
    }

    // Check if it's a comment
    if (node.matches(COMMENT_SELECTOR)) {
        if (containsSlop(node, COMMENT_TEXT_SELECTOR)) {
            hideElement(node);
        }
    }
}

/**
 * Scans the entire document for initial slop on page load.
 */
function initialScan() {
    if (!isEnabled) return;

    document.querySelectorAll(POST_SELECTOR).forEach(node => processNode(node));
    document.querySelectorAll(COMMENT_SELECTOR).forEach(node => processNode(node));
}

// --- Main Execution ---

// 1. Create a MutationObserver to watch for new nodes (posts/comments)
// This is *much* more efficient than a timer.
const observer = new MutationObserver((mutationsList) => {
    // If the filter is off, do nothing.
    if (!isEnabled) return;

    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                // We process the node itself
                processNode(node);

                // And we check its descendants, as LinkedIn wraps new posts
                // in other container elements.
                if (node.nodeType === 1 && node.querySelectorAll) {
                    node.querySelectorAll(POST_SELECTOR).forEach(childNode => processNode(childNode));
                    node.querySelectorAll(COMMENT_SELECTOR).forEach(childNode => processNode(childNode));
                }
            });
        }
    }
});

// 2. Load the initial state from storage and start observing
chrome.storage.sync.get(['isEnabled', 'totalHiddenCount'], (data) => {
    isEnabled = data.isEnabled;

    // Only run the initial scan and start observing if enabled
    if (isEnabled) {
        console.log("Original Thoughts Filter: Filter is ON. Starting scan.");
        initialScan();

        // Start observing the document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        console.log("Original Thoughts Filter: Filter is OFF.");
    }
});

// 3. Listen for changes to the filter state (from the popup)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.isEnabled) {
        console.log("Original Thoughts Filter: State changed.");
        isEnabled = changes.isEnabled.newValue;

        if (isEnabled) {
            // Filter was just turned ON
            console.log("Original Thoughts Filter: Turning ON. Starting observer.");
            initialScan(); // Re-scan the page
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            // Filter was just turned OFF
            console.log("Original Thoughts Filter: Turning OFF. Disconnecting observer.");
            observer.disconnect();
            // Note: This won't un-hide posts. A page reload is required,
            // which is why the "Reload" button in the popup is important.
        }
    }
});

