// This script runs on linkedin.com
console.log("AI Slop Filter [v3]: Content script loaded.");

// --- Configuration ---
// The text to look for. The "em-dash".
const SLOP_INDICATOR = '—';

// LinkedIn's CSS selectors for posts. We use multiple as a fallback.
// [data-urn*='...'] is more stable than class names.
const POST_SELECTORS = [
    "[data-urn*='urn:li:share:']",        // A shared post
    "[data-urn*='urn:li:activity:']",      // A native post (text, image)
    ".feed-shared-update-v2"            // The "classic" selector
];

// Selectors for the text content *within* a post.
const POST_TEXT_SELECTORS = [
    ".update-components-text",           // The main text block
    "[class*='commentary']",             // A common class name pattern
    ".feed-shared-update-v2__description-wrapper" // The "classic" one
];

// Selectors for a comment.
const COMMENT_SELECTORS = [
    "article[aria-label*='Comment by']", // A good accessibility selector
    ".comments-comment-item"             // The "classic" selector
];

// Selectors for the text content *within* a comment.
const COMMENT_TEXT_SELECTORS = [
    ".comments-comment-item__text-wrapper", // The "classic" one
    "[class*='comment-item__text']"         // A common class name pattern
];

// --- State ---
// Local cache of the filter state.
let isEnabled = true;

// --- Helper Functions ---

/**
 * Checks if a given element matches any of the selectors in an array.
 * @param {HTMLElement} element - The HTML element to check.
 * @param {string[]} selectors - The array of CSS selectors.
 * @returns {boolean} - True if it matches any selector.
 */
function matchesAny(element, selectors) {
    return selectors.some(selector => element.matches(selector));
}

/**
 * Gets the text content from the first matching selector.
 * @param {HTMLElement} element - The parent element.
 * @param {string[]} selectors - The array of CSS selectors for the text.
 * @returns {string} - The text content, or an empty string.
 */
function getTextContent(element, selectors) {
    for (const selector of selectors) {
        const textElement = element.querySelector(selector);
        if (textElement && textElement.textContent) {
            return textElement.textContent;
        }
    }
    return "";
}

/**
 * Checks if a given text element contains the slop indicator.
 * @param {HTMLElement} element - The HTML element to check (e.g., the post container).
 * @param {string[]} textSelectors - The CSS selectors for the text content.
 * @returns {boolean} - True if slop is found, false otherwise.
 */
function containsSlop(element, textSelectors) {
    const textContent = getTextContent(element, textSelectors);
    return textContent.includes(SLOP_INDICATOR);
}

/**
 * Hides an element and increments the total hidden count.
 * @param {HTMLElement} element - The element to hide.
 */
function hideElement(element) {
    // Only hide if it's not already hidden by us
    if (element.style.display !== 'none') {
        // console.log("AI Slop Filter: Hiding slop.", element); // Note: More detailed log is now in processNode
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

    try {
        // Check if it's a post
        if (matchesAny(node, POST_SELECTORS)) {
            if (containsSlop(node, POST_TEXT_SELECTORS)) {
                const text = getTextContent(node, POST_TEXT_SELECTORS).substring(0, 70);
                console.log(`%cAI Slop Filter: Hiding POST. Reason: Found slop indicator. Text starts with: "${text}..."`, "color: #ff8c00;", node);
                hideElement(node);
            }
        }

        // Check if it's a comment
        if (matchesAny(node, COMMENT_SELECTORS)) {
            if (containsSlop(node, COMMENT_TEXT_SELECTORS)) {
                const text = getTextContent(node, COMMENT_TEXT_SELECTORS).substring(0, 70);
                console.log(`%cAI Slop Filter: Hiding COMMENT. Reason: Found slop indicator. Text starts with: "${text}..."`, "color: #ffb800;", node);
                hideElement(node);
            }
        }
    } catch (e) {
        console.error("AI Slop Filter: Error processing node:", e, node);
    }
}

/**
 * Scans the entire document for initial slop on page load.
 */
function initialScan() {
    if (!isEnabled) return;

    console.log("AI Slop Filter: Running initial page scan...");
    try {
        document.querySelectorAll(POST_SELECTORS.join(', ')).forEach(node => processNode(node));
        document.querySelectorAll(COMMENT_SELECTORS.join(', ')).forEach(node => processNode(node));
    } catch (e) {
        console.error("AI Slop Filter: Error during initialScan:", e);
    }
    console.log("AI Slop Filter: Initial page scan complete.");
}

// --- Main Execution ---

// 1. Create a MutationObserver to watch for new nodes (posts/comments)
const observer = new MutationObserver((mutationsList) => {
    if (!isEnabled) return;

    try {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return; // Only process element nodes

                    // We process the node itself
                    processNode(node);

                    // And we check its descendants
                    if (node.querySelectorAll) {
                        node.querySelectorAll(POST_SELECTORS.join(', ')).forEach(childNode => processNode(childNode));
                        node.querySelectorAll(COMMENT_SELECTORS.join(', ')).forEach(childNode => processNode(childNode));
                    }
                });
            }
        }
    } catch (e) {
        console.error("AI Slop Filter: Error inside MutationObserver:", e);
    }
});

// 2. Load the initial state from storage and start observing
chrome.storage.sync.get(['isEnabled', 'totalHiddenCount'], (data) => {
    isEnabled = data.isEnabled;

    if (isEnabled) {
        console.log("AI Slop Filter: Filter is ON. Starting scan.");
        // Wait for the page to be a bit more settled before the initial scan
        setTimeout(initialScan, 1000);

        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        console.log("AI Slop Filter: Filter is OFF.");
    }
});

// 3. Listen for changes to the filter state (from the popup)
chrome.storage.onChanged.addListener((changes, area) => {
    try {
        if (area === 'sync' && changes.isEnabled) {
            console.log("AI Slop Filter: State changed.");
            isEnabled = changes.isEnabled.newValue;

            if (isEnabled) {
                console.log("AI Slop Filter: Turning ON. Starting observer.");
                setTimeout(initialScan, 5); // Re-scan the page
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                console.log("AI Slop Filter: Turning OFF. Disconnecting observer.");
                observer.disconnect();
            }
        }
    } catch (e) {
        console.error("AI Slop Filter: Error in storage.onChanged listener:", e);
    }
});

