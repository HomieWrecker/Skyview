// ==UserScript==
// @name         Osprey's Eye - Torn Stat Estimator (v1.2)
// @namespace    https://github.com/HomieWrecker/Osprey-s-Eye
// @version      1.2
// @description  Estimate enemy stats and fair fight outcomes using Torn API. PDA-safe version with enhanced accuracy and mobile compatibility.
// @author       Homiewrecker
// @match        https://www.torn.com/profiles.php?XID=*
// @match        https://www.torn.com/profiles.php*
// @match        https://www.torn.com/factions.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    
    // ========== Constants & Configuration ==========
    const VERSION = '1.2';
    const STORAGE_KEY_API = 'osprey_api_key';
    const STORAGE_KEY_CONFIG = 'osprey_config';
    const STORAGE_KEY_ESTIMATES = 'osprey_player_estimates';
    const DEFAULT_CONFIG = {
        showStatBreakdown: true,
        colorScheme: 'dark',
        estimationMethod: 'advanced',
        uiPosition: 'top',
        compactMode: false,
        debugMode: false,
        // New feature configuration options
        showInlineStats: true,         // Show inline stat estimations for all players
        enableFairFightIndicator: true, // Show fair fight color indicators
        storeSavedEstimates: true,     // Store estimations for future reference
        maxStoredEstimates: 500,       // Limit stored estimates to prevent excessive storage usage
        showEstimationBox: true        // Show the main estimation box
    };
    
    // For getting current XID from the URL (handles both ?XID= and &XID= formats)
    const URL_XID_REGEX = /[?&]XID=(\d+)/;
    
    // ========== Utility Functions ==========
    const utils = {
        log: (msg) => console.log(`Osprey's Eye v${VERSION}: ${msg}`),
        error: (msg) => console.error(`Osprey's Eye v${VERSION}: ${msg}`),
        debug: (msg, config = DEFAULT_CONFIG) => {
            if (config.debugMode) {
                console.debug(`Osprey's Eye v${VERSION} [DEBUG]: ${msg}`);
            }
        },
        
        // Enhanced element finder - tries multiple methods to find elements
        // This makes the script much more robust in different environments
        findElement: (selector) => {
            try {
                // Try querySelector first
                let el = document.querySelector(selector);
                if (el) return el;
                
                // If selector looks like an ID but without #, try getElementById
                if (!selector.startsWith('#') && !selector.includes(' ')) {
                    el = document.getElementById(selector);
                    if (el) return el;
                }
                
                // If selector looks like a class but without ., try getElementsByClassName
                if (!selector.startsWith('.') && !selector.includes(' ')) {
                    const elements = document.getElementsByClassName(selector);
                    if (elements.length > 0) return elements[0];
                }
                
                return null;
            } catch (e) {
                console.error(`Error finding element ${selector}: ${e.message}`);
                return null;
            }
        },
        
        // Wait for element to exist in DOM - enhanced compatibility with TornPDA
        waitForElement: (selector, callback, maxAttempts = 30) => {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                
                // Try multiple element selection methods
                let element = null;
                
                // Method 1: querySelector
                element = document.querySelector(selector);
                
                // Method 2: Try with ID if the selector looks like one
                if (!element && selector.startsWith('#')) {
                    const idSelector = selector.substring(1);
                    element = document.getElementById(idSelector);
                }
                
                // Method 3: Try with class name if the selector looks like one
                if (!element && selector.startsWith('.')) {
                    const classSelector = selector.substring(1);
                    const elements = document.getElementsByClassName(classSelector);
                    if (elements.length > 0) {
                        element = elements[0];
                    }
                }
                
                // Method 4: For TornPDA specific - try data attributes or other attributes
                if (!element) {
                    try {
                        const attrMatch = selector.match(/\[([^=]+)=["']?([^"']+)["']?\]/);
                        if (attrMatch) {
                            const attr = attrMatch[1];
                            const value = attrMatch[2];
                            const allElements = document.querySelectorAll(`[${attr}]`);
                            for (const el of allElements) {
                                if (el.getAttribute(attr) === value) {
                                    element = el;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore attribute selector errors
                    }
                }
                
                if (element) {
                    clearInterval(interval);
                    callback(element);
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    utils.error(`Element not found: ${selector}`);
                }
            }, 250); // Slightly shorter interval for better responsiveness
            
            // Return a function to cancel the wait if needed
            return () => clearInterval(interval);
        },
        
        // Get current profile XID from URL
        getCurrentXID: () => {
            const match = window.location.href.match(URL_XID_REGEX);
            return match ? match[1] : null;
        },
        
        // Format numbers with commas
        formatNumber: (num) => {
            if (typeof num !== 'number') return 'N/A';
            return num.toLocaleString();
        },
        
        // Check if this is the user's own profile
        isOwnProfile: () => {
            const userHeader = document.querySelector("div.title-black.xlarge");
            return userHeader && userHeader.textContent.includes("Your Profile");
        },
        
        // Find the account age using multiple possible DOM paths (more resilient)
        getAccountAge: () => {
            // Try multiple selectors for maximum compatibility with TornPDA
            const selectors = [
                ".user-information .cont-wrap .value",
                ".basic-information .user-data .info .age",
                ".profile-wrapper .age",
                "[class*='userInformation'] [class*='age']" // Generic attribute-contains selector
            ];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    const match = el.textContent.match(/(\d+)\s*days?/i);
                    if (match) {
                        return parseInt(match[1]);
                    }
                }
            }
            
            utils.error("Could not find account age");
            return null;
        },
        
        // Enhanced storage utilities with player estimate management
        storage: {
            get: (key, defaultValue = null) => {
                try {
                    const item = localStorage.getItem(key);
                    return item ? JSON.parse(item) : defaultValue;
                } catch (e) {
                    utils.error(`Storage error getting ${key}: ${e.message}`);
                    return defaultValue;
                }
            },
            set: (key, value) => {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    utils.error(`Storage error setting ${key}: ${e.message}`);
                    return false;
                }
            },
            
            // Player estimates database functionality
            playerEstimates: {
                // Get all stored player estimates
                getAll: () => {
                    return utils.storage.get(STORAGE_KEY_ESTIMATES, {});
                },
                
                // Get estimate for a specific player
                get: (playerId) => {
                    const estimates = utils.storage.get(STORAGE_KEY_ESTIMATES, {});
                    return estimates[playerId] || null;
                },
                
                // Save an estimate for a player
                save: (playerId, estimateData, config = DEFAULT_CONFIG) => {
                    if (!config.storeSavedEstimates) return false;
                    
                    try {
                        // Get current estimates
                        const estimates = utils.storage.get(STORAGE_KEY_ESTIMATES, {});
                        
                        // Add timestamp to estimate data
                        estimateData.timestamp = Date.now();
                        estimateData.playerId = playerId;
                        
                        // Store the estimate
                        estimates[playerId] = estimateData;
                        
                        // Check if we need to prune old estimates
                        const estimateCount = Object.keys(estimates).length;
                        if (estimateCount > config.maxStoredEstimates) {
                            // Sort by timestamp and keep only the most recent
                            const sortedIds = Object.keys(estimates)
                                .sort((a, b) => estimates[b].timestamp - estimates[a].timestamp)
                                .slice(0, config.maxStoredEstimates);
                            
                            // Create new object with only the items we want to keep
                            const prunedEstimates = {};
                            sortedIds.forEach(id => {
                                prunedEstimates[id] = estimates[id];
                            });
                            
                            utils.debug(`Pruned estimates from ${estimateCount} to ${sortedIds.length}`, config);
                            
                            // Save pruned list
                            return utils.storage.set(STORAGE_KEY_ESTIMATES, prunedEstimates);
                        }
                        
                        // Save full list if no pruning needed
                        return utils.storage.set(STORAGE_KEY_ESTIMATES, estimates);
                    } catch (e) {
                        utils.error(`Error saving player estimate: ${e.message}`);
                        return false;
                    }
                },
                
                // Remove a specific player estimate
                remove: (playerId) => {
                    try {
                        const estimates = utils.storage.get(STORAGE_KEY_ESTIMATES, {});
                        if (estimates[playerId]) {
                            delete estimates[playerId];
                            return utils.storage.set(STORAGE_KEY_ESTIMATES, estimates);
                        }
                        return true; // Already not there
                    } catch (e) {
                        utils.error(`Error removing player estimate: ${e.message}`);
                        return false;
                    }
                },
                
                // Clear all estimates
                clear: () => {
                    return utils.storage.set(STORAGE_KEY_ESTIMATES, {});
                },
                
                // Get estimate age in days
                getEstimateAge: (playerId) => {
                    const estimate = utils.storage.playerEstimates.get(playerId);
                    if (!estimate || !estimate.timestamp) return null;
                    
                    const now = Date.now();
                    const ageMs = now - estimate.timestamp;
                    const ageDays = ageMs / (1000 * 60 * 60 * 24);
                    return Math.round(ageDays * 10) / 10; // Round to 1 decimal place
                }
            }
        }
    };
    
    // ========== Stats Estimation ==========
    const statsEstimator = {
        // Basic estimate based on account age
        basicEstimate: (ageDays) => {
            if (!ageDays || ageDays < 1) return { low: 0, high: 0 };
            
            // Adjusted algorithm with diminishing returns for older accounts
            // and more realistic progression rates
            let baseMultiplierLow = 150000;
            let baseMultiplierHigh = 400000;
            
            // Apply scaling factors based on account age
            if (ageDays > 2000) {
                baseMultiplierLow = 120000;
                baseMultiplierHigh = 350000;
            } else if (ageDays > 1000) {
                baseMultiplierLow = 135000;
                baseMultiplierHigh = 380000;
            }
            
            // Calculate ranges
            const low = Math.floor(ageDays * baseMultiplierLow);
            const high = Math.floor(ageDays * baseMultiplierHigh);
            
            return { low, high };
        },
        
        // Advanced estimate using account age and other factors
        advancedEstimate: (ageDays, level = null, networth = null) => {
            const base = statsEstimator.basicEstimate(ageDays);
            
            // Apply adjustments if we have level information
            if (level) {
                const levelMultiplier = 1 + (Math.log10(level) / 10);
                base.low = Math.floor(base.low * levelMultiplier);
                base.high = Math.floor(base.high * levelMultiplier);
            }
            
            // Apply networth adjustments if available
            if (networth) {
                // Wealthy players might have higher stats due to gym upgrades
                const networthAdjustment = Math.min(1.2, Math.max(1, Math.log10(networth/1000000) / 10));
                base.high = Math.floor(base.high * networthAdjustment);
            }
            
            return base;
        },
        
        // Format the estimate range as a string
        formatEstimate: (estimate) => {
            return `${utils.formatNumber(estimate.low)} - ${utils.formatNumber(estimate.high)}`;
        },
        
        // Format the estimate as single number (average) - useful for inline display
        formatEstimateCompact: (estimate) => {
            const avg = Math.floor((estimate.low + estimate.high) / 2);
            return utils.formatNumber(avg);
        },
        
        // Generate a stat breakdown (estimates of individual stats)
        generateStatBreakdown: (totalStats) => {
            // Calculate average total stat
            const avgTotal = Math.floor((totalStats.low + totalStats.high) / 2);
            
            // Generate breakdown distribution (approximately equal for now)
            // In a more advanced implementation, this could analyze activity patterns
            const statBreakdown = {
                strength: { 
                    low: Math.floor(totalStats.low * 0.24), 
                    high: Math.floor(totalStats.high * 0.28)
                },
                speed: {
                    low: Math.floor(totalStats.low * 0.23), 
                    high: Math.floor(totalStats.high * 0.26)
                },
                defense: {
                    low: Math.floor(totalStats.low * 0.24), 
                    high: Math.floor(totalStats.high * 0.27)
                },
                dexterity: {
                    low: Math.floor(totalStats.low * 0.22), 
                    high: Math.floor(totalStats.high * 0.26)
                }
            };
            
            return statBreakdown;
        },
        
        // Calculate fair fight modifier between two players
        // Returns a value between 0-100% and a color code
        calculateFairFight: (playerStats, enemyStats) => {
            // Get average values for calculations
            const myAvgStats = typeof playerStats === 'object' ? 
                Math.floor((playerStats.low + playerStats.high) / 2) : playerStats;
            
            const enemyAvgStats = typeof enemyStats === 'object' ? 
                Math.floor((enemyStats.low + enemyStats.high) / 2) : enemyStats;
            
            if (!myAvgStats || !enemyAvgStats) {
                return {
                    percentage: 100,
                    color: '#888888',
                    description: 'Unknown',
                    ratio: 1
                };
            }
            
            // Calculate ratio
            const ratio = myAvgStats / enemyAvgStats;
            
            // Calculate fair fight percentage using Torn's formula (approximated)
            let fairFightPercentage;
            if (ratio >= 4) {
                fairFightPercentage = 25; // Minimum fair fight (25%)
            } else if (ratio <= 0.25) {
                fairFightPercentage = 100; // Maximum fair fight (100%)
            } else {
                // Calculate fair fight percentage based on ratio
                // Approximation of Torn's formula, may need tweaking
                if (ratio > 1) {
                    fairFightPercentage = 100 - (75 * (ratio - 1) / 3);
                } else {
                    fairFightPercentage = 100;
                }
            }
            
            // Round to integer
            fairFightPercentage = Math.round(fairFightPercentage);
            
            // Determine color based on fair fight percentage
            let color;
            let description;
            
            if (fairFightPercentage >= 95) {
                color = '#00cc00'; // Bright green - excellent
                description = 'Excellent';
            } else if (fairFightPercentage >= 75) {
                color = '#66cc00'; // Green - very good
                description = 'Very Good';
            } else if (fairFightPercentage >= 60) {
                color = '#cccc00'; // Yellow - good
                description = 'Good';
            } else if (fairFightPercentage >= 45) {
                color = '#ff9900'; // Orange - fair
                description = 'Fair';
            } else if (fairFightPercentage >= 35) {
                color = '#ff6600'; // Dark orange - poor
                description = 'Poor';
            } else {
                color = '#ff0000'; // Red - very poor
                description = 'Very Poor';
            }
            
            return {
                percentage: fairFightPercentage,
                color,
                description,
                ratio
            };
        },
        
        // Get a color-coded HTML for the fair fight value
        getFairFightHTML: (fairFight) => {
            return `<span style="color:${fairFight.color}; font-weight:bold;">${fairFight.percentage}%</span>`;
        },
        
        // Save player estimate to storage
        savePlayerEstimate: (playerId, estimate, playerName = null, config = DEFAULT_CONFIG) => {
            if (!config.storeSavedEstimates) return false;
            
            const estimateData = {
                totalStats: estimate,
                playerName: playerName,
                lastUpdated: Date.now()
            };
            
            return utils.storage.playerEstimates.save(playerId, estimateData, config);
        }
    };
    
    // ========== API Integration ==========
    const tornAPI = {
        // Fetch stats using API key
        fetchUserStats: (apiKey, xid = null) => {
            // If xid not provided, fetch own stats
            const endpoint = xid ? 
                `https://api.torn.com/user/${xid}?selections=profile&key=${apiKey}` :
                `https://api.torn.com/user/?selections=profile,stats&key=${apiKey}`;
            
            return fetch(endpoint)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`API Error: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data.error) {
                        throw new Error(`Torn API Error: ${data.error.code} - ${data.error.error}`);
                    }
                    return data;
                });
        },
        
        // Test API key validity (useful for verifying keys)
        testApiKey: (apiKey) => {
            if (!apiKey || apiKey.trim().length < 16) {
                return Promise.reject(new Error("Invalid API key format"));
            }
            
            const testEndpoint = `https://api.torn.com/user/?selections=basic&key=${apiKey}`;
            
            return fetch(testEndpoint)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`API Error: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data.error) {
                        throw new Error(`Torn API Error: ${data.error.code} - ${data.error.error}`);
                    }
                    
                    // If we get here, API key is valid
                    return {
                        valid: true,
                        playerName: data.name || "Unknown",
                        playerId: data.player_id
                    };
                })
                .catch(err => {
                    utils.error(`API key test failed: ${err.message}`);
                    return {
                        valid: false,
                        error: err.message
                    };
                });
        }
    };
    
    // ========== UI Components ==========
    const ui = {
        // Create and add CSS styles
        addStyles: () => {
            const styles = `
                .osprey-container {
                    padding: 12px;
                    margin: 15px 0;
                    border: 2px solid #00bfff;
                    border-radius: 8px;
                    background-color: #081f2d;
                    color: #fff;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    max-width: 100%;
                }
                
                .osprey-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                }
                
                .osprey-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #00bfff;
                }
                
                .osprey-version {
                    font-size: 12px;
                    color: #aaa;
                }
                
                .osprey-stat-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                
                .osprey-stat-label {
                    font-weight: bold;
                }
                
                .osprey-stat-value {
                    color: #00bfff;
                }
                
                .osprey-badge {
                    display: inline-block;
                    padding: 3px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                    margin-left: 8px;
                }
                
                .osprey-api-verified {
                    background-color: #28a745;
                    color: white;
                }
                
                .osprey-api-estimated {
                    background-color: #ffc107;
                    color: #333;
                }
                
                .osprey-footer {
                    margin-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                }
                
                .osprey-button {
                    padding: 6px 12px;
                    margin: 5px 3px;
                    border: none;
                    border-radius: 4px;
                    background-color: #007bff;
                    color: white;
                    cursor: pointer;
                    font-weight: bold;
                    transition: background-color 0.2s;
                }
                
                .osprey-button:hover {
                    background-color: #0056b3;
                }
                
                .osprey-button-secondary {
                    background-color: #6c757d;
                }
                
                .osprey-button-secondary:hover {
                    background-color: #5a6268;
                }
                
                .osprey-breakdown {
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid rgba(255,255,255,0.2);
                }
                
                .osprey-breakdown-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .osprey-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }
                
                .osprey-modal-content {
                    background-color: #1e2129;
                    border: 2px solid #00bfff;
                    border-radius: 8px;
                    padding: 20px;
                    width: 80%;
                    max-width: 500px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                
                .osprey-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                }
                
                .osprey-modal-title {
                    font-size: 18px;
                    font-weight: bold;
                    color: #00bfff;
                }
                
                .osprey-modal-close {
                    font-size: 22px;
                    color: #aaa;
                    cursor: pointer;
                }
                
                .osprey-form-group {
                    margin-bottom: 15px;
                }
                
                .osprey-label {
                    display: block;
                    margin-bottom: 5px;
                    color: #ddd;
                }
                
                .osprey-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #444;
                    border-radius: 4px;
                    background-color: #2c3038;
                    color: white;
                }
                
                .osprey-input:focus {
                    border-color: #00bfff;
                    outline: none;
                }
                
                .osprey-checkbox-label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                }
                
                .osprey-checkbox {
                    margin-right: 8px;
                }
                
                /* Mobile-friendly adjustments (for TornPDA) */
                @media (max-width: 768px) {
                    .osprey-container {
                        padding: 10px;
                        margin: 10px 0;
                    }
                    
                    .osprey-footer {
                        flex-direction: column;
                    }
                    
                    .osprey-button {
                        margin: 3px 0;
                        padding: 8px 12px; /* Larger touch targets */
                    }
                    
                    .osprey-modal-content {
                        width: 90%;
                        padding: 15px;
                    }
                }
            `;
            
            try {
                // Don't use GM_addStyle at all since we're not requesting it in @grant
                // Just create a style element directly - more reliable across platforms
                const styleElement = document.createElement('style');
                styleElement.textContent = styles;
                
                // If document.head is not available yet (possible in some mobile environments),
                // create a function to append it when the document is ready
                if (document.head) {
                    document.head.appendChild(styleElement);
                } else if (document.documentElement) {
                    // If we have documentElement but no head, create head
                    const head = document.createElement('head');
                    document.documentElement.appendChild(head);
                    head.appendChild(styleElement);
                } else {
                    // Last resort - wait for DOMContentLoaded
                    const appendStyles = () => {
                        if (document.head) {
                            document.head.appendChild(styleElement);
                        } else {
                            // Really last resort - append to body
                            document.body.appendChild(styleElement);
                        }
                    };
                    
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', appendStyles);
                    } else {
                        // DOMContentLoaded already fired, use a timeout
                        setTimeout(appendStyles, 0);
                    }
                }
            } catch (e) {
                utils.error("Failed to add styles: " + e.message);
                // Style failures are non-critical, continue without styles
                // The UI will be functional but not properly styled
            }
        },
        
        // Build the main estimation display box
        createEstimationBox: (totalStats, isVerified = false, statBreakdown = null, config = DEFAULT_CONFIG) => {
            const container = document.createElement('div');
            container.className = 'osprey-container';
            container.id = 'osprey-stats-container';
            
            // Header with improved mobile compatibility
            const header = document.createElement('div');
            header.className = 'osprey-header';
            
            // Create element explicitly rather than using innerHTML for better compatibility
            const titleDiv = document.createElement('div');
            titleDiv.className = 'osprey-title';
            titleDiv.textContent = "Osprey's Eye Stat Estimator";
            
            const versionDiv = document.createElement('div');
            versionDiv.className = 'osprey-version';
            versionDiv.textContent = `v${VERSION}`;
            
            header.appendChild(titleDiv);
            header.appendChild(versionDiv);
            container.appendChild(header);
            
            // Main stats display
            const statsDisplay = document.createElement('div');
            statsDisplay.className = 'osprey-stats';
            
            // Total stats row
            const totalRow = document.createElement('div');
            totalRow.className = 'osprey-stat-row';
            totalRow.innerHTML = `
                <div class="osprey-stat-label">Total Battle Stats:</div>
                <div class="osprey-stat-value">
                    ${statsEstimator.formatEstimate(totalStats)}
                    <span class="osprey-badge ${isVerified ? 'osprey-api-verified' : 'osprey-api-estimated'}">
                        ${isVerified ? 'Verified' : 'Estimated'}
                    </span>
                </div>
            `;
            statsDisplay.appendChild(totalRow);
            
            // Add stat breakdown if available and enabled
            if (statBreakdown && config.showStatBreakdown) {
                const breakdownSection = document.createElement('div');
                breakdownSection.className = 'osprey-breakdown';
                
                const breakdownTitle = document.createElement('div');
                breakdownTitle.className = 'osprey-breakdown-title';
                breakdownTitle.textContent = 'Stat Breakdown Estimate:';
                breakdownSection.appendChild(breakdownTitle);
                
                // Individual stats
                ['strength', 'speed', 'defense', 'dexterity'].forEach(stat => {
                    const statRow = document.createElement('div');
                    statRow.className = 'osprey-stat-row';
                    statRow.innerHTML = `
                        <div class="osprey-stat-label">${stat.charAt(0).toUpperCase() + stat.slice(1)}:</div>
                        <div class="osprey-stat-value">
                            ${utils.formatNumber(statBreakdown[stat].low)} - ${utils.formatNumber(statBreakdown[stat].high)}
                        </div>
                    `;
                    breakdownSection.appendChild(statRow);
                });
                
                statsDisplay.appendChild(breakdownSection);
            }
            
            container.appendChild(statsDisplay);
            
            // Footer with buttons
            const footer = document.createElement('div');
            footer.className = 'osprey-footer';
            
            // Button container (right side)
            const buttonContainer = document.createElement('div');
            
            // Toggle breakdown button (if breakdown not already shown)
            if (!config.showStatBreakdown) {
                const breakdownBtn = document.createElement('button');
                breakdownBtn.className = 'osprey-button';
                breakdownBtn.textContent = 'Show Breakdown';
                breakdownBtn.onclick = () => {
                    const updatedConfig = {...config, showStatBreakdown: true};
                    utils.storage.set(STORAGE_KEY_CONFIG, updatedConfig);
                    // Replace the current container with an updated one
                    const parent = container.parentNode;
                    parent.replaceChild(
                        ui.createEstimationBox(totalStats, isVerified, statBreakdown, updatedConfig),
                        container
                    );
                };
                buttonContainer.appendChild(breakdownBtn);
            }
            
            // API Key button - explicit and prominent for TornPDA
            const apiKeyBtn = document.createElement('button');
            apiKeyBtn.className = 'osprey-button';
            apiKeyBtn.style.backgroundColor = '#28a745'; // Green to stand out
            apiKeyBtn.textContent = 'Set API Key';
            apiKeyBtn.onclick = () => ui.showApiKeyModal();
            buttonContainer.appendChild(apiKeyBtn);
            
            // Add a small space between buttons
            buttonContainer.appendChild(document.createTextNode(' '));
            
            // Settings button
            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'osprey-button osprey-button-secondary';
            settingsBtn.textContent = 'Settings';
            settingsBtn.onclick = () => ui.showSettingsModal(config);
            buttonContainer.appendChild(settingsBtn);
            
            footer.appendChild(buttonContainer);
            container.appendChild(footer);
            
            return container;
        },
        
        // Enhanced API key management modal for TornPDA
        showApiKeyModal: () => {
            try {
                utils.log("Opening API Key modal");
                
                // Clear any existing modal - using try/catch for better error handling
                const existingModal = document.getElementById('osprey-modal');
                if (existingModal) {
                    try {
                        existingModal.remove();
                    } catch (e) {
                        if (existingModal.parentNode) {
                            existingModal.parentNode.removeChild(existingModal);
                        }
                    }
                }
                
                // Create modal container
                const modal = document.createElement('div');
                modal.className = 'osprey-modal';
                modal.id = 'osprey-modal';
                
                // Modal content
                const content = document.createElement('div');
                content.className = 'osprey-modal-content';
                
                // Create header - avoid innerHTML for better TornPDA compatibility
                const header = document.createElement('div');
                header.className = 'osprey-modal-header';
                
                const title = document.createElement('div');
                title.className = 'osprey-modal-title';
                title.textContent = "Osprey's Eye API Setup";
                
                const closeBtn = document.createElement('div');
                closeBtn.className = 'osprey-modal-close';
                closeBtn.textContent = '×'; // Using plain × instead of &times;
                
                header.appendChild(title);
                header.appendChild(closeBtn);
                content.appendChild(header);
                
                // Create form group
                const formGroup = document.createElement('div');
                formGroup.className = 'osprey-form-group';
                
                // Label
                const label = document.createElement('label');
                label.className = 'osprey-label';
                label.textContent = 'Enter your Torn API key';
                label.setAttribute('for', 'osprey-api-input');
                formGroup.appendChild(label);
                
                // Input field
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'osprey-input';
                input.id = 'osprey-api-input';
                input.placeholder = 'Your Torn API key';
                input.style.width = '100%';
                input.style.padding = '8px';
                input.style.marginTop = '5px';
                input.style.marginBottom = '10px';
                input.style.boxSizing = 'border-box';
                formGroup.appendChild(input);
                
                // Help text
                const helpText = document.createElement('p');
                helpText.style.color = '#aaa';
                helpText.style.fontSize = '12px';
                helpText.style.marginTop = '5px';
                helpText.style.marginBottom = '5px';
                helpText.textContent = 'Your API key is stored locally in your browser.';
                formGroup.appendChild(helpText);
                
                // API key info link
                const helpLink = document.createElement('a');
                helpLink.href = 'https://www.torn.com/preferences.php#tab=api';
                helpLink.target = '_blank';
                helpLink.style.color = '#00bfff';
                helpLink.style.fontSize = '12px';
                helpLink.textContent = 'Get your API key from Torn API settings';
                formGroup.appendChild(helpLink);
                
                content.appendChild(formGroup);
                
                // Button container
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'osprey-form-group';
                buttonContainer.style.textAlign = 'right';
                buttonContainer.style.marginTop = '15px';
                
                // Cancel button
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'osprey-button osprey-button-secondary';
                cancelBtn.id = 'osprey-cancel-btn';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.style.marginRight = '10px';
                buttonContainer.appendChild(cancelBtn);
                
                // Save button
                const saveBtn = document.createElement('button');
                saveBtn.className = 'osprey-button';
                saveBtn.id = 'osprey-save-api-btn';
                saveBtn.textContent = 'Save API Key';
                saveBtn.style.backgroundColor = '#28a745'; // Green for visibility
                buttonContainer.appendChild(saveBtn);
                
                content.appendChild(buttonContainer);
                modal.appendChild(content);
                
                // Append to body
                document.body.appendChild(modal);
                
                // Get the current API key if any
                const currentKey = utils.storage.get(STORAGE_KEY_API, '');
                const inputElement = document.getElementById('osprey-api-input');
                if (inputElement) {
                    inputElement.value = currentKey || '';
                    
                    // Auto-focus the input field for better UX
                    setTimeout(() => {
                        try {
                            inputElement.focus();
                        } catch (e) {
                            // Focus may fail in some environments, ignore
                        }
                    }, 100);
                }
                
                // Add event listeners with multiple approaches for better compatibility
                const saveBtnElement = document.getElementById('osprey-save-api-btn');
                if (saveBtnElement) {
                    // Main save function with API key verification
                    const saveApiKey = () => {
                        try {
                            // Update save button to show loading state
                            saveBtnElement.textContent = 'Verifying...';
                            saveBtnElement.style.opacity = '0.7';
                            saveBtnElement.disabled = true;
                            
                            const apiKey = inputElement ? inputElement.value.trim() : '';
                            if (apiKey.length < 16) {
                                alert('Please enter a valid API key (at least 16 characters)');
                                saveBtnElement.textContent = 'Save API Key';
                                saveBtnElement.style.opacity = '1';
                                saveBtnElement.disabled = false;
                                return;
                            }
                            
                            // Try to verify the API key by making a test request
                            tornAPI.testApiKey(apiKey)
                                .then(result => {
                                    if (result.valid) {
                                        // Save the verified key
                                        utils.storage.set(STORAGE_KEY_API, apiKey);
                                        
                                        try {
                                            modal.remove();
                                        } catch (e) {
                                            if (modal.parentNode) {
                                                modal.parentNode.removeChild(modal);
                                            }
                                        }
                                        
                                        // Success message with player name if available
                                        if (result.playerName) {
                                            alert(`API key verified for ${result.playerName}! The page will now reload.`);
                                        } else {
                                            alert('API key verified and saved! The page will now reload.');
                                        }
                                        
                                        // Reload the page to apply new API key
                                        setTimeout(() => location.reload(), 500);
                                    } else {
                                        // API key validation failed
                                        alert(`API key verification failed: ${result.error || 'Unknown error'}`);
                                        saveBtnElement.textContent = 'Save API Key';
                                        saveBtnElement.style.opacity = '1';
                                        saveBtnElement.disabled = false;
                                    }
                                })
                                .catch(err => {
                                    // Handle errors from verification
                                    utils.error(`API key verification failed: ${err.message}`);
                                    
                                    // Ask the user if they want to save anyway
                                    if (confirm(`Could not verify API key: ${err.message}. Save anyway?`)) {
                                        utils.storage.set(STORAGE_KEY_API, apiKey);
                                        
                                        try {
                                            modal.remove();
                                        } catch (e) {
                                            if (modal.parentNode) {
                                                modal.parentNode.removeChild(modal);
                                            }
                                        }
                                        
                                        alert('API key saved! The page will now reload to use it.');
                                        setTimeout(() => location.reload(), 500);
                                    } else {
                                        saveBtnElement.textContent = 'Save API Key';
                                        saveBtnElement.style.opacity = '1';
                                        saveBtnElement.disabled = false;
                                    }
                                });
                        } catch (e) {
                            utils.error(`Error saving API key: ${e.message}`);
                            alert(`Error saving API key: ${e.message}`);
                            saveBtnElement.textContent = 'Save API Key';
                            saveBtnElement.style.opacity = '1';
                            saveBtnElement.disabled = false;
                        }
                    };
                    
                    // Try multiple binding methods for maximum compatibility
                    try {
                        saveBtnElement.addEventListener('click', saveApiKey);
                    } catch (e) {
                        saveBtnElement.onclick = saveApiKey;
                    }
                }
                
                // Cancel button handling
                const cancelBtnElement = document.getElementById('osprey-cancel-btn');
                if (cancelBtnElement) {
                    const closeModal = () => {
                        try {
                            modal.remove();
                        } catch (e) {
                            if (modal.parentNode) {
                                modal.parentNode.removeChild(modal);
                            }
                        }
                    };
                    
                    try {
                        cancelBtnElement.addEventListener('click', closeModal);
                    } catch (e) {
                        cancelBtnElement.onclick = closeModal;
                    }
                }
                
                // Close button
                if (closeBtn) {
                    const closeModal = () => {
                        try {
                            modal.remove();
                        } catch (e) {
                            if (modal.parentNode) {
                                modal.parentNode.removeChild(modal);
                            }
                        }
                    };
                    
                    try {
                        closeBtn.addEventListener('click', closeModal);
                    } catch (e) {
                        closeBtn.onclick = closeModal;
                    }
                }
                
                // Also close modal when clicking outside (common mobile UX pattern)
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        try {
                            modal.remove();
                        } catch (e) {
                            if (modal.parentNode) {
                                modal.parentNode.removeChild(modal);
                            }
                        }
                    }
                });
                
            } catch (error) {
                utils.error(`Failed to show API modal: ${error.message}`);
                
                // Fallback method - use simple prompt if modal fails
                // This acts as a safety net for TornPDA where modal might not work
                try {
                    const currentKey = utils.storage.get(STORAGE_KEY_API, '');
                    const newKey = prompt("Enter your Torn API Key (minimum 16 characters):", currentKey || "");
                    
                    if (newKey !== null) {
                        if (newKey.trim().length < 16) {
                            alert('Please enter a valid API key (at least 16 characters)');
                            return;
                        }
                        
                        // Show verifying message
                        alert('Verifying API key...');
                        
                        // Try to verify the key first
                        tornAPI.testApiKey(newKey.trim())
                            .then(result => {
                                if (result.valid) {
                                    // Save the verified key
                                    utils.storage.set(STORAGE_KEY_API, newKey.trim());
                                    
                                    // Success message with player name if available
                                    if (result.playerName) {
                                        alert(`API key verified for ${result.playerName}! The page will now reload.`);
                                    } else {
                                        alert('API key verified and saved! The page will now reload.');
                                    }
                                    
                                    // Reload the page to apply new API key
                                    setTimeout(() => location.reload(), 500);
                                } else {
                                    // API key validation failed but ask if user wants to save anyway
                                    if (confirm(`API key validation failed: ${result.error || 'Unknown error'}. Save anyway?`)) {
                                        utils.storage.set(STORAGE_KEY_API, newKey.trim());
                                        alert('API key saved! The page will now reload to use it.');
                                        setTimeout(() => location.reload(), 500);
                                    }
                                }
                            })
                            .catch(err => {
                                // Handle errors from verification
                                utils.error(`API key verification failed: ${err.message}`);
                                
                                // Ask the user if they want to save anyway
                                if (confirm(`Could not verify API key: ${err.message}. Save anyway?`)) {
                                    utils.storage.set(STORAGE_KEY_API, newKey.trim());
                                    alert('API key saved! The page will now reload to use it.');
                                    setTimeout(() => location.reload(), 500);
                                }
                            });
                    }
                } catch (promptError) {
                    utils.error(`Prompt fallback failed: ${promptError.message}`);
                    alert("There was an error setting up your API key. Please try again later.");
                }
            }
        },
        
        // Settings configuration modal
        showSettingsModal: (currentConfig) => {
            const existingModal = document.getElementById('osprey-modal');
            if (existingModal) existingModal.remove();
            
            const modal = document.createElement('div');
            modal.className = 'osprey-modal';
            modal.id = 'osprey-modal';
            
            const content = document.createElement('div');
            content.className = 'osprey-modal-content';
            
            content.innerHTML = `
                <div class="osprey-modal-header">
                    <div class="osprey-modal-title">Osprey's Eye Settings</div>
                    <div class="osprey-modal-close">&times;</div>
                </div>
                
                <div class="osprey-form-group">
                    <label class="osprey-checkbox-label">
                        <input type="checkbox" class="osprey-checkbox" id="osprey-breakdown-toggle" 
                            ${currentConfig.showStatBreakdown ? 'checked' : ''} />
                        Show stat breakdown by default
                    </label>
                </div>
                
                <div class="osprey-form-group">
                    <label class="osprey-label">Estimation Method</label>
                    <select class="osprey-input" id="osprey-method-select">
                        <option value="basic" ${currentConfig.estimationMethod === 'basic' ? 'selected' : ''}>Basic</option>
                        <option value="advanced" ${currentConfig.estimationMethod === 'advanced' ? 'selected' : ''}>Advanced</option>
                    </select>
                </div>
                
                <div class="osprey-form-group">
                    <label class="osprey-label">UI Position</label>
                    <select class="osprey-input" id="osprey-position-select">
                        <option value="top" ${currentConfig.uiPosition === 'top' ? 'selected' : ''}>Top</option>
                        <option value="bottom" ${currentConfig.uiPosition === 'bottom' ? 'selected' : ''}>Bottom</option>
                    </select>
                </div>
                
                <div class="osprey-form-group">
                    <label class="osprey-checkbox-label">
                        <input type="checkbox" class="osprey-checkbox" id="osprey-compact-toggle" 
                            ${currentConfig.compactMode ? 'checked' : ''} />
                        Compact display mode
                    </label>
                </div>
                
                <div class="osprey-form-group">
                    <button class="osprey-button" id="osprey-api-config-btn">Configure API Key</button>
                </div>
                
                <div class="osprey-form-group" style="text-align:right">
                    <button class="osprey-button osprey-button-secondary" id="osprey-cancel-btn">Cancel</button>
                    <button class="osprey-button" id="osprey-save-settings-btn">Save Settings</button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('osprey-api-config-btn').onclick = () => {
                modal.remove();
                ui.showApiKeyModal();
            };
            
            document.getElementById('osprey-save-settings-btn').onclick = () => {
                const newConfig = {
                    showStatBreakdown: document.getElementById('osprey-breakdown-toggle').checked,
                    estimationMethod: document.getElementById('osprey-method-select').value,
                    uiPosition: document.getElementById('osprey-position-select').value,
                    compactMode: document.getElementById('osprey-compact-toggle').checked,
                    colorScheme: currentConfig.colorScheme // Keep the current value
                };
                
                utils.storage.set(STORAGE_KEY_CONFIG, newConfig);
                modal.remove();
                
                // Refresh the page to apply settings
                location.reload();
            };
            
            document.getElementById('osprey-cancel-btn').onclick = () => modal.remove();
            document.querySelector('.osprey-modal-close').onclick = () => modal.remove();
        }
    };
    
    // ========== Main Application Logic ==========
    // Page detection functions
    function isFactionPage() {
        return window.location.href.includes('factions.php');
    }
    
    // Process the faction page to add stat estimates and fair fight indicators
    function processFactionPage(config) {
        utils.log("Processing faction page");
        
        if (!config.showInlineStats && !config.enableFairFightIndicator) {
            utils.log("Inline stats and fair fight indicators are disabled in settings");
            return;
        }
        
        // Get the API key for user stats
        const apiKey = getApiKeyOrWarn();
        if (!apiKey) {
            utils.log("No API key available for faction page enhancements");
            return;
        }
        
        // First, get the user's own stats for fair fight calculations
        let userStats = null;
        let userXID = null;
        
        // Function to add stat indicators to faction member elements
        const processFactionMembers = () => {
            // Look for member rows/cards - different selectors for different faction page views
            const memberSelectors = [
                // Main faction view
                '.faction-info-wrap .members-list .table-body .table-row',
                // Faction war view
                '.f-war-list .faction-war .members-list .table-row',
                // Mobile selectors
                '.members-list .member',
                // Generic selectors as fallback
                '[class*="member-"][class*="-row"]',
                '.faction-war .member'
            ];
            
            for (const selector of memberSelectors) {
                const members = document.querySelectorAll(selector);
                if (members.length > 0) {
                    utils.log(`Found ${members.length} faction members using selector: ${selector}`);
                    
                    // Process each member
                    members.forEach(member => processFactMember(member, userStats, userXID));
                    return true;
                }
            }
            
            return false;
        };
        
        // If we already have stored stats, use them immediately
        const storedUserStats = utils.storage.get('osprey_user_stats', null);
        if (storedUserStats && storedUserStats.timestamp > Date.now() - (24 * 60 * 60 * 1000)) {
            // Use stats stored within last 24 hours
            userStats = storedUserStats.stats;
            userXID = storedUserStats.xid;
            
            // Process faction members with these stats
            if (processFactionMembers()) {
                // Set up a mutation observer to catch any new members that might be added
                setupFactionMemberObserver(userStats, userXID);
            }
        } else {
            // Fetch fresh user stats
            tornAPI.fetchUserStats(apiKey)
                .then(data => {
                    if (data && data.player_id && data.stats) {
                        userXID = data.player_id;
                        
                        // Calculate total stats
                        userStats = {
                            low: data.stats.strength + data.stats.speed + data.stats.defense + data.stats.dexterity,
                            high: data.stats.strength + data.stats.speed + data.stats.defense + data.stats.dexterity
                        };
                        
                        // Store for future use
                        utils.storage.set('osprey_user_stats', {
                            stats: userStats,
                            xid: userXID,
                            timestamp: Date.now()
                        });
                        
                        // Process faction members with these stats
                        if (processFactionMembers()) {
                            // Set up a mutation observer to catch any new members that might be added
                            setupFactionMemberObserver(userStats, userXID);
                        }
                    } else {
                        utils.error("Could not retrieve user stats from API");
                    }
                })
                .catch(err => {
                    utils.error(`API error getting user stats: ${err.message}`);
                });
        }
    }
    
    // Process a single faction member element to add stat and fair fight information
    function processFactMember(memberElement, userStats, userXID) {
        try {
            // Look for the member's XID
            let xid = null;
            const config = utils.storage.get(STORAGE_KEY_CONFIG, DEFAULT_CONFIG);
            
            // Try different methods to get the XID
            
            // Method 1: Look for data attribute
            if (memberElement.dataset && memberElement.dataset.id) {
                xid = memberElement.dataset.id;
            }
            
            // Method 2: Look for profile link
            if (!xid) {
                const profileLink = memberElement.querySelector('a[href*="profiles.php"]');
                if (profileLink) {
                    const match = profileLink.href.match(/XID=(\d+)/);
                    if (match) {
                        xid = match[1];
                    }
                }
            }
            
            // Method 3: Look for icon with XID
            if (!xid) {
                const icons = memberElement.querySelectorAll('li[id], div[id]');
                for (const icon of icons) {
                    const match = icon.id.match(/icon(\d+)/);
                    if (match) {
                        xid = match[1];
                        break;
                    }
                }
            }
            
            if (!xid) {
                return; // Can't process without XID
            }
            
            // Skip self
            if (xid === userXID) {
                return;
            }
            
            // Check if we have a stored estimate for this player
            let playerEstimate = utils.storage.playerEstimates.get(xid);
            
            // If we have a stored estimate, use it
            if (playerEstimate && playerEstimate.totalStats) {
                appendStatsToMember(memberElement, playerEstimate.totalStats, xid, userStats, config);
                return;
            }
            
            // No stored estimate, try to calculate one
            
            // Find the player's level if available
            let level = null;
            const levelText = memberElement.textContent.match(/Level (\d+)/);
            if (levelText) {
                level = parseInt(levelText[1]);
            }
            
            // Find the player's age if available
            const ageText = memberElement.textContent.match(/(\d+) days/);
            let ageDays = null;
            if (ageText) {
                ageDays = parseInt(ageText[1]);
            }
            
            if (ageDays) {
                // Generate estimate based on age
                const estimate = level ? 
                    statsEstimator.advancedEstimate(ageDays, level) : 
                    statsEstimator.basicEstimate(ageDays);
                
                // Store the estimate
                const playerName = memberElement.querySelector('.name, .player-name, .member-name')?.textContent.trim();
                statsEstimator.savePlayerEstimate(xid, estimate, playerName, config);
                
                // Add the estimate to the UI
                appendStatsToMember(memberElement, estimate, xid, userStats, config);
            }
        } catch (e) {
            utils.error(`Error processing faction member: ${e.message}`);
        }
    }
    
    // Add stat estimates and fair fight indicators to a faction member element
    function appendStatsToMember(memberElement, statEstimate, xid, userStats, config) {
        try {
            // Find the best spot to insert our info
            let targetElement = null;
            
            // Try several possible targets
            const possibleTargets = [
                '.level', '.name', '.player-icons', '.member-icons',
                '.member-data', '.user-data', '.icons', '.data'
            ];
            
            for (const selector of possibleTargets) {
                const element = memberElement.querySelector(selector);
                if (element) {
                    targetElement = element;
                    break;
                }
            }
            
            if (!targetElement) {
                // Use the member element itself as a fallback
                targetElement = memberElement;
            }
            
            // Check if we've already added stats to this member
            if (memberElement.querySelector('.osprey-member-stats')) {
                return;
            }
            
            // Create container for our additions
            const container = document.createElement('div');
            container.className = 'osprey-member-stats';
            container.style.fontSize = '11px';
            container.style.marginTop = '3px';
            
            // Add total stats if enabled
            if (config.showInlineStats) {
                const statsText = document.createElement('span');
                statsText.className = 'osprey-inline-stats';
                statsText.style.marginRight = '8px';
                statsText.style.color = '#66a3ff';
                statsText.textContent = `Stats: ${statsEstimator.formatEstimateCompact(statEstimate)}`;
                container.appendChild(statsText);
            }
            
            // Add fair fight indicator if enabled
            if (config.enableFairFightIndicator && userStats) {
                const fairFight = statsEstimator.calculateFairFight(userStats, statEstimate);
                
                const ffContainer = document.createElement('span');
                ffContainer.className = 'osprey-fairfight';
                ffContainer.style.marginRight = '8px';
                ffContainer.innerHTML = `FF: ${statsEstimator.getFairFightHTML(fairFight)}`;
                
                container.appendChild(ffContainer);
            }
            
            // Add an "Estimate" button to show detailed breakdown
            const estimateBtn = document.createElement('span');
            estimateBtn.className = 'osprey-estimate-btn';
            estimateBtn.style.color = '#ffcc00';
            estimateBtn.style.cursor = 'pointer';
            estimateBtn.style.textDecoration = 'underline';
            estimateBtn.textContent = 'Estimate';
            estimateBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent triggering parent click events
                showStatBreakdownTooltip(estimateBtn, statEstimate, xid);
            };
            
            container.appendChild(estimateBtn);
            
            // Append to target
            targetElement.appendChild(container);
            
        } catch (e) {
            utils.error(`Error appending stats to member: ${e.message}`);
        }
    }
    
    // Show a tooltip with detailed stat breakdown
    function showStatBreakdownTooltip(element, statEstimate, xid) {
        // Remove any existing tooltips
        const existingTooltip = document.getElementById('osprey-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // Get player info if available
        const playerInfo = utils.storage.playerEstimates.get(xid);
        const playerName = playerInfo?.playerName || `Player ${xid}`;
        
        // Generate stat breakdown
        const breakdown = statsEstimator.generateStatBreakdown(statEstimate);
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'osprey-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.zIndex = '9999';
        tooltip.style.backgroundColor = '#1e2129';
        tooltip.style.border = '2px solid #00bfff';
        tooltip.style.borderRadius = '8px';
        tooltip.style.padding = '12px';
        tooltip.style.color = '#fff';
        tooltip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        tooltip.style.width = '220px';
        tooltip.style.fontSize = '12px';
        
        tooltip.innerHTML = `
            <div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#00bfff;">
                ${playerName} - Stat Estimate
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Total:</span> 
                <span style="color:#66a3ff; float:right;">${statsEstimator.formatEstimate(statEstimate)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Strength:</span> 
                <span style="color:#ff6666; float:right;">${statsEstimator.formatEstimate(breakdown.strength)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Defense:</span> 
                <span style="color:#66cc66; float:right;">${statsEstimator.formatEstimate(breakdown.defense)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Speed:</span> 
                <span style="color:#ffcc00; float:right;">${statsEstimator.formatEstimate(breakdown.speed)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Dexterity:</span> 
                <span style="color:#cc66ff; float:right;">${statsEstimator.formatEstimate(breakdown.dexterity)}</span>
            </div>
            <div style="color:#999; font-size:10px; margin-top:10px; text-align:center;">
                Osprey's Eye Estimation
            </div>
        `;
        
        // Position tooltip near the element
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        
        // Add to document
        document.body.appendChild(tooltip);
        
        // Close tooltip when clicking outside
        const closeTooltip = (e) => {
            if (e.target !== element && !tooltip.contains(e.target)) {
                tooltip.remove();
                document.removeEventListener('click', closeTooltip);
            }
        };
        
        // Use timeout to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', closeTooltip);
        }, 100);
    }
    
    // Set up an observer to catch dynamically added faction members
    function setupFactionMemberObserver(userStats, userXID) {
        const config = utils.storage.get(STORAGE_KEY_CONFIG, DEFAULT_CONFIG);
        
        // Create a mutation observer
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if this is a member element itself
                            if (node.matches('.member, .table-row, [class*="member-"]')) {
                                processFactMember(node, userStats, userXID);
                            }
                            
                            // Check for member elements inside this node
                            const members = node.querySelectorAll('.member, .table-row, [class*="member-"]');
                            members.forEach(member => processFactMember(member, userStats, userXID));
                        }
                    }
                }
            }
        });
        
        // Start observing
        const targetNode = document.querySelector('.faction-info-wrap, .f-war-list, .content-wrapper, .content');
        if (targetNode) {
            observer.observe(targetNode, { childList: true, subtree: true });
            utils.log("Set up faction member observer");
        }
    }
    
    // Get API Key or display message if needed
    function getApiKeyOrWarn() {
        const apiKey = utils.storage.get(STORAGE_KEY_API, '');
        if (!apiKey || apiKey.length < 16) {
            // Only show the warning once per session
            if (!window.ospreysEyeApiWarningShown) {
                window.ospreysEyeApiWarningShown = true;
                
                // Create a simple notification
                const warning = document.createElement('div');
                warning.style.position = 'fixed';
                warning.style.top = '10px';
                warning.style.right = '10px';
                warning.style.backgroundColor = '#f8d7da';
                warning.style.color = '#721c24';
                warning.style.padding = '10px 15px';
                warning.style.borderRadius = '5px';
                warning.style.zIndex = '9999';
                warning.style.maxWidth = '300px';
                warning.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                warning.innerHTML = `
                    <div style="font-weight:bold; margin-bottom:5px;">Osprey's Eye</div>
                    <div>No API key set. Fair fight and stat estimates require an API key to work properly.</div>
                    <button id="osprey-add-api-btn" style="
                        background: #007bff;
                        border: none;
                        color: white;
                        padding: 5px 10px;
                        margin-top: 8px;
                        border-radius: 3px;
                        cursor: pointer;">Add API Key</button>
                    <button id="osprey-close-warning-btn" style="
                        background: #6c757d;
                        border: none;
                        color: white;
                        padding: 5px 10px;
                        margin-top: 8px;
                        margin-left: 5px;
                        border-radius: 3px;
                        cursor: pointer;">Dismiss</button>
                `;
                
                document.body.appendChild(warning);
                
                // Add event listeners
                document.getElementById('osprey-add-api-btn').addEventListener('click', () => {
                    warning.remove();
                    ui.showApiKeyModal();
                });
                
                document.getElementById('osprey-close-warning-btn').addEventListener('click', () => {
                    warning.remove();
                });
                
                // Auto-remove after 10 seconds
                setTimeout(() => {
                    if (warning.parentNode) {
                        warning.remove();
                    }
                }, 10000);
            }
            
            return null;
        }
        
        return apiKey;
    }
    
    function initializeApp() {
        utils.log("Initializing...");
        
        try {
            // Add styles to page - safely
            try {
                ui.addStyles();
            } catch (styleError) {
                utils.error("Error adding styles: " + styleError.message);
                // Continue anyway - styles aren't critical
            }
            
            // Get user configuration
            const config = utils.storage.get(STORAGE_KEY_CONFIG, DEFAULT_CONFIG);
            
            // Check API key
            getApiKeyOrWarn();
            
            // Handle faction pages if needed
            if (isFactionPage()) {
                processFactionPage(config);
                return;
            }
            
            // For profile pages, get the XID
            const currentXID = utils.getCurrentXID();
            if (!currentXID) {
                utils.error("Could not determine profile XID - may not be on a profile page");
                return;
            }
            
            utils.debug(`Detected profile XID: ${currentXID}`, config);
            
            // Profile container selectors to try - in order of preference
            // Extended list with more options for TornPDA
            const selectors = [
                ".user-information", 
                ".profile-container",
                ".basic-information",
                ".profile-wrapper",
                ".profile-status",
                ".user-profile",
                ".profile-data",
                ".player-info",
                "div[class*='profile']", // Generic class containing 'profile'
                "div[class*='user']", // Generic class containing 'user'
                "div.title-black", // Common Torn container
                "div.container", // Most generic fallback
                "#profileroot" // Last resort ID
            ];
            
            utils.debug(`Searching for profile container using ${selectors.length} possible selectors`, config);
            
            // Try to find the profile container with any of our selectors
            // We'll use a more robust approach with timeouts and multiple attempts
            let selectorIndex = 0;
            let targetElement = null;
            let findElementTimeout = null;
            
            const tryNextSelector = () => {
                if (selectorIndex >= selectors.length) {
                    utils.log("Could not find any suitable profile container - creating a new one");
                    
                    // Last resort - create our own container at the top of the page
                    const newContainer = document.createElement('div');
                    newContainer.id = 'ospreys-eye-container';
                    newContainer.className = 'ospreys-eye-custom-container';
                    newContainer.style.margin = '10px';
                    newContainer.style.padding = '10px';
                    newContainer.style.border = '1px solid #ddd';
                    newContainer.style.borderRadius = '5px';
                    
                    // Find best insertion point
                    const contentArea = document.querySelector('.content-wrapper') || 
                                         document.querySelector('.content') || 
                                         document.querySelector('body');
                    const firstChild = contentArea.firstChild;
                    
                    if (firstChild) {
                        contentArea.insertBefore(newContainer, firstChild);
                    } else {
                        contentArea.appendChild(newContainer);
                    }
                    
                    processProfile(newContainer, currentXID, config);
                    return;
                }
                
                const currentSelector = selectors[selectorIndex];
                utils.debug(`Trying selector: ${currentSelector}`, config);
                
                // Cancel any existing wait
                if (findElementTimeout) {
                    clearTimeout(findElementTimeout);
                }
                
                // Try direct find first for better performance
                const directResult = utils.findElement(currentSelector);
                if (directResult) {
                    utils.debug(`Found element directly with selector: ${currentSelector}`, config);
                    processProfile(directResult, currentXID, config);
                    return;
                }
                
                // If direct find fails, set up a waitForElement with short timeout
                const cancelWait = utils.waitForElement(currentSelector, (element) => {
                    if (!targetElement && element) {
                        targetElement = element;
                        utils.debug(`Found element via wait with selector: ${currentSelector}`, config);
                        processProfile(element, currentXID, config);
                    }
                }, 5); // Short max attempts
                
                // Set timeout to try next selector if this one fails
                findElementTimeout = setTimeout(() => {
                    if (!targetElement) {
                        cancelWait(); // Cancel the current wait
                        selectorIndex++;
                        tryNextSelector();
                    }
                }, 1500); // Wait 1.5 seconds before trying next selector
            };
            
            // Start the selector search process
            tryNextSelector();
            
        } catch (e) {
            utils.error(`Initialization error: ${e.message}`);
            // Add visible error for user if we can
            try {
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.style.padding = '10px';
                errorDiv.style.margin = '10px';
                errorDiv.style.border = '1px solid red';
                errorDiv.style.borderRadius = '5px';
                errorDiv.textContent = `Osprey's Eye Error: ${e.message}. Try refreshing the page.`;
                document.body.insertBefore(errorDiv, document.body.firstChild);
            } catch (uiError) {
                // Last resort - we really can't do anything else
                console.error("Critical UI error in Osprey's Eye", uiError);
            }
        }
    }
    
    function processProfile(profileContainer, xid, config) {
        utils.log("Processing profile " + xid);
        
        try {
            // Get account age - this is critical for estimation
            let accountAge = utils.getAccountAge();
            if (!accountAge) {
                utils.error("Could not determine account age - using fallback estimation");
                // We'll use a fallback age of 1000 days if we can't determine it
                // This is better than not showing anything
                accountAge = 1000; 
            }
            
            utils.debug(`Account age: ${accountAge} days`, config);
            
            // Check if this is the user's own profile
            const isOwnProfile = utils.isOwnProfile();
            utils.debug(`Is own profile: ${isOwnProfile}`, config);
            
            // Get API key if available
            const apiKey = utils.storage.get(STORAGE_KEY_API, '');
            const hasApiKey = apiKey && apiKey.length > 10;
            utils.debug(`Has API key: ${hasApiKey}`, config);
            
            // Initialize with base estimate
            let estimatedStats = config.estimationMethod === 'advanced' ? 
                statsEstimator.advancedEstimate(accountAge) : 
                statsEstimator.basicEstimate(accountAge);
                
            let statBreakdown = statsEstimator.generateStatBreakdown(estimatedStats);
            let verified = false;
            
            // Show a loading indicator while we process
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'osprey-loading';
            loadingDiv.style.padding = '10px';
            loadingDiv.style.margin = '10px 0';
            loadingDiv.style.border = '2px solid #00bfff';
            loadingDiv.style.borderRadius = '8px';
            loadingDiv.style.backgroundColor = '#081f2d';
            loadingDiv.style.color = '#fff';
            loadingDiv.style.textAlign = 'center';
            loadingDiv.textContent = "Osprey's Eye is analyzing this profile...";
            
            // Find safest place to add the loading indicator
            try {
                // Clean up any old instances first
                const oldLoading = document.getElementById('osprey-loading');
                if (oldLoading) oldLoading.remove();
                
                if (profileContainer) {
                    // Try prepend first
                    try {
                        profileContainer.prepend(loadingDiv);
                    } catch (e) {
                        // If prepend fails, try appendChild
                        try {
                            profileContainer.appendChild(loadingDiv);
                        } catch (e2) {
                            // If both fail, try insertBefore
                            if (profileContainer.firstChild) {
                                profileContainer.insertBefore(loadingDiv, profileContainer.firstChild);
                            }
                        }
                    }
                }
            } catch (loadingError) {
                utils.error(`Could not add loading indicator: ${loadingError.message}`);
                // This is not critical, continue
            }
            
            // If we have an API key, try to enhance our data
            if (hasApiKey) {
                utils.debug(`Using API key to fetch data`, config);
                
                // Set up API call timeout in case it hangs
                const apiTimeout = setTimeout(() => {
                    utils.error("API call timed out");
                    // Remove loading indicator
                    const loadingEl = document.getElementById('osprey-loading');
                    if (loadingEl) loadingEl.remove();
                    
                    // Just show our estimate as fallback
                    insertEstimationBox(profileContainer, estimatedStats, verified, statBreakdown, config);
                    
                    // Add inline stats and estimate button
                    addInlineStatsAndButton(profileContainer, estimatedStats, xid, config);
                }, 10000); // 10 second timeout
                
                // First, handle the case where this is the user's own profile
                if (isOwnProfile) {
                    utils.debug(`Fetching own profile stats`, config);
                    
                    tornAPI.fetchUserStats(apiKey)
                        .then(data => {
                            clearTimeout(apiTimeout);
                            
                            if (data && data.stats) {
                                utils.debug(`Got stats data: ${JSON.stringify(data.stats)}`, config);
                                
                                // Get actual total stats
                                const totalStats = data.stats.strength + 
                                                   data.stats.speed + 
                                                   data.stats.defense + 
                                                   data.stats.dexterity;
                                                   
                                estimatedStats = { low: totalStats, high: totalStats };
                                
                                // Get actual stat breakdown
                                statBreakdown = {
                                    strength: { low: data.stats.strength, high: data.stats.strength },
                                    speed: { low: data.stats.speed, high: data.stats.speed },
                                    defense: { low: data.stats.defense, high: data.stats.defense },
                                    dexterity: { low: data.stats.dexterity, high: data.stats.dexterity }
                                };
                                
                                verified = true;
                            } else {
                                if (data && data.error) {
                                    utils.error(`API error: ${data.error.code} - ${data.error.error}`);
                                } else {
                                    utils.error("API response missing stats data");
                                }
                            }
                        })
                        .catch(err => {
                            clearTimeout(apiTimeout);
                            utils.error("API error: " + err.message);
                        })
                        .finally(() => {
                            // Remove loading indicator
                            const loadingEl = document.getElementById('osprey-loading');
                            if (loadingEl) loadingEl.remove();
                            
                            // Insert the estimation box
                            insertEstimationBox(profileContainer, estimatedStats, verified, statBreakdown, config);
 
                            // Add inline stats and estimate button
                            addInlineStatsAndButton(profileContainer, estimatedStats, xid, config);
                        });
                } else {
                    utils.debug(`Fetching other player profile data: ${xid}`, config);
                    
                    // For other players, we can still try to get their profile data
                    // to improve our estimate
                    tornAPI.fetchUserStats(apiKey, xid)
                        .then(data => {
                            clearTimeout(apiTimeout);
                            
                            if (data && data.level) {
                                utils.debug(`Got player level: ${data.level}`, config);
                                
                                // Use advanced estimation with level info
                                const networth = data.networth || null;
                                if (networth) {
                                    utils.debug(`Got player networth: ${networth}`, config);
                                }
                                
                                estimatedStats = statsEstimator.advancedEstimate(accountAge, data.level, networth);
                                statBreakdown = statsEstimator.generateStatBreakdown(estimatedStats);
                            } else {
                                if (data && data.error) {
                                    utils.error(`API error: ${data.error.code} - ${data.error.error}`);
                                } else {
                                    utils.error("API response missing player data");
                                }
                            }
                        })
                        .catch(err => {
                            clearTimeout(apiTimeout);
                            utils.error("API error: " + err.message);
                        })
                        .finally(() => {
                            // Remove loading indicator
                            const loadingEl = document.getElementById('osprey-loading');
                            if (loadingEl) loadingEl.remove();
 
                            // Add inline stats and estimate button
                            addInlineStatsAndButton(profileContainer, estimatedStats, xid, config);
                            
                            // Insert the estimation box
                            insertEstimationBox(profileContainer, estimatedStats, verified, statBreakdown, config);
                        });
                }
            } else {
                utils.debug(`No API key, using base estimation`, config);
                
 
                // Add inline stats and estimate button
                addInlineStatsAndButton(profileContainer, estimatedStats, xid, config);
                // No API key, just use our estimate
                // Remove loading indicator first
                const loadingEl = document.getElementById('osprey-loading');
                if (loadingEl) loadingEl.remove();
                
                insertEstimationBox(profileContainer, estimatedStats, verified, statBreakdown, config);
                
                // If this is the user's profile, prompt for API key
                if (isOwnProfile) {
                    utils.debug(`Showing API key prompt for own profile`, config);
                    
                    setTimeout(() => {
                        try {
                            const wantToSet = confirm("Osprey's Eye works better with an API key. Do you want to set one up now?");
                            if (wantToSet) {
                                ui.showApiKeyModal();
                            }
                        } catch (promptError) {
                            utils.error(`Error showing API prompt: ${promptError.message}`);
                            // Not critical, continue
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            utils.error(`Error processing profile: ${error.message}`);
            
            // Try to display an error message if possible
            try {
                // Remove any loading indicator
                const loadingEl = document.getElementById('osprey-loading');
                if (loadingEl) loadingEl.remove();
                
                // Create an error box
                const errorBox = document.createElement('div');
                errorBox.style.padding = '10px';
                errorBox.style.margin = '10px 0';
                errorBox.style.border = '2px solid #ff0000';
                errorBox.style.borderRadius = '8px';
                errorBox.style.backgroundColor = '#2d0808';
                errorBox.style.color = '#fff';
                errorBox.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 5px;">Osprey's Eye Error</div>
                    <div>${error.message}</div>
                    <div style="margin-top: 10px; font-size: 12px;">Try refreshing the page or check console for more details.</div>
                `;
                
                // Try to insert it somewhere visible
                if (profileContainer) {
                    try {
                        profileContainer.prepend(errorBox);
                    } catch (e) {
                        try {
                            profileContainer.appendChild(errorBox);
                        } catch (e2) {
                            document.body.prepend(errorBox);
                        }
                    }
                } else {
                    document.body.prepend(errorBox);
                }
            } catch (uiError) {
                // Last resort - we can't do anything else
                console.error("Critical UI error in Osprey's Eye", uiError);
            }
        }
    }
    
    // Add inline stats display and "Estimate" button near the profile picture
    function addInlineStatsAndButton(profileContainer, statEstimate, xid, config) {
        try {
            if (!config.showInlineStats) {
                utils.log("Inline stats disabled in config");
                return;
            }
            
            // Find the profile picture area - several possible selectors
            const pfpSelectors = [
                '.user-profile-pic', 
                '.profile-pic',
                '.user-info img',
                '.player-info img',
                '.avatar',
                '.profile-container img',
                // Add more if needed
            ];
            
            // Also check for parent containers
            const containerSelectors = [
                '.basic-information',
                '.user-info',
                '.user-profile-info',
                '.profile-container',
                '.avatar-container',
                '.user-data'
            ];
            
            // First try direct picture selectors
            let targetElement = null;
            for (const selector of pfpSelectors) {
                const element = profileContainer.querySelector(selector);
                if (element) {
                    targetElement = element.parentElement;
                    break;
                }
            }
            
            // If not found, try container selectors
            if (!targetElement) {
                for (const selector of containerSelectors) {
                    const element = profileContainer.querySelector(selector);
                    if (element) {
                        targetElement = element;
                        break;
                    }
                }
            }
            
            // Fallback to any valid container
            if (!targetElement) {
                targetElement = profileContainer.querySelector('.profile-status, .status, .info');
            }
            
            if (!targetElement) {
                utils.error("Could not find profile picture area");
                return;
            }
            
            // Check if we already added the inline stats
            if (targetElement.querySelector('.osprey-inline-profile-stats')) {
                return;
            }
            
            // Create container for inline stats + button
            const inlineContainer = document.createElement('div');
            inlineContainer.className = 'osprey-inline-profile-stats';
            inlineContainer.style.marginTop = '10px';
            inlineContainer.style.padding = '5px 0';
            inlineContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
            inlineContainer.style.color = '#fff';
            inlineContainer.style.fontSize = '13px';
            inlineContainer.style.textAlign = 'center';
            
            // Add stat estimation
            const statsText = document.createElement('div');
            statsText.style.fontWeight = 'bold';
            statsText.style.color = '#66a3ff';
            statsText.style.marginBottom = '5px';
            statsText.innerHTML = `Stats: ${statsEstimator.formatEstimateCompact(statEstimate)}`;
            inlineContainer.appendChild(statsText);
            
            // Add the estimate button
            const estimateBtn = document.createElement('button');
            estimateBtn.className = 'osprey-profile-estimate-btn';
            estimateBtn.textContent = 'Detailed Estimate';
            estimateBtn.style.backgroundColor = '#1e2129';
            estimateBtn.style.border = '1px solid #00bfff';
            estimateBtn.style.color = '#00bfff';
            estimateBtn.style.padding = '4px 8px';
            estimateBtn.style.fontSize = '11px';
            estimateBtn.style.borderRadius = '3px';
            estimateBtn.style.cursor = 'pointer';
            estimateBtn.style.transition = 'background-color 0.2s';
            
            // Add hover effect
            estimateBtn.onmouseover = () => {
                estimateBtn.style.backgroundColor = '#2a3241';
            };
            estimateBtn.onmouseout = () => {
                estimateBtn.style.backgroundColor = '#1e2129';
            };
            
            // Add click handler to show breakdown tooltip
            estimateBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Generate the breakdown
                const breakdown = statsEstimator.generateStatBreakdown(statEstimate);
                
                // Get player name if available
                const playerInfo = utils.storage.playerEstimates.get(xid);
                let playerName = playerInfo?.playerName;
                
                // If no stored name, try to get from page
                if (!playerName) {
                    const nameElement = profileContainer.querySelector('.user-name, .name, .player-name, .title');
                    if (nameElement) {
                        playerName = nameElement.textContent.trim();
                    } else {
                        playerName = `Player ${xid}`;
                    }
                }
                
                // Show tooltip with detailed breakdown
                showDetailedStatBreakdown(estimateBtn, statEstimate, breakdown, playerName);
            };
            
            inlineContainer.appendChild(estimateBtn);
            
            // Add to page
            targetElement.appendChild(inlineContainer);
            
        } catch (e) {
            utils.error(`Error adding inline stats: ${e.message}`);
        }
    }
    
    // Show a detailed stat breakdown in a tooltip/modal
    function showDetailedStatBreakdown(element, statEstimate, breakdown, playerName) {
        // Remove any existing tooltips
        const existingTooltip = document.getElementById('osprey-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'osprey-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.zIndex = '9999';
        tooltip.style.backgroundColor = '#1e2129';
        tooltip.style.border = '2px solid #00bfff';
        tooltip.style.borderRadius = '8px';
        tooltip.style.padding = '12px';
        tooltip.style.color = '#fff';
        tooltip.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        tooltip.style.width = '220px';
        tooltip.style.fontSize = '12px';
        
        tooltip.innerHTML = `
            <div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#00bfff;">
                ${playerName} - Stat Estimate
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Total:</span> 
                <span style="color:#66a3ff; float:right;">${statsEstimator.formatEstimate(statEstimate)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Strength:</span> 
                <span style="color:#ff6666; float:right;">${statsEstimator.formatEstimate(breakdown.strength)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Defense:</span> 
                <span style="color:#66cc66; float:right;">${statsEstimator.formatEstimate(breakdown.defense)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Speed:</span> 
                <span style="color:#ffcc00; float:right;">${statsEstimator.formatEstimate(breakdown.speed)}</span>
            </div>
            <div style="margin-bottom:6px;">
                <span style="font-weight:bold;">Dexterity:</span> 
                <span style="color:#cc66ff; float:right;">${statsEstimator.formatEstimate(breakdown.dexterity)}</span>
            </div>
            <div style="color:#999; font-size:10px; margin-top:10px; text-align:center;">
                Osprey's Eye Estimation
            </div>
        `;
        
        // Position tooltip near the element
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        
        // Add to document
        document.body.appendChild(tooltip);
        
        // Close tooltip when clicking outside
        const closeTooltip = (e) => {
            if (e.target !== element && !tooltip.contains(e.target)) {
                tooltip.remove();
                document.removeEventListener('click', closeTooltip);
            }
        };
        
        // Use timeout to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', closeTooltip);
        }, 100);
    }
    
    function insertEstimationBox(container, stats, verified, breakdown, config) {
        try {
            utils.debug(`Inserting estimation box`, config);
            
            // Remove any existing box
            const existingBox = document.getElementById('osprey-stats-container');
            if (existingBox) {
                try {
                    existingBox.remove();
                } catch (e) {
                    // If remove() fails, try removeChild
                    try {
                        existingBox.parentNode.removeChild(existingBox);
                    } catch (e2) {
                        utils.error(`Could not remove existing box: ${e2.message}`);
                        // Continue anyway
                    }
                }
            }
            
            // Create the stat estimation box
            const box = ui.createEstimationBox(stats, verified, breakdown, config);
            
            // Insert at the appropriate position
            if (container) {
                if (config.uiPosition === 'top') {
                    try {
                        container.prepend(box);
                    } catch (prependError) {
                        utils.error(`Error using prepend: ${prependError.message}`);
                        
                        // Fallback to insertBefore
                        try {
                            if (container.firstChild) {
                                container.insertBefore(box, container.firstChild);
                            } else {
                                container.appendChild(box);
                            }
                        } catch (insertError) {
                            utils.error(`Error using insertBefore: ${insertError.message}`);
                            
                            // Last resort
                            try {
                                container.appendChild(box);
                            } catch (appendError) {
                                utils.error(`Failed to insert box: ${appendError.message}`);
                                
                                // If all else fails, try to add to body
                                document.body.prepend(box);
                            }
                        }
                    }
                } else {
                    try {
                        container.appendChild(box);
                    } catch (appendError) {
                        utils.error(`Failed to append box: ${appendError.message}`);
                        
                        // Try alternative approaches
                        try {
                            container.insertBefore(box, null);
                        } catch (e) {
                            // Last resort - add to body
                            document.body.appendChild(box);
                        }
                    }
                }
            } else {
                // If no container, add to body
                document.body.prepend(box);
            }
            
            utils.debug(`Estimation box inserted successfully`, config);
        } catch (error) {
            utils.error(`Error inserting estimation box: ${error.message}`);
        }
    }
    
    // Enhanced initialization for maximum compatibility across platforms
    const initializeTornScript = () => {
        try {
            utils.log("Starting initialization...");
            // Add a small delay to ensure DOM is fully processed by TornPDA
            setTimeout(initializeApp, 300);
        } catch (e) {
            utils.error(`Error during initialization: ${e.message}`);
            // Try again with a longer delay as a fallback
            setTimeout(initializeApp, 1500);
        }
    };
    
    // Multiple initialization methods for maximum compatibility
    // This helps the script work in various environments including TornPDA
    const setupInitialization = () => {
        // Method 1: Check if document is already complete
        if (document.readyState === 'complete') {
            initializeTornScript();
            return;
        }
        
        // Method 2: Standard load event listener
        window.addEventListener('load', initializeTornScript);
        
        // Method 3: DOMContentLoaded (may fire earlier than load)
        document.addEventListener('DOMContentLoaded', () => {
            // This will only run if load hasn't fired yet
            if (document.readyState !== 'complete') {
                initializeTornScript();
            }
        });
        
        // Method 4: Backup timeout - run after 2 seconds regardless
        // This ensures the script runs even if normal events don't fire correctly
        setTimeout(initializeTornScript, 2000);
    };
    
    // Start the initialization process
    setupInitialization();
})();
