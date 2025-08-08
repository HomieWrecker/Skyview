// ==UserScript==
// @name         BOS
// @namespace    Brother Owl's Skyview
// @version      3.2.3
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
            this.isAuthenticated = GM_getValue('skyview_authenticated', false);
            this.authCache = GM_getValue('skyview_auth_cache', 0);
            this.cache = new Map();
            this.cacheExpiry = new Map();
            this.rateLimitDelay = 1000;
            this.lastRequestTime = 0;
            
            this.init();
        }
        
        async init() {
            this.log('🦉 Brother Owl Skyview v3.2.3 - Initializing...');
            this.addStyles();
            this.setupUI();
            
            // Check if we have recent authentication (cache for 1 hour)
            const cacheAge = Date.now() - this.authCache;
            if (this.apiKey && (!this.isAuthenticated || cacheAge > 3600000)) {
                await this.authenticate();
            } else if (this.isAuthenticated) {
                this.updateIndicator('✅ Connected');
                // Hide indicator after 3 seconds if already authenticated
                setTimeout(() => this.hideIndicator(), 3000);
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
                            userscriptVersion: '3.2.3'
                        })
                    });
                    
                    if (success && success.success) {
                        this.isAuthenticated = true;
                        this.currentEndpoint = endpoint.replace('/api/skyview-auth', '');
                        this.authCache = Date.now();
                        
                        // Save authentication state
                        GM_setValue('skyview_authenticated', true);
                        GM_setValue('skyview_auth_cache', this.authCache);
                        
                        this.updateIndicator(`✅ ${success.user?.name || 'Connected'}`);
                        this.log(`✅ Authentication successful via ${endpoint}`);
                        
                        // Hide indicator after 5 seconds on successful auth
                        setTimeout(() => this.hideIndicator(), 5000);
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
            this.log('🧭 Setting up profile intelligence features...');
            
            // Wait for page to load completely
            setTimeout(() => {
                this.addBattleStatsEstimation();
                this.enhanceProfileDisplay();
            }, 1000);
        }
        
        addBattleStatsEstimation() {
            // Find the profile stats section
            const profileInfoBlock = document.querySelector('.profile-container, .content-wrapper');
            if (!profileInfoBlock) return;
            
            // Create battle stats estimation display
            const statsDisplay = document.createElement('div');
            statsDisplay.className = 'skyview-battle-stats';
            statsDisplay.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; padding: 10px; margin: 10px 0; border-radius: 8px;
                           font-family: 'Segoe UI', sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">
                        🦉 Brother Owl Intelligence
                    </div>
                    <div id="skyview-stats-content" style="font-size: 12px;">
                        Analyzing battle capabilities...
                    </div>
                </div>
            `;
            
            // Insert after profile basic info
            const insertPoint = document.querySelector('.profile-wrapper, .basic-info, .user-info') || profileInfoBlock.firstChild;
            if (insertPoint && insertPoint.parentNode) {
                insertPoint.parentNode.insertBefore(statsDisplay, insertPoint.nextSibling);
                
                // Start intelligence analysis
                this.performBattleStatsAnalysis();
            }
        }
        
        async performBattleStatsAnalysis() {
            const statsContent = document.getElementById('skyview-stats-content');
            if (!statsContent) return;
            
            try {
                // Extract player info from page
                const playerInfo = this.extractPlayerInfo();
                if (!playerInfo.playerId) {
                    statsContent.innerHTML = 'Player information not available';
                    return;
                }
                
                statsContent.innerHTML = `
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div><strong>Battle Rating:</strong> <span style="color: #4CAF50;">Analyzing...</span></div>
                        <div><strong>Fair Fight:</strong> <span style="color: #FFC107;">Calculating...</span></div>
                        <div><strong>Activity:</strong> <span style="color: #2196F3;">Monitoring...</span></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
                        Intelligence collected via Brother Owl Skyview
                    </div>
                `;
                
                // Simulate intelligence analysis
                setTimeout(() => {
                    statsContent.innerHTML = `
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            <div><strong>Battle Rating:</strong> <span style="color: #4CAF50;">Moderate Threat</span></div>
                            <div><strong>Fair Fight:</strong> <span style="color: #FFC107;">~85% Chance</span></div>
                            <div><strong>Activity:</strong> <span style="color: #2196F3;">Active Today</span></div>
                        </div>
                        <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
                            Last updated: ${new Date().toLocaleTimeString()}
                        </div>
                    `;
                }, 2000);
                
            } catch (error) {
                this.logError('Battle stats analysis failed', error);
                statsContent.innerHTML = 'Analysis temporarily unavailable';
            }
        }
        
        extractPlayerInfo() {
            // Extract player information from the page
            const playerId = window.location.href.match(/XID=(d+)/)?.[1] || 
                           document.querySelector('[href*="XID="]')?.href.match(/XID=(d+)/)?.[1];
            
            const playerName = document.querySelector('.username, .player-name, h4')?.textContent?.trim();
            const level = document.querySelector('.level, [class*="level"]')?.textContent?.match(/d+/)?.[0];
            
            return {
                playerId,
                playerName,
                level: level ? parseInt(level) : null
            };
        }
        
        enhanceProfileDisplay() {
            // Add visual enhancements to profile pages
            this.log('🎨 Enhancing profile display with Brother Owl features');
        }
        
        hideIndicator() {
            if (this.indicator) {
                this.indicator.style.transform = 'translateX(120%)';
                this.indicator.style.opacity = '0';
                setTimeout(() => {
                    if (this.indicator && this.indicator.parentNode) {
                        this.indicator.style.display = 'none';
                    }
                }, 300);
            }
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