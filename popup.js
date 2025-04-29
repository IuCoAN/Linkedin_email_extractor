document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const extractBtn = document.getElementById('extractBtn');
    const startScanBtn = document.getElementById('startScanBtn');
    const stopScanBtn = document.getElementById('stopScanBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const helpBtn = document.getElementById('helpBtn');
    const backBtn = document.getElementById('backBtn');
    const helpBackBtn = document.getElementById('helpBackBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    
    const mainContent = document.getElementById('mainContent');
    const settingsPanel = document.getElementById('settingsPanel');
    const helpPanel = document.getElementById('helpPanel');
    
    const emailList = document.getElementById('emailList');
    const emptyState = document.getElementById('emptyState');
    const statusIndicator = document.getElementById('statusIndicator');
    const scanDelay = document.getElementById('scanDelay');
    const delayValue = document.getElementById('delayValue');
    
    // State
    let extractedEmails = [];
    let isAutoScanning = false;
    let scanInterval = null;
    let currentScanCount = 0;
    
    // Load saved emails from storage
    chrome.storage.local.get(['extractedEmails'], function(result) {
        if (result.extractedEmails && result.extractedEmails.length > 0) {
            extractedEmails = result.extractedEmails;
            updateEmailList();
        }
    });
    
    // Load settings
    loadSettings();
    
    // Event listeners
    extractBtn.addEventListener('click', () => startExtraction(false));
    startScanBtn.addEventListener('click', startAutoScan);
    stopScanBtn.addEventListener('click', stopAutoScan);
    copyAllBtn.addEventListener('click', copyAllEmails);
    exportBtn.addEventListener('click', exportToCSV);
    clearBtn.addEventListener('click', clearResults);
    settingsBtn.addEventListener('click', showSettings);
    helpBtn.addEventListener('click', showHelp);
    backBtn.addEventListener('click', showMainContent);
    helpBackBtn.addEventListener('click', showMainContent);
    scanDelay.addEventListener('input', updateDelayValue);
    resetSettingsBtn.addEventListener('click', resetSettings);
    
    // Functions
    function startAutoScan() {
        if (isAutoScanning) return;
        
        isAutoScanning = true;
        startScanBtn.classList.add('hidden');
        stopScanBtn.classList.remove('hidden');
        
        // Update status
        updateStatus('scanning-auto', 'Auto-scanning activated');
        
        // Get scan interval from settings (in seconds)
        const intervalTime = parseInt(document.getElementById('scanDelay').value) * 1000;
        currentScanCount = 0;
        
        // Start the interval
        console.log(`Starting auto-scan with interval of ${intervalTime}ms`);
        
        // Do an initial scan
        startExtraction(true);
        
        // Then set up the interval
        scanInterval = setInterval(() => {
            if (isAutoScanning) {
                currentScanCount++;
                console.log(`Auto-scan iteration #${currentScanCount}`);
                startExtraction(true);
            } else {
                clearInterval(scanInterval);
            }
        }, intervalTime);
    }
    
    function stopAutoScan() {
        if (!isAutoScanning) return;
        
        isAutoScanning = false;
        startScanBtn.classList.remove('hidden');
        stopScanBtn.classList.add('hidden');
        
        // Clear the interval
        if (scanInterval) {
            clearInterval(scanInterval);
            scanInterval = null;
        }
        
        // Update status
        updateStatus('ready', 'Auto-scanning stopped');
    }
    
    function startExtraction(isAutoScan = false) {
        // Get extraction options
        const options = {
            scanConnections: document.getElementById('scanConnections').checked,
            scanMessages: document.getElementById('scanMessages').checked,
            scanProfile: document.getElementById('scanProfile').checked,
            scanDepth: document.getElementById('scanDepth').value,
            validateEmails: document.getElementById('validateEmails').checked,
            filterDisposable: document.getElementById('filterDisposable').checked,
            scanDelay: document.getElementById('scanDelay').value,
            isAutoScan: isAutoScan
        };
        
        // Save settings
        saveSettings(options);
        
        // Update UI to show extraction in progress
        extractBtn.disabled = true;
        if (!isAutoScan) {
            updateStatus('scanning', 'Scanning LinkedIn for emails');
        } else {
            updateStatus('scanning-auto', `Auto-scan #${currentScanCount} in progress`);
        }
        
        // Send message to content script to start extraction
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) {
                updateStatus('error', 'No active tab found');
                extractBtn.disabled = false;
                return;
            }
            
            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "extract", options: options},
                function(response) {
                    // Check for communication error
                    if (chrome.runtime.lastError) {
                        console.error("Error sending message:", chrome.runtime.lastError);
                        updateStatus('error', 'Error connecting to page');
                        extractBtn.disabled = false;
                        return;
                    }
                    
                    if (response && response.emails) {
                        // Add new emails to the list (avoiding duplicates)
                        const newEmails = response.emails.filter(email => !extractedEmails.includes(email));
                        if (newEmails.length > 0) {
                            extractedEmails = [...extractedEmails, ...newEmails];
                            // Save to storage
                            chrome.storage.local.set({extractedEmails: extractedEmails});
                            updateEmailList();
                        }
                        
                        if (isAutoScan) {
                            updateStatus('scanning-auto', `Auto-scan #${currentScanCount} complete - Found ${newEmails.length} new email(s)`);
                        } else {
                            updateStatus('success', `Found ${newEmails.length} new email(s)`);
                            // Reset status after a few seconds for manual scans
                            setTimeout(() => {
                                if (!isAutoScanning) {
                                    updateStatus('ready');
                                }
                            }, 5000);
                        }
                    } else {
                        // Handle no emails found or error
                        if (isAutoScan) {
                            updateStatus('scanning-auto', `Auto-scan #${currentScanCount} - No new emails found`);
                        } else {
                            updateStatus('error', 'No emails found');
                            // Reset status after a few seconds
                            setTimeout(() => {
                                if (!isAutoScanning) {
                                    updateStatus('ready');
                                }
                            }, 5000);
                        }
                    }
                    
                    // Reset extraction button
                    extractBtn.disabled = false;
                }
            );
        });
    }
    
    function updateEmailList() {
        if (extractedEmails.length > 0) {
            emptyState.style.display = 'none';
            emailList.style.display = 'block';
            
            // Clear existing list
            emailList.innerHTML = '';
            
            // Add each email to the list
            extractedEmails.forEach(email => {
                const li = document.createElement('li');
                li.className = 'email-item';
                li.innerHTML = `
                    <span class="email-text">${email}</span>
                    <button class="email-copy-btn" data-email="${email}">
                        <i class="fas fa-copy"></i>
                    </button>
                `;
                emailList.appendChild(li);
            });
            
            // Update stats
            document.getElementById('emailCount').textContent = `${extractedEmails.length} ${extractedEmails.length === 1 ? 'email' : 'emails'}`;
            document.getElementById('lastUpdated').textContent = `Last scan: ${new Date().toLocaleString()}`;
            
            // Add event listeners to copy buttons
            document.querySelectorAll('.email-copy-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const email = this.getAttribute('data-email');
                    navigator.clipboard.writeText(email).then(() => {
                        // Show copied feedback
                        const originalIcon = this.innerHTML;
                        this.innerHTML = '<i class="fas fa-check"></i>';
                        this.style.color = '#10b981';
                        setTimeout(() => {
                            this.innerHTML = originalIcon;
                            this.style.color = '';
                        }, 1000);
                    });
                });
            });
        } else {
            emptyState.style.display = 'block';
            emailList.style.display = 'none';
            document.getElementById('emailCount').textContent = '0 emails';
        }
    }
    
    function copyAllEmails() {
        if (extractedEmails.length > 0) {
            navigator.clipboard.writeText(extractedEmails.join('\n')).then(() => {
                // Show feedback
                const originalText = copyAllBtn.innerHTML;
                copyAllBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyAllBtn.style.color = '#10b981';
                setTimeout(() => {
                    copyAllBtn.innerHTML = originalText;
                    copyAllBtn.style.color = '';
                }, 1000);
            });
        }
    }
    
    function exportToCSV() {
        if (extractedEmails.length > 0) {
            const csvContent = "data:text/csv;charset=utf-8,Email\n" + extractedEmails.join("\n");
            const encodedUri = encodeURI(csvContent);
            
            // Use Chrome's download API
            chrome.downloads.download({
                url: encodedUri,
                filename: "linkedin_emails.csv",
                saveAs: true
            });
        }
    }
    
    function clearResults() {
        if (extractedEmails.length > 0) {
            if (confirm('Are you sure you want to clear all extracted emails?')) {
                extractedEmails = [];
                chrome.storage.local.set({extractedEmails: []});
                updateEmailList();
            }
        }
    }
    
    function showSettings() {
        mainContent.classList.remove('active');
        helpPanel.classList.remove('active');
        settingsPanel.classList.add('active');
    }
    
    function showHelp() {
        mainContent.classList.remove('active');
        settingsPanel.classList.remove('active');
        helpPanel.classList.add('active');
    }
    
    function showMainContent() {
        settingsPanel.classList.remove('active');
        helpPanel.classList.remove('active');
        mainContent.classList.add('active');
    }
    
    function updateDelayValue() {
        delayValue.textContent = `${scanDelay.value}s`;
    }
    
    function updateStatus(status, message) {
        switch(status) {
            case 'ready':
                statusIndicator.innerHTML = '<div class="status-dot" style="background-color: #3b82f6;"></div><span class="status-text">Ready to extract emails</span>';
                break;
            case 'scanning':
                statusIndicator.innerHTML = '<div class="status-dot" style="background-color: #f59e0b;"></div><span class="status-text">Scanning LinkedIn for emails</span>';
                break;
            case 'scanning-auto':
                statusIndicator.innerHTML = `<div class="status-dot" style="background-color: #10b981;"></div><span class="status-text">${message}</span>`;
                break;
            case 'success':
                statusIndicator.innerHTML = `<div class="status-dot" style="background-color: #10b981;"></div><span class="status-text">Scan completed - ${message}</span>`;
                break;
            case 'error':
                statusIndicator.innerHTML = `<div class="status-dot" style="background-color: #ef4444;"></div><span class="status-text">Error: ${message}</span>`;
                break;
        }
    }
    
    function saveSettings(options) {
        chrome.storage.local.set({
            settings: {
                scanConnections: options.scanConnections,
                scanMessages: options.scanMessages,
                scanProfile: options.scanProfile,
                scanDepth: options.scanDepth,
                validateEmails: options.validateEmails,
                filterDisposable: options.filterDisposable,
                scanDelay: options.scanDelay
            }
        });
    }
    
    function loadSettings() {
        chrome.storage.local.get(['settings'], function(result) {
            if (result.settings) {
                document.getElementById('scanConnections').checked = result.settings.scanConnections ?? true;
                document.getElementById('scanMessages').checked = result.settings.scanMessages ?? false;
                document.getElementById('scanProfile').checked = result.settings.scanProfile ?? true;
                document.getElementById('scanDepth').value = result.settings.scanDepth ?? "1";
                document.getElementById('validateEmails').checked = result.settings.validateEmails ?? true;
                document.getElementById('filterDisposable').checked = result.settings.filterDisposable ?? false;
                document.getElementById('scanDelay').value = result.settings.scanDelay ?? 3;
                updateDelayValue();
            }
        });
    }
    
    function resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            const defaultSettings = {
                scanConnections: true,
                scanMessages: false,
                scanProfile: true,
                scanDepth: "1",
                validateEmails: true,
                filterDisposable: false,
                scanDelay: 3
            };
            
            // Update UI
            document.getElementById('scanConnections').checked = defaultSettings.scanConnections;
            document.getElementById('scanMessages').checked = defaultSettings.scanMessages;
            document.getElementById('scanProfile').checked = defaultSettings.scanProfile;
            document.getElementById('scanDepth').value = defaultSettings.scanDepth;
            document.getElementById('validateEmails').checked = defaultSettings.validateEmails;
            document.getElementById('filterDisposable').checked = defaultSettings.filterDisposable;
            document.getElementById('scanDelay').value = defaultSettings.scanDelay;
            updateDelayValue();
            
            // Save to storage
            chrome.storage.local.set({settings: defaultSettings});
        }
    }
    
    // Stop auto-scanning when popup is closed
    window.addEventListener('beforeunload', function() {
        if (isAutoScanning) {
            stopAutoScan();
        }
    });
    
    // Initialize with empty state
    updateEmailList();
});