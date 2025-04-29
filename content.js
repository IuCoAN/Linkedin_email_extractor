// LinkedIn Email Extractor - Content Script
console.log("LinkedIn Email Extractor: Content script loaded");
let isExtracting = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        console.log("Ping received in content script");
        sendResponse({ status: "pong" });
        return true;
    }
    
    if (request.action === "extract") {
        try {
            // Special handling for auto-scan mode
            const isAutoScan = request.options.isAutoScan || false;
            
            if (isExtracting && !isAutoScan) {
                console.log("Extraction already in progress");
                sendResponse({ status: "error", message: "Extraction already in progress" });
                return true;
            }
            
            console.log(`Starting ${isAutoScan ? 'auto-scan' : 'manual extraction'} with options:`, request.options);
            isExtracting = true;
            
            // If this is an auto-scan, use a more targeted extraction approach
            const extractionPromise = isAutoScan ? 
                performAutoScan(request.options) : 
                extractEmails(request.options);
            
            extractionPromise
                .then(emails => {
                    console.log(`${isAutoScan ? 'Auto-scan' : 'Extraction'} complete. Found emails:`, emails);
                    isExtracting = false;
                    sendResponse({ status: "success", emails: emails });
                })
                .catch(error => {
                    console.error(`${isAutoScan ? 'Auto-scan' : 'Extraction'} error:`, error);
                    isExtracting = false;
                    sendResponse({ status: "error", message: error.message || "Unknown error during extraction" });
                });
            
            // Return true to indicate we'll send a response asynchronously
            return true;
        } catch (e) {
            console.error("Exception in message handler:", e);
            isExtracting = false;
            sendResponse({ status: "error", message: "Exception: " + e.message });
            return true;
        }
    }
    
    return false;
});

/**
 * Perform an auto-scan that's optimized for continuous operation
 * This is a more lightweight scan that focuses on new content since last scan
 */
async function performAutoScan(options) {
    console.log("Performing auto-scan");
    const extractedEmails = [];
    const processedElements = new Set();
    
    try {
        // Get the current URL to determine scan strategy
        const currentUrl = window.location.href;
        
        // Record the scroll position to restore it later
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        
        // Perform different actions based on the current page
        if (isProfilePage(currentUrl) && options.scanProfile) {
            // Try to click the contact info button automatically
            const contactInfoButton = findContactInfoButton();
            if (contactInfoButton) {
                contactInfoButton.click();
                
                // Wait for the modal to appear
                await waitForElement('.pv-contact-info', 2000);
                
                // Extract emails from the contact info section
                await extractFromContactInfo(extractedEmails);
                
                // Close the modal
                closeContactInfoModal();
            }
            
            // Scan visible content for emails
            scanVisibleContentForEmails(extractedEmails, processedElements);
        } 
        else if (isConnectionsPage(currentUrl) && options.scanConnections) {
            // For connections page, scroll down a bit to load more connections
            window.scrollBy(0, 500);
            await delay(1000);
            
            // Scan visible connections
            scanVisibleContentForEmails(extractedEmails, processedElements);
            
            // Try to expand any "Show more" buttons
            expandShowMoreButtons();
        }
        else if (isMessagesPage(currentUrl) && options.scanMessages) {
            // For messages page, try to expand message threads
            expandMessageThreads();
            await delay(1000);
            
            // Scan visible messages
            scanVisibleContentForEmails(extractedEmails, processedElements);
        }
        else {
            // For other pages, just scan visible content
            scanVisibleContentForEmails(extractedEmails, processedElements);
        }
        
        // Restore scroll position
        window.scrollTo(scrollX, scrollY);
        
        // Validate emails if option is enabled
        if (options.validateEmails) {
            return extractedEmails.filter(email => validateEmail(email, options.filterDisposable));
        }
        
        return extractedEmails;
    } catch (error) {
        console.error("Auto-scan error:", error);
        throw new Error("Failed to auto-scan: " + error.message);
    }
}

/**
 * Extract emails from the contact info modal
 */
async function extractFromContactInfo(results) {
    console.log("Extracting from contact info modal");
    
    const contactInfoSection = document.querySelector('.pv-contact-info');
    if (!contactInfoSection) {
        console.log("Contact info section not found");
        return;
    }
    
    // Try different selectors for email sections
    const emailSelectors = [
        '.ci-email .pv-contact-info__ci-container a',
        '.pv-contact-info__contact-type--email a',
        '.pv-contact-info__contact-item a[href^="mailto:"]',
        'a[href^="mailto:"]'
    ];
    
    for (const selector of emailSelectors) {
        const emailLinks = contactInfoSection.querySelectorAll(selector);
        if (emailLinks && emailLinks.length > 0) {
            console.log(`Found ${emailLinks.length} email links with selector: ${selector}`);
            
            emailLinks.forEach(link => {
                let email;
                if (link.href && link.href.startsWith('mailto:')) {
                    email = link.href.replace('mailto:', '').split('?')[0].trim();
                } else {
                    email = link.textContent.trim();
                }
                
                if (email && !results.includes(email)) {
                    console.log("Found email:", email);
                    results.push(email);
                }
            });
            break;
        }
    }
    
    // Also scan the entire contact info section text
    const contactInfoText = contactInfoSection.innerText;
    const emails = findEmailsInText(contactInfoText);
    
    emails.forEach(email => {
        if (!results.includes(email)) {
            console.log("Found email via text scan:", email);
            results.push(email);
        }
    });
}

/**
 * Close the contact info modal
 */
function closeContactInfoModal() {
    const closeButtons = [
        'button[aria-label="Dismiss"]',
        '.artdeco-modal__dismiss',
        '.pv-contact-info__close-btn'
    ];
    
    for (const selector of closeButtons) {
        const closeButton = document.querySelector(selector);
        if (closeButton) {
            console.log("Clicking close button:", selector);
            closeButton.click();
            return;
        }
    }
    
    // Click outside the modal as a fallback
    document.body.click();
}

/**
 * Expand "Show more" buttons to reveal more content
 */
function expandShowMoreButtons() {
    const showMoreSelectors = [
        'button.inline-show-more-text__button',
        'button.lt-line-clamp__more',
        'button[aria-label="Show more"]',
        'button.artdeco-button--tertiary'
    ];
    
    for (const selector of showMoreSelectors) {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
            if (button.innerText.includes('Show more') || button.innerText.includes('see more')) {
                console.log("Clicking show more button");
                button.click();
            }
        });
    }
}

/**
 * Expand message threads to see more messages
 */
function expandMessageThreads() {
    const threadSelectors = [
        '.msg-conversation-listitem',
        '.msg-conversation-card',
        '.msg-thread'
    ];
    
    for (const selector of threadSelectors) {
        const threads = document.querySelectorAll(selector);
        if (threads.length > 0) {
            // Just click the first unread thread if any
            for (const thread of threads) {
                if (thread.querySelector('.msg-conversation-card__unread-count')) {
                    console.log("Clicking unread message thread");
                    thread.click();
                    return;
                }
            }
            
            // If no unread, click the first thread
            console.log("Clicking first message thread");
            threads[0].click();
            return;
        }
    }
}

/**
 * Scan visible content for emails, keeping track of already processed elements
 */
function scanVisibleContentForEmails(results, processedElements) {
    // Get all visible text elements
    const textElements = document.querySelectorAll('p, span, div, a, h1, h2, h3, h4, h5, h6');
    
    textElements.forEach(element => {
        // Skip already processed elements
        if (processedElements.has(element)) {
            return;
        }
        
        // Mark as processed
        processedElements.add(element);
        
        // Get text content
        const text = element.innerText || element.textContent;
        if (!text) return;
        
        // Find emails
        const emails = findEmailsInText(text);
        
        // Add unique emails to results
        emails.forEach(email => {
            if (!results.includes(email)) {
                console.log("Found email in element:", email);
                results.push(email);
            }
        });
        
        // Also check href attributes for mailto links
        if (element.tagName === 'A' && element.href && element.href.startsWith('mailto:')) {
            const email = element.href.replace('mailto:', '').split('?')[0].trim();
            if (email && !results.includes(email)) {
                console.log("Found email in mailto link:", email);
                results.push(email);
            }
        }
    });
}

/**
 * Main function to extract emails based on provided options
 */
async function extractEmails(options) {
    const extractedEmails = [];
    
    try {
        // Check current URL to determine extraction strategy
        const currentUrl = window.location.href;
        
        // More aggressive email pattern that looks for common LinkedIn patterns
        const emailRegexes = [
            // Standard email pattern
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            // Common obfuscation patterns
            /[a-zA-Z0-9._%+-]+\s*[\[@]\s*[a-zA-Z0-9.-]+\s*[\.]\s*[a-zA-Z]{2,}/g,
            // Pattern with "at" and "dot" written out
            /[a-zA-Z0-9._%+-]+\s+at\s+[a-zA-Z0-9.-]+\s+dot\s+[a-zA-Z]{2,}/gi
        ];
        
        // Extract from page source first
        const pageSource = document.documentElement.outerHTML;
        for (const regex of emailRegexes) {
            const matches = pageSource.match(regex) || [];
            for (const match of matches) {
                // Clean up the email
                const email = cleanEmail(match);
                if (email && !extractedEmails.includes(email)) {
                    extractedEmails.push(email);
                }
            }
        }
        
        // Extract based on page type
        if (options.scanProfile && isProfilePage(currentUrl)) {
            await extractFromProfile(extractedEmails);
        }
        
        if (options.scanConnections && isConnectionsPage(currentUrl)) {
            await extractFromConnections(extractedEmails, options);
        }
        
        if (options.scanMessages && isMessagesPage(currentUrl)) {
            await extractFromMessages(extractedEmails);
        }
        
        // Extract from all visible text
        const allText = document.body.innerText;
        for (const regex of emailRegexes) {
            const matches = allText.match(regex) || [];
            for (const match of matches) {
                const email = cleanEmail(match);
                if (email && !extractedEmails.includes(email)) {
                    extractedEmails.push(email);
                }
            }
        }
        
        // Validate emails if option is enabled
        if (options.validateEmails) {
            return extractedEmails.filter(email => validateEmail(email, options.filterDisposable));
        }
        
        return extractedEmails;
    } catch (error) {
        console.error("Extraction error:", error);
        throw new Error("Failed to extract emails: " + error.message);
    }
}

/**
 * Clean up a potential email match
 */
function cleanEmail(email) {
    // Replace "at" and "dot" with @ and .
    email = email.replace(/\s+at\s+/i, '@').replace(/\s+dot\s+/i, '.');
    
    // Remove spaces
    email = email.replace(/\s+/g, '');
    
    // Replace common obfuscations
    email = email.replace(/\[at\]/i, '@').replace(/\[dot\]/i, '.');
    
    // Validate basic format
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email) ? email : null;
}

/**
 * Extract emails from the current profile page
 */
async function extractFromProfile(results) {
    console.log("Extracting from profile page");
    
    try {
        // Automatically click on "Contact info" button if it exists
        const contactInfoButton = findContactInfoButton();
        if (contactInfoButton) {
            console.log("Found contact info button, clicking it");
            contactInfoButton.click();
            
            // Wait for the modal to appear
            await waitForElement('.pv-contact-info', 3000);
            
            // Extract emails from the contact info section
            const contactInfoSection = document.querySelector('.pv-contact-info');
            if (contactInfoSection) {
                console.log("Contact info section found");
                
                // Try different selectors for email sections
                const emailSelectors = [
                    '.ci-email .pv-contact-info__ci-container a',
                    '.pv-contact-info__contact-type--email a',
                    '.pv-contact-info__contact-item a[href^="mailto:"]',
                    'a[href^="mailto:"]'
                ];
                
                let found = false;
                for (const selector of emailSelectors) {
                    const emailLinks = contactInfoSection.querySelectorAll(selector);
                    if (emailLinks && emailLinks.length > 0) {
                        console.log(`Found ${emailLinks.length} email links with selector: ${selector}`);
                        found = true;
                        
                        emailLinks.forEach(link => {
                            let email;
                            if (link.href && link.href.startsWith('mailto:')) {
                                email = link.href.replace('mailto:', '').split('?')[0].trim();
                            } else {
                                email = link.textContent.trim();
                            }
                            
                            if (email && !results.includes(email)) {
                                console.log("Found email:", email);
                                results.push(email);
                            }
                        });
                    }
                }
                
                if (!found) {
                    console.log("No email links found in contact info with standard selectors, trying broader approach");
                    // Scan the entire contact info section for email patterns
                    const contactInfoText = contactInfoSection.innerText;
                    const emails = findEmailsInText(contactInfoText);
                    
                    emails.forEach(email => {
                        if (!results.includes(email)) {
                            console.log("Found email via text scan:", email);
                            results.push(email);
                        }
                    });
                }
                
                // Close the modal by clicking outside or on the close button
                const closeButtons = [
                    'button[aria-label="Dismiss"]',
                    '.artdeco-modal__dismiss',
                    '.pv-contact-info__close-btn'
                ];
                
                let closed = false;
                for (const selector of closeButtons) {
                    const closeButton = document.querySelector(selector);
                    if (closeButton) {
                        console.log("Clicking close button:", selector);
                        closeButton.click();
                        closed = true;
                        break;
                    }
                }
                
                if (!closed) {
                    console.log("No close button found, clicking outside modal");
                    // Click outside the modal as a fallback
                    document.body.click();
                }
            } else {
                console.log("Contact info section not found after clicking button");
            }
        } else {
            console.log("Contact info button not found");
        }
    } catch (error) {
        console.error("Error in extractFromProfile:", error);
    }
    
    // Also try to find "Contact info" sections without clicking
    try {
        // Look for email links directly in the profile
        const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
        if (emailLinks.length > 0) {
            console.log(`Found ${emailLinks.length} mailto links directly on page`);
            
            emailLinks.forEach(link => {
                const email = link.href.replace('mailto:', '').split('?')[0].trim();
                if (email && !results.includes(email)) {
                    console.log("Found email from mailto link:", email);
                    results.push(email);
                }
            });
        }
    } catch (error) {
        console.error("Error finding direct mailto links:", error);
    }
    
    // Scan page metadata for emails
    try {
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach(tag => {
            const content = tag.getAttribute('content');
            if (content) {
                const emails = findEmailsInText(content);
                emails.forEach(email => {
                    if (!results.includes(email)) {
                        console.log("Found email in meta tag:", email);
                        results.push(email);
                    }
                });
            }
        });
    } catch (error) {
        console.error("Error scanning meta tags:", error);
    }
    
    // Also scan the entire profile page for email patterns
    try {
        scanPageForEmails(results);
    } catch (error) {
        console.error("Error in scanPageForEmails:", error);
    }
}

/**
 * Extract emails from connections page
 */
async function extractFromConnections(results, options) {
    console.log("Extracting from connections page");
    
    try {
        // Get all connection cards
        const connectionSelectors = [
            '.mn-connection-card',
            '.artdeco-entity-lockup',
            '.entity-result__item',
            '.reusable-search__result-container'
        ];
        
        let connectionCards = [];
        for (const selector of connectionSelectors) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) {
                console.log(`Found ${cards.length} connection cards with selector: ${selector}`);
                connectionCards = Array.from(cards);
                break;
            }
        }
        
        if (connectionCards.length === 0) {
            console.log("No connection cards found");
            return;
        }
        
        // Set maximum connections to scan based on depth
        const maxConnections = getMaxConnectionsByDepth(options.scanDepth);
        const connectionsToScan = Math.min(connectionCards.length, maxConnections);
        console.log(`Scanning ${connectionsToScan} out of ${connectionCards.length} connections`);
        
        for (let i = 0; i < connectionsToScan; i++) {
            const card = connectionCards[i];
            
            // Check for "Message" button which may contain href with email
            const messageBtnSelectors = [
                'a[data-control-name="message"]',
                'button[aria-label*="message"]',
                'a[href*="messaging"]',
                'button[data-control-name="message"]'
            ];
            
            for (const selector of messageBtnSelectors) {
                const messageBtn = card.querySelector(selector);
                if (messageBtn) {
                    const href = messageBtn.getAttribute('href');
                    if (href) {
                        // Sometimes LinkedIn puts email in the href
                        const emailMatch = href.match(/mailto:([^?]+)/);
                        if (emailMatch && emailMatch[1]) {
                            const email = emailMatch[1].trim();
                            if (!results.includes(email)) {
                                console.log("Found email in message button href:", email);
                                results.push(email);
                            }
                        }
                    }
                    break;
                }
            }
            
            // Scan card text for email patterns
            const cardText = card.innerText;
            const emails = findEmailsInText(cardText);
            emails.forEach(email => {
                if (!results.includes(email)) {
                    console.log("Found email in connection card text:", email);
                    results.push(email);
                }
            });
            
            // Check if we need to visit the profile page based on depth setting
            if (options.scanDepth >= 2) {
                const profileLinkSelectors = [
                    '.mn-connection-card__name a',
                    '.entity-result__title a',
                    '.artdeco-entity-lockup__title a',
                    'a[data-control-name="search_srp_result"]'
                ];
                
                let profileLink = null;
                for (const selector of profileLinkSelectors) {
                    const link = card.querySelector(selector);
                    if (link && link.href && link.href.includes('/in/')) {
                        profileLink = link;
                        break;
                    }
                }
                
                if (profileLink) {
                    console.log("Found profile link, opening in new tab:", profileLink.href);
                    
                    // Open profile in new tab instead of navigating away
                    const profileUrl = profileLink.href;
                    
                    try {
                        // Create a new tab
                        const newTab = window.open(profileUrl, '_blank');
                        
                        // Wait a moment for tab to load
                        await delay(3000);
                        
                        // Check if new tab was created and focus it
                        if (newTab) {
                            newTab.focus();
                            
                            // Wait for tab to fully load
                            await delay(options.scanDelay * 1000);
                            
                            // Close the tab
                            newTab.close();
                        }
                    } catch (error) {
                        console.error("Error opening profile in new tab:", error);
                    }
                    
                    // Respect rate limiting settings
                    await delay(options.scanDelay * 1000);
                }
            }
        }
        
        // Also scan the entire connections page for email patterns
        scanPageForEmails(results);
    } catch (error) {
        console.error("Error in extractFromConnections:", error);
    }
}

/**
 * Extract emails from messages page
 */
async function extractFromMessages(results) {
    console.log("Extracting from messages page");
    
    try {
        // Scan all message conversations for email patterns
        const conversationSelectors = [
            '.msg-conversation-listitem',
            '.msg-conversation-card',
            '.msg-thread'
        ];
        
        let conversations = [];
        for (const selector of conversationSelectors) {
            const convos = document.querySelectorAll(selector);
            if (convos.length > 0) {
                console.log(`Found ${convos.length} conversations with selector: ${selector}`);
                conversations = Array.from(convos);
                break;
            }
        }
        
        if (conversations.length === 0) {
            console.log("No conversations found");
            return;
        }
        
        // First, check if we're already in a conversation view
        const messageListSelectors = [
            '.msg-s-message-list',
            '.msg-s-message-list-content',
            '.msg-conversation-card__message-snippet-body'
        ];
        
        let messagesFound = false;
        for (const selector of messageListSelectors) {
            const messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`Found ${messages.length} message containers with selector: ${selector}`);
                messagesFound = true;
                
                // Scan each message for emails
                messages.forEach(message => {
                    const text = message.innerText;
                    const emails = findEmailsInText(text);
                    
                    emails.forEach(email => {
                        if (!results.includes(email)) {
                            console.log("Found email in message:", email);
                            results.push(email);
                        }
                    });
                });
                
                break;
            }
        }
        
        // If we didn't find messages already visible, try clicking conversations
        if (!messagesFound && conversations.length > 0) {
            const maxConversations = Math.min(conversations.length, 5);
            console.log(`Will click on ${maxConversations} conversations to scan messages`);
            
            for (let i = 0; i < maxConversations; i++) {
                const conversation = conversations[i];
                
                // Click on the conversation to open it
                console.log("Clicking conversation:", i+1);
                conversation.click();
                
                // Wait for messages to load
                await delay(1000);
                
                // Get all message bubbles
                const messages = document.querySelectorAll('.msg-s-message-group__content, .msg-s-event-listitem__body');
                
                if (messages.length > 0) {
                    console.log(`Found ${messages.length} messages`);
                    
                    // Scan each message for emails
                    messages.forEach(message => {
                        const text = message.innerText;
                        const emails = findEmailsInText(text);
                        
                        emails.forEach(email => {
                            if (!results.includes(email)) {
                                console.log("Found email in message:", email);
                                results.push(email);
                            }
                        });
                    });
                } else {
                    console.log("No messages found in this conversation");
                }
                
                // Wait a bit between conversations to avoid rate limiting
                await delay(1000);
            }
        }
        
        // Also scan the entire messages page for email patterns
        scanPageForEmails(results);
    } catch (error) {
        console.error("Error in extractFromMessages:", error);
    }
}

/**
 * Scan the entire page for email patterns
 */
function scanPageForEmails(results) {
    // Get all text from the page
    const pageText = document.body.innerText;
    
    // Find emails
    const emails = findEmailsInText(pageText);
    
    // Add unique emails to results
    emails.forEach(email => {
        if (!results.includes(email)) {
            results.push(email);
        }
    });
    
    // Also search in element attributes that might contain emails
    const elements = document.querySelectorAll('[href], [data-email], [title], [alt]');
    elements.forEach(element => {
        const attributes = ['href', 'data-email', 'title', 'alt'];
        attributes.forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) {
                const emails = findEmailsInText(value);
                emails.forEach(email => {
                    if (!results.includes(email)) {
                        console.log(`Found email in ${attr} attribute:`, email);
                        results.push(email);
                    }
                });
            }
        });
    });
}

/**
 * Find emails in a text string using regex
 */
function findEmailsInText(text) {
    if (!text) return [];
    
    // Email regex patterns
    const patterns = [
        // Standard email pattern
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        // Pattern with "at" and "dot" written out
        /[a-zA-Z0-9._%+-]+\s+at\s+[a-zA-Z0-9.-]+\s+dot\s+[a-zA-Z]{2,}/gi,
        // Pattern with [at] and [dot]
        /[a-zA-Z0-9._%+-]+\s*\[at\]\s*[a-zA-Z0-9.-]+\s*\[dot\]\s*[a-zA-Z]{2,}/gi
    ];
    
    // Find all matches across all patterns
    let allMatches = [];
    patterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        allMatches = [...allMatches, ...matches];
    });
    
    // Clean up and validate matches
    const validEmails = [];
    allMatches.forEach(match => {
        // Clean up the match
        let email = match.toLowerCase();
        
        // Replace "at" and "dot" with @ and .
        email = email.replace(/\s+at\s+/i, '@').replace(/\s+dot\s+/i, '.');
        
        // Replace [at] and [dot] with @ and .
        email = email.replace(/\[at\]/i, '@').replace(/\[dot\]/i, '.');
        
        // Remove spaces
        email = email.replace(/\s+/g, '');
        
        // Validate basic format
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (emailPattern.test(email)) {
            validEmails.push(email);
        }
    });
    
    // Return unique matches
    return [...new Set(validEmails)];
}

/**
 * Validate an email address
 */
function validateEmail(email, filterDisposable) {
    // Basic email validation regex
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isValid = emailPattern.test(email);
    
    if (!isValid) return false;
    
    // Check for disposable email domains if filter is enabled
    if (filterDisposable) {
        const disposableDomains = [
            'mailinator.com', 'tempmail.com', 'throwawaymail.com', 'yopmail.com',
            '10minutemail.com', 'guerrillamail.com', 'sharklasers.com', 'temp-mail.org',
            'mailnesia.com', 'tempinbox.com', 'trashmail.com', 'dispostable.com'
        ];
        
        const domain = email.split('@')[1].toLowerCase();
        if (disposableDomains.includes(domain)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Helper function to find the "Contact info" button on a profile page
 */
function findContactInfoButton() {
    // Try different selectors as LinkedIn may change their structure
    const selectors = [
        'a[href="#contact-info"]',
        'button[aria-label="View contact info"]',
        '.pv-contact-info__card-action',
        '.pv-top-card-v2-section__contact-info',
        'a[data-control-name="contact_see_more"]',
        '.pv-top-card__contact-info',
        '.artdeco-button[aria-label*="contact"]',
        'button[aria-label*="Contact"]',
        'button[aria-label*="contact"]'
    ];
    
    for (const selector of selectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
            if (button && 
                (button.textContent.includes('Contact') || 
                 button.textContent.includes('contact') || 
                 button.getAttribute('aria-label')?.includes('contact'))) {
                return button;
            }
        }
    }
    
    return null;
}

/**
 * Check if current page is a profile page
 */
function isProfilePage(url) {
    return url.includes('linkedin.com/in/');
}

/**
 * Check if current page is the connections page
 */
function isConnectionsPage(url) {
    return url.includes('linkedin.com/mynetwork/') || 
           url.includes('linkedin.com/search/results/people/');
}

/**
 * Check if current page is the messages page
 */
function isMessagesPage(url) {
    return url.includes('linkedin.com/messaging/');
}

/**
 * Get maximum number of connections to scan based on depth setting
 */
function getMaxConnectionsByDepth(depth) {
    switch (depth) {
        case "1":
            return 20;  // First level: scan fewer connections
        case "2":
            return 50;  // Second level: scan more connections
        case "3":
            return 100; // Third level: scan many connections
        default:
            return 20;
    }
}

/**
 * Promise-based delay function
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }
        
        const observer = new MutationObserver((mutations) => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

/**
 * Wait for page to load
 */
function waitForPageLoad(timeout = 10000) {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            const onLoad = () => {
                resolve();
                window.removeEventListener('load', onLoad);
            };
            window.addEventListener('load', onLoad);
            
            // Fallback timeout
            setTimeout(resolve, timeout);
        }
    });
}