// ==UserScript==
// @name         BOS
// @namespace    Brother Owl's Skyview
// @version      3.2.1
// @author       Homiewrecker
// @description  Advanced battle intelligence and stat estimation for Torn PDA
// @icon         🦉
// @match        https://www.torn.com/profiles.php?*
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/loader.php?sid=attack&user2ID=*
// @match        https://www.torn.com/hospitalview.php*
// @match        https://www.torn.com/bazaar.php*
// @match        https://www.torn.com/item.php*
// @connect      *.replit.app
// @connect      *.replit.dev
// @connect      *.repl.co
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// @downloadURL  https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// @supportURL   https://github.com/HomieWrecker/Skyview/issues
// @homepageURL  https://github.com/HomieWrecker/Skyview
// ==/UserScript==

(function() {
    'use strict';
    
    const CONFIG = {
        // Support multiple potential endpoints for maximum compatibility
        botEndpoints: [
            'https://${botDomain}/api/skyview-auth',
            'https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev/api/skyview-auth',
            'https://brother-owl-24-7-bot.homiewrecker.replit.app/api/skyview-auth'
        ],
        dataEndpoints: [
            'https://${botDomain}/api/skyview-data',
            'https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev/api/skyview-data',
            'https://brother-owl-24-7-bot.homiewrecker.replit.app/api/skyview-data'
        ],
        debug: true
    };
    
    class SkyviewDataCollector {
        constructor() {
            this.apiKey = GM_getValue('skyview_api_key', '');
            this.isAuthenticated = false;
            this.cache = new Map();
            this.cacheExpiry = new Map();
            this.rateLimitDelay = 1000;
            this.lastRequestTime = 0;
            
            this.init();
        }
        
        async init() {
            this.log('🦉 Brother Owl Skyview v3.2.1 - Initializing...');
            this.addStyles();
            this.setupUI();
            
            // Auto-authenticate if API key exists
            if (this.apiKey) {
                await this.authenticate();
            }
            
            // Set up page-specific collectors
            this.setupPageCollectors();
        }
        
        addStyles() {
            const styles = `
                .skyview-indicator {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    z-index: 10000;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 2px solid rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                }
                
                .skyview-indicator:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                }
                
                .skyview-indicator.authenticated {
                    background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%);
                }
                
                .skyview-indicator.error {
                    background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
                }
                
                .skyview-stats-display {
                    display: inline-block;
                    margin-left: 10px;
                    padding: 4px 8px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                    font-size: 11px;
                    border: 1px solid rgba(255,255,255,0.3);
                }
                
                .skyview-fair-fight {
                    color: #4CAF50;
                    font-weight: bold;
                }
                
                .skyview-unfair-fight {
                    color: #f44336;
                    font-weight: bold;
                }
                
                @media (prefers-color-scheme: dark) {
                    .skyview-indicator {
                        background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                    }
                }
            `;
            
            GM_addStyle(styles);
        }
        
        setupUI() {
            // Create status indicator
            this.indicator = document.createElement('div');
            this.indicator.className = 'skyview-indicator';
            this.indicator.textContent = '🦉 Connecting...';
            this.indicator.onclick = () => this.showAuthDialog();
            document.body.appendChild(this.indicator);
        }
        
        showAuthDialog() {
            const apiKey = prompt('Enter your Torn API key for Brother Owl Skyview integration:');
            if (apiKey && apiKey.trim()) {
                this.apiKey = apiKey.trim();
                GM_setValue('skyview_api_key', this.apiKey);
                this.authenticate();
            }
        }
        
        async authenticate() {
            this.log('🔐 Authenticating with Brother Owl...');
            this.updateIndicator('🔐 Authenticating...');
            
            if (!this.apiKey) {
                this.logError('No API key provided');
                this.updateIndicator('❌ No API Key - Click to set');
                return false;
            }
            
            // Try each endpoint until one works
            for (const endpoint of CONFIG.botEndpoints) {
                try {
                    this.log(`🌐 Trying endpoint: ${endpoint}`);
                    
                    const success = await this.makeRequest(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data: JSON.stringify({
                            action: 'verify-api-key',
                            apiKey: this.apiKey,
                            userscriptVersion: '3.2.1'
                        })
                    });
                    
                    if (success && success.success) {
                        this.isAuthenticated = true;
                        this.currentEndpoint = endpoint.replace('/api/skyview-auth', '');
                        this.updateIndicator(`✅ ${success.username || 'Connected'}`);
                        this.log(`✅ Authentication successful via ${endpoint}`);
                        return true;
                    }
                } catch (error) {
                    this.log(`❌ Failed to authenticate via ${endpoint}: ${error.message}`);
                    continue;
                }
            }
            
            // All endpoints failed
            this.logError('Authentication failed on all endpoints');
            this.updateIndicator('❌ Auth Failed - Click to retry');
            return false;
        }
        
        async makeRequest(url, options = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: url,
                    headers: options.headers || {},
                    data: options.data || null,
                    timeout: 10000,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error(`Request failed: ${error.statusText || 'Unknown error'}`));
                    },
                    ontimeout: function() {
                        reject(new Error('Request timeout'));
                    }
                });
            });
        }
        
        async collectAndSend(data) {
            if (!this.isAuthenticated) {
                this.log('⚠️ Not authenticated, skipping data collection');
                return;
            }
            
            // Rate limiting
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.rateLimitDelay) {
                await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
            }
            this.lastRequestTime = Date.now();
            
            // Try each data endpoint
            for (const endpoint of CONFIG.dataEndpoints) {
                try {
                    const response = await this.makeRequest(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data: JSON.stringify({
                            apiKey: this.apiKey,
                            data: data,
                            timestamp: Date.now(),
                            url: window.location.href
                        })
                    });
                    
                    if (response && response.success) {
                        this.log(`📊 Data sent successfully via ${endpoint}`);
                        return response;
                    }
                } catch (error) {
                    this.log(`❌ Failed to send data via ${endpoint}: ${error.message}`);
                    continue;
                }
            }
            
            this.logError('Failed to send data to all endpoints');
            return null;
        }
        
        setupPageCollectors() {
            const url = window.location.href;
            
            if (url.includes('profiles.php')) {
                this.collectProfileData();
            } else if (url.includes('factions.php')) {
                this.collectFactionData();
            } else if (url.includes('loader.php?sid=attack')) {
                this.collectAttackData();
            }
        }
        
        collectProfileData() {
            // Profile page data collection
            this.log('Collecting profile page data');
        }
        
        updateIndicator(text) {
            if (this.indicator) {
                this.indicator.textContent = text;
                
                // Update classes based on status
                this.indicator.className = 'skyview-indicator';
                if (text.includes('✅')) {
                    this.indicator.classList.add('authenticated');
                } else if (text.includes('❌')) {
                    this.indicator.classList.add('error');
                }
            }
        }
        
        log(message) {
            if (CONFIG.debug) {
                console.log('[🦉 Brother Owl Skyview]', message);
            }
        }
        
        logError(message, error) {
            console.error('[🦉 Brother Owl Skyview ERROR]', message, error);
            // Also show critical errors to user
            if (message.includes('Connection') || message.includes('Authentication')) {
                this.updateIndicator('❌ Error - Click for details');
            }
        }
        
        collectFactionData() {
            // Faction page data collection
            this.log('Collecting faction page data');
        }
        
        collectAttackData() {
            // Attack page data collection  
            this.log('Collecting attack page data');
        }
    }
    
    // Initialize Skyview system
    const skyview = new SkyviewDataCollector();
    
})();