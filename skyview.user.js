// ==UserScript==
// @name         Brother Owl Skyview - Intelligence System
// @namespace    BrotherOwl
// @version      3.1
// @author       Grand Code [48572]
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
            'https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev/api/skyview-auth',
            'https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev/api/skyview-auth',
            'https://brother-owl-24-7-bot.homiewrecker.replit.app/api/skyview-auth'
        ],
        dataEndpoints: [
            'https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev/api/skyview-data',
            'https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev/api/skyview-data',
            'https://brother-owl-24-7-bot.homiewrecker.replit.app/api/skyview-data'
        ],
        debug: true
    };
    
    class SkyviewDataCollector {
        constructor() {
            this.collectedData = {};
            this.authenticated = false;
            this.init();
        }
        
        async init() {
            this.addStyles();
            this.createIndicator();
            await this.authenticate();
            if (this.authenticated) {
                this.startCollection();
            }
        }
        
        addStyles() {
            GM_addStyle(`
                .skyview-indicator {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: linear-gradient(45deg, #4A90E2, #357ABD);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 10000;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .skyview-indicator:hover {
                    transform: scale(1.05);
                }
                .skyview-battle-stats {
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: #e94560;
                    border: 1px solid #0f3460;
                    border-radius: 8px;
                    padding: 8px 12px;
                    margin: 5px 0;
                    font-size: 11px;
                    font-weight: bold;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: inline-block;
                    min-width: 200px;
                }
            `);
        }
        
        createIndicator() {
            const indicator = document.createElement('div');
            indicator.className = 'skyview-indicator';
            indicator.textContent = '🔮 Skyview';
            indicator.title = 'Brother Owl Intelligence Collection';
            document.body.appendChild(indicator);
            
            indicator.addEventListener('click', () => {
                this.showStatus();
            });
        }
        
        async authenticate() {
            this.updateIndicator('🔗 Connecting...');
            
            let apiKey = GM_getValue('brotherOwl_apiKey');
            
            if (!apiKey) {
                apiKey = this.promptForApiKey();
                if (!apiKey) {
                    this.updateIndicator('❌ Setup required');
                    return;
                }
            }
            
            this.apiKey = apiKey;
            console.log('[Skyview] Starting authentication with', CONFIG.botEndpoints.length, 'endpoints');
            
            let lastError = null;
            
            // Try each endpoint until one works
            for (let i = 0; i < CONFIG.botEndpoints.length; i++) {
                const endpoint = CONFIG.botEndpoints[i];
                this.log(`Trying endpoint ${i + 1}/${CONFIG.botEndpoints.length}: ${endpoint}`);
                this.updateIndicator(`🔗 Testing ${i + 1}/${CONFIG.botEndpoints.length}`);
                
                try {
                    const response = await this.makeRequest(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        data: JSON.stringify({
                            action: 'verify-api-key',
                            apiKey: apiKey
                        })
                    });
                    
                    console.log(`[Skyview] Endpoint ${i + 1} response:`, response);
                    
                    if (response && response.success) {
                        this.authenticated = true;
                        this.workingEndpoint = i; // Remember which endpoint works
                        this.updateIndicator('✅ Connected');
                        this.log(`Authentication successful with endpoint ${i + 1}!`);
                        console.log(`[Skyview] ✅ Successfully authenticated with endpoint ${i + 1}`);
                        return;
                    } else {
                        const errorMsg = response?.error || 'Unknown error';
                        this.log(`Endpoint ${i + 1} auth failed: ${errorMsg}`);
                        lastError = errorMsg;
                        
                        // If API key not registered, don't try other endpoints
                        if (errorMsg.includes('not registered')) {
                            console.log('[Skyview] API key not registered, stopping endpoint tests');
                            break;
                        }
                    }
                    
                } catch (error) {
                    const errorMsg = error.message || error.toString();
                    this.logError(`Endpoint ${i + 1} connection failed:`, error);
                    lastError = errorMsg;
                    console.error(`[Skyview] Endpoint ${i + 1} failed:`, errorMsg);
                }
            }
            
            // If we get here, all endpoints failed
            this.updateIndicator('❌ Connection error');
            
            const errorDetails = lastError || 'Unknown error';
            console.error('[Skyview] All endpoints failed. Last error:', errorDetails);
            
            if (errorDetails.includes('not registered')) {
                this.log('❌ API key not registered with Brother Owl bot. Use /apikey set in Discord first.');
                alert('🦉 Brother Owl Setup Required\n\nYour API key is not registered with the bot.\n\n1. Go to Discord\n2. Use /apikey set [your-api-key]\n3. Refresh this page\n\nThen the userscript will connect properly.');
            } else {
                this.log('❌ Connection failed: ' + errorDetails);
                alert(`🦉 Brother Owl Connection Failed\n\nError: ${errorDetails}\n\n1. Check your internet connection\n2. Verify bot is online\n3. Try refreshing the page\n\nClick the 🦉 indicator for more details.`);
            }
            
            GM_setValue('brotherOwl_apiKey', null); // Clear potentially invalid key
        }
        
        promptForApiKey() {
            const apiKey = prompt('Brother Owl Setup (Simplified!)\n\nEnter your Torn API key\n(must be registered with Brother Owl bot using /apikey set)\n\nNo Discord ID needed - automatic recognition!');
            if (!apiKey) return null;
            
            GM_setValue('brotherOwl_apiKey', apiKey);
            return apiKey;
        }
        
        startCollection() {
            const url = window.location.href;
            
            if (url.includes('profiles.php')) {
                this.collectProfileData();
            } else if (url.includes('factions.php')) {
                this.collectFactionData();
            } else if (url.includes('loader.php?sid=attack')) {
                this.collectAttackData();
            }
        }
        
        async collectProfileData() {
            this.updateIndicator('📊 Collecting...');
            
            try {
                const playerData = this.extractPlayerData();
                const battleStats = this.extractBattleStats();
                
                const data = {
                    type: 'profile',
                    timestamp: Date.now(),
                    url: window.location.href,
                    player: playerData,
                    stats: battleStats
                };
                
                const response = await this.sendData(data);
                if (response && response.estimatedStats) {
                    this.displayBattleStats(playerData, response.estimatedStats);
                }
                
            } catch (error) {
                this.logError('Error collecting profile data:', error);
            }
            
            this.updateIndicator('🔮 Skyview');
        }
        
        extractPlayerData() {
            const playerData = {};
            
            // Player ID from URL
            const urlMatch = window.location.href.match(/XID=(\d+)/);
            if (urlMatch) {
                playerData.id = parseInt(urlMatch[1]);
            }
            
            // Player name
            const nameElement = document.querySelector('.title-black');
            if (nameElement) {
                playerData.name = nameElement.textContent.trim();
            }
            
            // Level
            const levelText = document.body.textContent.match(/Level (\d+)/);
            if (levelText) {
                playerData.level = parseInt(levelText[1]);
            }
            
            return playerData;
        }
        
        extractBattleStats() {
            const stats = {};
            
            // Try to find battle stats section
            const statsText = document.body.textContent;
            
            const strengthMatch = statsText.match(/Strength[:\s]+([d,]+)/);
            if (strengthMatch) stats.strength = parseInt(strengthMatch[1].replace(/,/g, ''));
            
            const defenseMatch = statsText.match(/Defense[:\s]+([d,]+)/);
            if (defenseMatch) stats.defense = parseInt(defenseMatch[1].replace(/,/g, ''));
            
            const speedMatch = statsText.match(/Speed[:\s]+([d,]+)/);
            if (speedMatch) stats.speed = parseInt(speedMatch[1].replace(/,/g, ''));
            
            const dexterityMatch = statsText.match(/Dexterity[:\s]+([d,]+)/);
            if (dexterityMatch) stats.dexterity = parseInt(dexterityMatch[1].replace(/,/g, ''));
            
            return stats;
        }
        
        displayBattleStats(playerData, estimatedStats) {
            if (!playerData.id || !estimatedStats) return;
            
            const statsElement = document.createElement('div');
            statsElement.className = 'skyview-battle-stats';
            
            let statsText = '🦉 ';
            if (estimatedStats.strength) {
                const total = estimatedStats.strength + estimatedStats.defense + estimatedStats.speed + estimatedStats.dexterity;
                statsText += `Total: ${this.formatNumber(total)} | `;
                statsText += `STR: ${this.formatNumber(estimatedStats.strength)} | `;
                statsText += `DEF: ${this.formatNumber(estimatedStats.defense)} | `;
                statsText += `SPD: ${this.formatNumber(estimatedStats.speed)} | `;
                statsText += `DEX: ${this.formatNumber(estimatedStats.dexterity)}`;
            } else {
                statsText += 'Stats: Analyzing...';
            }
            
            statsElement.textContent = statsText;
            
            // Add stats beside player name
            const nameElement = document.querySelector('.title-black');
            if (nameElement && !nameElement.nextElementSibling?.classList.contains('skyview-battle-stats')) {
                nameElement.parentNode.insertBefore(statsElement, nameElement.nextSibling);
            }
            
            // Add to faction pages beside member names
            this.addStatsToFactionPage(playerData.id, statsElement.cloneNode(true));
        }
        
        addStatsToFactionPage(playerId, statsElement) {
            const memberLinks = document.querySelectorAll(`a[href*="XID=${playerId}"]`);
            memberLinks.forEach(link => {
                if (!link.nextElementSibling?.classList.contains('skyview-battle-stats')) {
                    link.parentNode.insertBefore(statsElement.cloneNode(true), link.nextSibling);
                }
            });
        }
        
        async sendData(data) {
            if (!this.authenticated || !this.apiKey) return null;
            
            try {
                const payload = {
                    ...data,
                    apiKey: this.apiKey
                };
                
                // Use the working endpoint from authentication
                const endpoint = CONFIG.dataEndpoints[this.workingEndpoint || 0];
                
                const response = await this.makeRequest(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify(payload)
                });
                
                if (response.success) {
                    this.log('Data sent successfully');
                    return response;
                } else {
                    this.logError('Failed to send data:', response.error);
                }
            } catch (error) {
                this.logError('Error sending data:', error);
            }
            
            return null;
        }
        
        makeRequest(url, options) {
            return new Promise((resolve, reject) => {
                this.log(`Making request to: ${url}`);
                
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: url,
                    headers: options.headers || {},
                    data: options.data,
                    timeout: 15000, // 15 second timeout
                    onload: function(response) {
                        try {
                            console.log(`[Skyview] Response status: ${response.status}, text: ${response.responseText.substring(0, 200)}`);
                            
                            if (response.status >= 200 && response.status < 300) {
                                const data = JSON.parse(response.responseText);
                                resolve(data);
                            } else {
                                reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                            }
                        } catch (e) {
                            console.error('[Skyview] JSON parse error:', e, 'Response:', response.responseText);
                            reject(new Error(`Failed to parse response: ${e.message}`));
                        }
                    },
                    onerror: function(error) {
                        console.error('[Skyview] Network error:', error);
                        reject(new Error(`Network error: ${error.error || 'Connection failed'}`));
                    },
                    ontimeout: function() {
                        console.error('[Skyview] Request timeout');
                        reject(new Error('Request timeout'));
                    }
                });
            });
        }
        
        formatNumber(num) {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        }
        
        updateIndicator(text) {
            const indicator = document.querySelector('.skyview-indicator');
            if (indicator) {
                indicator.textContent = text;
            }
        }
        
        showStatus() {
            const authStatus = this.authenticated ? '✅ Connected' : '❌ Not authenticated';
            const endpoint = this.workingEndpoint !== undefined ? 
                `Working endpoint: ${this.workingEndpoint + 1}/${CONFIG.botEndpoints.length}` : 
                'No working endpoint found';
            const apiKeyStatus = this.apiKey ? '✅ API key configured' : '❌ No API key';
            
            alert(`🦉 Brother Owl Skyview Status\n\n• Authentication: ${authStatus}\n• ${apiKeyStatus}\n• ${endpoint}\n• Page: ${window.location.pathname}\n• Collection: Active\n\nTo reconfigure: Clear browser data and refresh.\nFor support: Use Discord bot /skyview command.`);
        }
        
        log(message, data = null) {
            if (CONFIG.debug) {
                console.log('[🦉 Brother Owl Skyview]', message, data);
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