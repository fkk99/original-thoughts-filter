console.log("AI Slop Filter: Content script loaded.");

// The "em-dash" character
const SLOP_INDICATOR = '—';

// Selectors for posts. [data-urn] is more stable than classes.
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

let isEnabled = true;

function matchesAny(element, selectors) {
    return selectors.some(selector => element.matches(selector));
}

function getTextContent(element, selectors) {
    for (const selector of selectors) {
        const textElement = element.querySelector(selector);
        if (textElement && textElement.textContent) {
            return textElement.textContent;
        }
    }
    return "";
}

function containsSlop(element, textSelectors) {
    const textContent = getTextContent(element, textSelectors);
    return textContent.includes(SLOP_INDICATOR);
}

function hideElement(element) {
    // Only hide if not already hidden
    if (element.style.display !== 'none') {
        element.style.display = 'none';

        // Increment the total hidden count
        chrome.storage.sync.get('totalHiddenCount', (data) => {
            let count = data.totalHiddenCount || 0;
            chrome.storage.sync.set({ totalHiddenCount: count + 1 });
        });
    }
}

function processNode(node) {
    // Ensure it's an element node
    if (node.nodeType !== 1) return;

    try {
        if (matchesAny(node, POST_SELECTORS)) {
            if (containsSlop(node, POST_TEXT_SELECTORS)) {
                const text = getTextContent(node, POST_TEXT_SELECTORS).substring(0, 70);
                console.log(`%cAI Slop Filter: Hiding POST. Reason: Found slop indicator. Text starts with: "${text}..."`, "color: #ff8c00;", node);
                hideElement(node);
            }
        }

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

// Watch for new nodes
const observer = new MutationObserver((mutationsList) => {
    if (!isEnabled) return;

    try {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return; // Only process element nodes

                    // Process the node itself
                    processNode(node);

                    // And check its descendants
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

// Load initial state and start observing
chrome.storage.sync.get(['isEnabled', 'totalHiddenCount'], (data) => {
    isEnabled = data.isEnabled;

    if (isEnabled) {
        console.log("AI Slop Filter: Filter is ON. Starting scan.");
        // Wait for page to settle
        setTimeout(initialScan, 1000);
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        console.log("AI Slop Filter: Filter is OFF.");
    }
});

// Listen for state changes from the popup
chrome.storage.onChanged.addListener((changes, area) => {
    try {
        if (area === 'sync' && changes.isEnabled) {
            console.log("AI Slop Filter: State changed.");
            isEnabled = changes.isEnabled.newValue;

            if (isEnabled) {
                console.log("AI Slop Filter: Turning ON. Starting observer.");
                setTimeout(initialScan, 5); // Re-scan
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
