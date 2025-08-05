// ==UserScript==
// @name         Brother Owl Skyview - Advanced Battle Intelligence
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Advanced battle stats and intelligence system for Torn City - Brother Owl Discord Bot Integration
// @author       Brother Owl Team
// @match        https://www.torn.com/profiles.php*
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/loader.php?sid=attack*
// @match        https://www.torn.com/hospitalview.php*
// @match        https://www.torn.com/jailview.php*
// @match        https://www.torn.com/pmarket.php*
// @match        https://www.torn.com/joblist.php*
// @match        https://www.torn.com/index.php?page=people*
// @match        https://www.torn.com/bounties.php*
// @connect      brother-owl-bot.replit.app
// @connect      api.torn.com
// @grant        GM.xmlHttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// @downloadURL  https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// @run-at       document-end
// ==/UserScript==

/**
 * Brother Owl Skyview - Advanced Battle Intelligence System
 * 
 * Features:
 * - Multi-page battle stats display (profiles, factions, attacks)
 * - Dark/light mode theme support
 * - Real-time authentication with Brother Owl Discord bot
 * - Comprehensive battle stats estimation and display
 * - Advanced caching system for performance
 * - Clean table-based displays with tooltips
 * - Auto-update functionality
 * - Error handling and loading states
 * 
 * Based on best practices from Battle Stats Predictor and TSC Companion
 */

(function() {
    'use strict';

    // Configuration and Constants
    const CONFIG = {
        BOT_API_BASE: 'https://brother-owl-bot.replit.app/api/skyview',
        CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours
        VERSION: '2.0.0',
        STORAGE_PREFIX: 'brotherOwlSkyview_',
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    };

    // Storage helpers
    const Storage = {
        get: (key) => GM_getValue(CONFIG.STORAGE_PREFIX + key),
        set: (key, value) => GM_setValue(CONFIG.STORAGE_PREFIX + key, value),
        getBool: (key, defaultValue = false) => {
            const value = Storage.get(key);
            return value !== undefined ? value === 'true' : defaultValue;
        },
        getJSON: (key, defaultValue = null) => {
            try {
                const value = Storage.get(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.error('[Brother Owl] JSON parse error:', e);
                return defaultValue;
            }
        },
        setJSON: (key, value) => Storage.set(key, JSON.stringify(value))
    };

    // CSS Styles with theme support
    GM_addStyle(`
        /* Theme variables */
        :root {
            --bo-bg-color: #f0f0f0;
            --bo-alt-bg-color: #fff;
            --bo-border-color: #ccc;
            --bo-input-color: #ccc;
            --bo-text-color: #000;
            --bo-hover-color: #ddd;
            --bo-accent-color: #4CAF50;
            --bo-error-color: #f44336;
            --bo-warning-color: #ff9800;
            --bo-glow-color: #ffb6c1;
        }

        body.dark-mode {
            --bo-bg-color: #333;
            --bo-alt-bg-color: #383838;
            --bo-border-color: #444;
            --bo-input-color: #504f4f;
            --bo-text-color: #ccc;
            --bo-hover-color: #555;
        }

        /* Brother Owl Components */
        .bo-stats-table {
            border-collapse: collapse;
            width: 100%;
            background-color: var(--bo-bg-color);
            color: var(--bo-text-color);
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 5px 0;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .bo-stats-table th,
        .bo-stats-table td {
            padding: 6px 8px;
            border: 1px solid var(--bo-border-color);
            text-align: center;
            color: var(--bo-text-color);
        }

        .bo-stats-table th {
            background-color: var(--bo-accent-color);
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 11px;
        }

        .bo-stats-badge {
            display: inline-block;
            padding: 3px 6px;
            background-color: var(--bo-bg-color);
            border: 1px solid var(--bo-border-color);
            border-radius: 4px;
            color: var(--bo-text-color);
            font-size: 11px;
            font-weight: bold;
            margin-left: 5px;
            cursor: help;
            transition: all 0.3s ease;
        }

        .bo-stats-badge:hover {
            background-color: var(--bo-hover-color);
            transform: scale(1.05);
        }

        .bo-config-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background-color: var(--bo-alt-bg-color);
            border: 2px solid var(--bo-border-color);
            border-radius: 8px;
            padding: 15px;
            z-index: 10000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            color: var(--bo-text-color);
        }

        .bo-config-input {
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            border: 1px solid var(--bo-border-color);
            border-radius: 4px;
            background-color: var(--bo-input-color);
            color: var(--bo-text-color);
            font-size: 12px;
        }

        .bo-button {
            padding: 6px 12px;
            background-color: var(--bo-accent-color);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            transition: all 0.3s ease;
            margin: 2px;
        }

        .bo-button:hover {
            opacity: 0.8;
            transform: translateY(-1px);
        }

        .bo-button.error {
            background-color: var(--bo-error-color);
        }

        .bo-button.warning {
            background-color: var(--bo-warning-color);
        }

        .bo-loader {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--bo-border-color);
            border-radius: 50%;
            border-top-color: var(--bo-accent-color);
            animation: bo-spin 1s linear infinite;
            margin-right: 5px;
        }

        @keyframes bo-spin {
            to { transform: rotate(360deg); }
        }

        .bo-tooltip {
            position: relative;
            cursor: help;
        }

        .bo-tooltip::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0,0,0,0.9);
            color: white;
            padding: 6px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 1000;
        }

        .bo-tooltip:hover::after {
            opacity: 1;
            visibility: visible;
        }

        .bo-glow {
            animation: bo-glow 1.5s infinite alternate;
        }

        @keyframes bo-glow {
            0% { border-color: var(--bo-border-color); }
            100% { border-color: var(--bo-glow-color); box-shadow: 0 0 8px var(--bo-glow-color); }
        }

        /* Confidence level colors */
        .bo-confidence-high { border-left: 4px solid #4CAF50; }
        .bo-confidence-medium { border-left: 4px solid #ff9800; }
        .bo-confidence-low { border-left: 4px solid #f44336; }
    `);

    // Utility Functions
    const Utils = {
        formatNumber: (num, decimals = 0) => {
            if (!num) return '0';
            const k = 1000;
            const sizes = ['', 'K', 'M', 'B', 'T'];
            const i = Math.floor(Math.log(Math.abs(num)) / Math.log(k));
            return (num / Math.pow(k, i)).toFixed(decimals) + sizes[i];
        },

        formatDate: (timestamp) => {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return 'Just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
            return Math.floor(diff / 86400000) + 'd ago';
        },

        getPlayerId: () => {
            const match = window.location.href.match(/XID=(\d+)/);
            return match ? match[1] : null;
        },

        getCurrentUserId: () => {
            // Extract from user menu or profile link
            const userLink = document.querySelector('.settings-menu > .link > a');
            if (userLink) {
                const match = userLink.href.match(/XID=(\d+)/);
                return match ? match[1] : null;
            }
            return null;
        },

        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    // Authentication Manager
    class AuthManager {
        constructor() {
            this.discordId = Storage.get('discordId') || '';
            this.apiKey = Storage.get('apiKey') || '';
            this.isAuthenticated = false;
            this.lastAuthCheck = 0;
        }

        async verifyCredentials() {
            if (!this.discordId || !this.apiKey) {
                throw new Error('Discord ID and API Key are required');
            }

            try {
                const response = await this.makeRequest('/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        action: 'verify',
                        discordId: this.discordId,
                        apiKey: this.apiKey
                    })
                });

                if (response.success) {
                    this.isAuthenticated = true;
                    this.lastAuthCheck = Date.now();
                    Storage.set('discordId', this.discordId);
                    Storage.set('apiKey', this.apiKey);
                    return true;
                } else {
                    throw new Error(response.error || 'Authentication failed');
                }
            } catch (error) {
                console.error('[Brother Owl] Auth error:', error);
                this.isAuthenticated = false;
                throw error;
            }
        }

        async makeRequest(endpoint, options = {}) {
            return new Promise((resolve, reject) => {
                GM.xmlHttpRequest({
                    method: options.method || 'GET',
                    url: CONFIG.BOT_API_BASE + endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    data: options.data,
                    timeout: 15000,
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Request timeout'))
                });
            });
        }

        setCredentials(discordId, apiKey) {
            this.discordId = discordId;
            this.apiKey = apiKey;
        }
    }

    // Data Manager with caching
    class DataManager {
        constructor(authManager) {
            this.auth = authManager;
            this.cache = new Map();
        }

        getCacheKey(type, id) {
            return `${type}_${id}`;
        }

        isCacheValid(cacheEntry) {
            return cacheEntry && (Date.now() - cacheEntry.timestamp) < CONFIG.CACHE_DURATION;
        }

        async fetchBattleStats(playerId) {
            const cacheKey = this.getCacheKey('stats', playerId);
            const cached = Storage.getJSON(cacheKey);
            
            if (this.isCacheValid(cached)) {
                return cached.data;
            }

            if (!this.auth.isAuthenticated) {
                await this.auth.verifyCredentials();
            }

            try {
                const response = await this.auth.makeRequest('/data', {
                    method: 'POST',
                    data: JSON.stringify({
                        discordId: this.auth.discordId,
                        apiKey: this.auth.apiKey,
                        type: 'profile',
                        playerId: playerId,
                        timestamp: Date.now()
                    })
                });

                if (response.success) {
                    const cacheEntry = {
                        data: response,
                        timestamp: Date.now()
                    };
                    Storage.setJSON(cacheKey, cacheEntry);
                    return response;
                } else {
                    throw new Error(response.error || 'Failed to fetch battle stats');
                }
            } catch (error) {
                console.error('[Brother Owl] Data fetch error:', error);
                // Return cached data if available, even if expired
                return cached ? cached.data : null;
            }
        }

        async submitData(type, data) {
            if (!this.auth.isAuthenticated) {
                await this.auth.verifyCredentials();
            }

            return this.auth.makeRequest('/data', {
                method: 'POST',
                data: JSON.stringify({
                    discordId: this.auth.discordId,
                    apiKey: this.auth.apiKey,
                    type: type,
                    ...data,
                    timestamp: Date.now()
                })
            });
        }
    }

    // UI Manager
    class UIManager {
        constructor(dataManager) {
            this.dataManager = dataManager;
            this.configPanel = null;
        }

        createStatsTable(statsData) {
            const { estimatedStats, confidence } = statsData;
            
            const table = document.createElement('table');
            table.className = `bo-stats-table bo-confidence-${confidence}`;
            
            const confidenceText = confidence === 'high' ? 'High' : confidence === 'medium' ? 'Med' : 'Low';
            const confidenceColor = confidence === 'high' ? '#4CAF50' : confidence === 'medium' ? '#ff9800' : '#f44336';
            
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Battle Stats</th>
                        <th>Confidence</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="bo-tooltip" data-tooltip="Brother Owl Intelligence">
                            ${Utils.formatNumber(estimatedStats.estimated, 1)}
                        </td>
                        <td style="color: ${confidenceColor}; font-weight: bold;">
                            ${confidenceText}
                        </td>
                        <td class="bo-tooltip" data-tooltip="Last intelligence update">
                            ${Utils.formatDate(Date.now())}
                        </td>
                    </tr>
                </tbody>
            `;

            return table;
        }

        createStatsBadge(statsData) {
            const { estimatedStats, confidence } = statsData;
            
            const badge = document.createElement('span');
            badge.className = `bo-stats-badge bo-confidence-${confidence} bo-tooltip`;
            badge.textContent = `${Utils.formatNumber(estimatedStats.estimated, 1)} BS`;
            badge.setAttribute('data-tooltip', `Brother Owl Intelligence\\nConfidence: ${confidence}\\nSource: ${estimatedStats.source}`);
            
            return badge;
        }

        createConfigPanel() {
            if (this.configPanel) {
                this.configPanel.remove();
            }

            const panel = document.createElement('div');
            panel.className = 'bo-config-panel';
            panel.innerHTML = `
                <h3 style="margin-top: 0; color: var(--bo-accent-color);">Brother Owl Skyview</h3>
                <div style="margin-bottom: 10px;">
                    <label>Discord ID:</label>
                    <input type="text" class="bo-config-input" id="bo-discord-id" 
                           placeholder="Your Discord ID" value="${Storage.get('discordId') || ''}">
                </div>
                <div style="margin-bottom: 10px;">
                    <label>API Key:</label>
                    <input type="password" class="bo-config-input" id="bo-api-key" 
                           placeholder="Your Brother Owl API Key" value="${Storage.get('apiKey') || ''}">
                </div>
                <div style="margin-bottom: 10px;">
                    <button class="bo-button" id="bo-verify">Verify Credentials</button>
                    <button class="bo-button" id="bo-close">Close</button>
                </div>
                <div style="font-size: 11px; color: var(--bo-text-color); opacity: 0.7;">
                    Get your API key with <code>/apikey set</code> in Brother Owl Discord bot
                </div>
            `;

            document.body.appendChild(panel);
            this.configPanel = panel;

            // Event listeners
            document.getElementById('bo-verify').addEventListener('click', () => this.handleVerify());
            document.getElementById('bo-close').addEventListener('click', () => panel.remove());
            
            return panel;
        }

        async handleVerify() {
            const discordId = document.getElementById('bo-discord-id').value.trim();
            const apiKey = document.getElementById('bo-api-key').value.trim();
            const verifyBtn = document.getElementById('bo-verify');

            if (!discordId || !apiKey) {
                this.showError('Please enter both Discord ID and API Key');
                return;
            }

            verifyBtn.innerHTML = '<span class="bo-loader"></span>Verifying...';
            verifyBtn.disabled = true;

            try {
                skyview.auth.setCredentials(discordId, apiKey);
                await skyview.auth.verifyCredentials();
                
                verifyBtn.innerHTML = '✓ Verified!';
                verifyBtn.className = 'bo-button';
                
                setTimeout(() => {
                    this.configPanel.remove();
                    skyview.initializePages();
                }, 1500);
                
            } catch (error) {
                this.showError('Authentication failed: ' + error.message);
                verifyBtn.innerHTML = 'Verify Credentials';
                verifyBtn.disabled = false;
                verifyBtn.className = 'bo-button error';
            }
        }

        showError(message) {
            console.error('[Brother Owl]', message);
            // Could implement toast notifications here
        }

        addConfigButton() {
            // Add configuration button to Torn's interface
            const navbar = document.querySelector('.header-wrapper .links-wrapper') || 
                          document.querySelector('.nav-bar');
            
            if (navbar) {
                const configBtn = document.createElement('a');
                configBtn.href = '#';
                configBtn.innerHTML = '🦉 Skyview';
                configBtn.style.cssText = `
                    margin-left: 10px; 
                    color: var(--bo-accent-color) !important; 
                    font-weight: bold;
                    text-decoration: none;
                `;
                configBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.createConfigPanel();
                });
                
                navbar.appendChild(configBtn);
            }
        }
    }

    // Page Handlers
    class PageHandlers {
        constructor(dataManager, uiManager) {
            this.dataManager = dataManager;
            this.uiManager = uiManager;
        }

        async handleProfilePage() {
            const playerId = Utils.getPlayerId();
            if (!playerId) return;

            try {
                const profileContainer = await this.waitForElement('.profile-container', 10000);
                if (!profileContainer) return;

                const statsData = await this.dataManager.fetchBattleStats(playerId);
                if (statsData) {
                    const statsTable = this.uiManager.createStatsTable(statsData);
                    profileContainer.appendChild(statsTable);
                }

            } catch (error) {
                console.error('[Brother Owl] Profile page error:', error);
            }
        }

        async handleFactionPage() {
            const memberLinks = document.querySelectorAll('a[href*="profiles.php?XID="]');
            
            for (const link of memberLinks) {
                const playerId = link.href.match(/XID=(\d+)/)?.[1];
                if (!playerId) continue;

                try {
                    const statsData = await this.dataManager.fetchBattleStats(playerId);
                    if (statsData) {
                        const badge = this.uiManager.createStatsBadge(statsData);
                        link.parentNode.appendChild(badge);
                    }
                } catch (error) {
                    console.error(`[Brother Owl] Error loading stats for ${playerId}:`, error);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        async handleAttackPage() {
            const playerId = Utils.getPlayerId();
            if (!playerId) return;

            try {
                const attackContainer = await this.waitForElement('.attack-container', 5000);
                if (!attackContainer) return;

                const statsData = await this.dataManager.fetchBattleStats(playerId);
                if (statsData) {
                    const badge = this.uiManager.createStatsBadge(statsData);
                    attackContainer.insertBefore(badge, attackContainer.firstChild);
                }

            } catch (error) {
                console.error('[Brother Owl] Attack page error:', error);
            }
        }

        async waitForElement(selector, timeout = 5000) {
            return new Promise((resolve) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                const observer = new MutationObserver(() => {
                    const element = document.querySelector(selector);
                    if (element) {
                        observer.disconnect();
                        resolve(element);
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
    }

    // Main Skyview Class
    class BrotherOwlSkyview {
        constructor() {
            this.auth = new AuthManager();
            this.dataManager = new DataManager(this.auth);
            this.uiManager = new UIManager(this.dataManager);
            this.pageHandlers = new PageHandlers(this.dataManager, this.uiManager);
            this.isInitialized = false;
        }

        async initialize() {
            if (this.isInitialized) return;

            console.log('[Brother Owl] Skyview initializing...');
            
            // Add config button to UI
            this.uiManager.addConfigButton();

            // Check if authenticated
            if (this.auth.discordId && this.auth.apiKey) {
                try {
                    await this.auth.verifyCredentials();
                    await this.initializePages();
                } catch (error) {
                    console.log('[Brother Owl] Auto-auth failed, manual configuration required');
                    this.uiManager.createConfigPanel();
                }
            } else {
                console.log('[Brother Owl] Configuration required');
                this.uiManager.createConfigPanel();
            }

            this.isInitialized = true;
        }

        async initializePages() {
            const url = window.location.href;
            
            try {
                if (url.includes('profiles.php')) {
                    await this.pageHandlers.handleProfilePage();
                } else if (url.includes('factions.php')) {
                    await this.pageHandlers.handleFactionPage();
                } else if (url.includes('loader.php?sid=attack')) {
                    await this.pageHandlers.handleAttackPage();
                }
            } catch (error) {
                console.error('[Brother Owl] Page initialization error:', error);
            }
        }
    }

    // Initialize when DOM is ready
    const skyview = new BrotherOwlSkyview();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => skyview.initialize());
    } else {
        skyview.initialize();
    }

    // Handle page navigation (for SPA-like behavior)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(() => skyview.initializePages(), 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    // Export for debugging
    window.BrotherOwlSkyview = skyview;

})();