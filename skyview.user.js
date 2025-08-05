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

    // Configuration
    const CONFIG = {
        botEndpoint: 'https://brother-owl-24-7-bot.homiewrecker.repl.co/api/skyview-auth',
        dataEndpoint: 'https://brother-owl-24-7-bot.homiewrecker.repl.co/api/skyview-data',
        debug: true
    };

    // Enhanced CSS styles for modern appearance
    GM_addStyle(`
        .skyview-indicator {
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            border: 2px solid rgba(255,255,255,0.1);
        }
        
        .skyview-indicator:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        .skyview-battle-stats {
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            padding: 6px 10px;
            margin: 5px 0;
            border-radius: 15px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            border-left: 4px solid #f39c12;
        }

        .skyview-error {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 6px 10px;
            margin: 5px 0;
            border-radius: 15px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
            box-shadow: 0 2px 8px rgba(231,76,60,0.3);
        }

        .skyview-loading {
            background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
            color: white;
            padding: 6px 10px;
            margin: 5px 0;
            border-radius: 15px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            font-weight: 600;
            display: inline-block;
            box-shadow: 0 2px 8px rgba(243,156,18,0.3);
            animation: skyview-pulse 2s infinite;
        }

        @keyframes skyview-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        .skyview-config-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 10001;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-width: 400px;
            border: 2px solid #3498db;
        }

        .skyview-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
        }

        .skyview-input {
            width: 100%;
            padding: 12px;
            margin: 10px 0;
            border: 2px solid #bdc3c7;
            border-radius: 8px;
            font-size: 14px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            transition: border-color 0.3s ease;
        }

        .skyview-input:focus {
            border-color: #3498db;
            outline: none;
        }

        .skyview-button {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            margin: 5px;
            transition: all 0.3s ease;
        }

        .skyview-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(52,152,219,0.3);
        }

        .skyview-button.cancel {
            background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
        }
    `);

    class SkyviewIntelligence {
        constructor() {
            this.authenticated = false;
            this.credentials = null;
            this.indicator = null;
            this.cache = new Map();
            this.cacheExpiry = 12 * 60 * 60 * 1000; // 12 hours
            this.init();
        }

        async init() {
            this.log('Skyview Intelligence System v3.1 - Initializing...');
            this.createIndicator();
            await this.authenticate();
            
            if (this.authenticated) {
                this.setupPageMonitoring();
                this.collectPageData();
            } else {
                this.showConfigModal();
            }
        }

        createIndicator() {
            this.indicator = document.createElement('div');
            this.indicator.className = 'skyview-indicator';
            this.indicator.textContent = '🦉 Connecting...';
            this.indicator.addEventListener('click', () => this.showConfigModal());
            document.body.appendChild(this.indicator);
        }

        updateIndicator(text) {
            if (this.indicator) {
                this.indicator.textContent = text;
            }
        }

        async authenticate() {
            let credentials = GM_getValue('brotherOwl_credentials', null);
            
            if (!credentials) {
                return false;
            }
            
            try {
                const response = await this.makeRequest(CONFIG.botEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        action: 'verify',
                        discordId: credentials.discordId,
                        apiKey: credentials.apiKey
                    })
                });
                
                if (response.success) {
                    this.authenticated = true;
                    this.credentials = credentials;
                    this.log('Authentication successful');
                    this.updateIndicator('🦉 Skyview');
                    return true;
                } else {
                    this.logError('Authentication failed:', response.error);
                    GM_setValue('brotherOwl_credentials', null);
                    this.updateIndicator('❌ Auth Failed');
                    return false;
                }
            } catch (error) {
                this.logError('Authentication error:', error);
                this.updateIndicator('❌ Connection Error');
                return false;
            }
        }

        setupPageMonitoring() {
            // Monitor for dynamic content changes
            const observer = new MutationObserver(() => {
                setTimeout(() => this.collectPageData(), 1000);
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        collectPageData() {
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
            this.updateIndicator('📊 Analyzing...');
            
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
                    this.displayBattleStats(playerData, response.estimatedStats, response.fairFightInfo);
                }
                
            } catch (error) {
                this.logError('Error collecting profile data:', error);
            }
            
            this.updateIndicator('🦉 Skyview');
        }

        async collectFactionData() {
            try {
                const factionData = this.extractFactionData();
                const memberData = this.extractMemberData();
                
                const data = {
                    type: 'faction',
                    timestamp: Date.now(),
                    url: window.location.href,
                    faction: factionData,
                    members: memberData
                };
                
                await this.sendData(data);
                
            } catch (error) {
                this.logError('Error collecting faction data:', error);
            }
        }

        async collectAttackData() {
            try {
                const attackData = this.extractAttackData();
                
                const data = {
                    type: 'attack',
                    timestamp: Date.now(),
                    url: window.location.href,
                    attack: attackData
                };
                
                const response = await this.sendData(data);
                if (response && response.estimatedStats) {
                    this.displayAttackIntelligence(attackData, response.estimatedStats, response.fairFightInfo);
                }
                
            } catch (error) {
                this.logError('Error collecting attack data:', error);
            }
        }

        extractPlayerData() {
            const urlParams = new URLSearchParams(window.location.search);
            const playerId = urlParams.get('XID');
            
            const nameElement = document.querySelector('.title-black, .player-name, h4');
            const playerName = nameElement ? nameElement.textContent.trim() : 'Unknown';
            
            const levelElement = document.querySelector('.level, [class*="level"]');
            const level = levelElement ? parseInt(levelElement.textContent.match(/\d+/)?.[0]) || 0 : 0;
            
            return {
                id: playerId,
                name: playerName,
                level: level,
                url: window.location.href
            };
        }

        extractBattleStats() {
            const stats = {};
            const statsText = document.body.textContent;
            
            // Enhanced stat extraction patterns
            const patterns = {
                strength: /(?:Strength|STR)[:\s]+([\d,]+)/i,
                defense: /(?:Defense|Defence|DEF)[:\s]+([\d,]+)/i,
                speed: /(?:Speed|SPD)[:\s]+([\d,]+)/i,
                dexterity: /(?:Dexterity|DEX)[:\s]+([\d,]+)/i
            };
            
            for (const [stat, pattern] of Object.entries(patterns)) {
                const match = statsText.match(pattern);
                if (match) {
                    stats[stat] = parseInt(match[1].replace(/,/g, ''));
                }
            }
            
            return stats;
        }

        extractFactionData() {
            const factionName = document.querySelector('.faction-name, .title')?.textContent.trim();
            const factionId = new URLSearchParams(window.location.search).get('ID');
            
            return {
                id: factionId,
                name: factionName,
                url: window.location.href
            };
        }

        extractMemberData() {
            const members = [];
            const memberElements = document.querySelectorAll('a[href*="profiles.php?XID="]');
            
            memberElements.forEach(element => {
                const href = element.getAttribute('href');
                const idMatch = href.match(/XID=(\d+)/);
                if (idMatch) {
                    members.push({
                        id: idMatch[1],
                        name: element.textContent.trim(),
                        url: href
                    });
                }
            });
            
            return members;
        }

        extractAttackData() {
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('user2ID');
            
            const targetName = document.querySelector('.target-name, .player-name')?.textContent.trim();
            
            return {
                targetId: targetId,
                targetName: targetName,
                url: window.location.href
            };
        }

        displayBattleStats(playerData, estimatedStats, fairFightInfo) {
            if (!playerData.id || !estimatedStats) return;
            
            // Remove existing stats displays
            document.querySelectorAll('.skyview-battle-stats').forEach(el => el.remove());
            
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
                
                // Add fair fight indicator
                if (fairFightInfo && fairFightInfo.category) {
                    statsText += ` | ${this.getFairFightEmoji(fairFightInfo.category)} ${fairFightInfo.category}`;
                }
            } else {
                statsText += 'Stats: Analyzing...';
            }
            
            statsElement.textContent = statsText;
            
            // Add stats beside player name
            const nameElement = document.querySelector('.title-black, .player-name, h4');
            if (nameElement && !nameElement.nextElementSibling?.classList.contains('skyview-battle-stats')) {
                nameElement.parentNode.insertBefore(statsElement, nameElement.nextSibling);
            }
            
            // Add to faction pages beside member names
            this.addStatsToFactionPage(playerData.id, statsElement.cloneNode(true));
        }

        displayAttackIntelligence(attackData, estimatedStats, fairFightInfo) {
            if (!attackData.targetId || !estimatedStats) return;
            
            const intelligenceElement = document.createElement('div');
            intelligenceElement.className = 'skyview-battle-stats';
            
            const total = estimatedStats.strength + estimatedStats.defense + estimatedStats.speed + estimatedStats.dexterity;
            let intelligenceText = `🦉 Target Intelligence | Total: ${this.formatNumber(total)} | `;
            intelligenceText += `STR: ${this.formatNumber(estimatedStats.strength)} | `;
            intelligenceText += `DEF: ${this.formatNumber(estimatedStats.defense)} | `;
            intelligenceText += `SPD: ${this.formatNumber(estimatedStats.speed)} | `;
            intelligenceText += `DEX: ${this.formatNumber(estimatedStats.dexterity)}`;
            
            if (fairFightInfo) {
                intelligenceText += ` | ${this.getFairFightEmoji(fairFightInfo.category)} ${fairFightInfo.category}`;
            }
            
            intelligenceElement.textContent = intelligenceText;
            
            // Insert at top of attack page
            const attackContainer = document.querySelector('.content-wrapper, .main-content, body');
            if (attackContainer) {
                attackContainer.insertBefore(intelligenceElement, attackContainer.firstChild);
            }
        }

        addStatsToFactionPage(playerId, statsElement) {
            const memberLinks = document.querySelectorAll(`a[href*="XID=${playerId}"]`);
            memberLinks.forEach(link => {
                if (!link.nextElementSibling?.classList.contains('skyview-battle-stats')) {
                    link.parentNode.insertBefore(statsElement.cloneNode(true), link.nextSibling);
                }
            });
        }

        getFairFightEmoji(category) {
            const emojis = {
                'Easy': '🟢',
                'Fair': '🟡', 
                'Hard': '🟠',
                'Impossible': '🔴'
            };
            return emojis[category] || '⚪';
        }

        async sendData(data) {
            if (!this.authenticated || !this.credentials) return null;
            
            try {
                const payload = {
                    ...data,
                    discordId: this.credentials.discordId,
                    apiKey: this.credentials.apiKey
                };
                
                const response = await this.makeRequest(CONFIG.dataEndpoint, {
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
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: url,
                    headers: options.headers || {},
                    data: options.data,
                    timeout: 10000,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(e);
                        }
                    },
                    onerror: function(error) {
                        reject(error);
                    },
                    ontimeout: function() {
                        reject(new Error('Request timeout'));
                    }
                });
            });
        }

        showConfigModal() {
            // Remove existing modals
            document.querySelectorAll('.skyview-modal-overlay, .skyview-config-modal').forEach(el => el.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'skyview-modal-overlay';
            
            const modal = document.createElement('div');
            modal.className = 'skyview-config-modal';
            
            modal.innerHTML = `
                <h3 style="margin-top: 0; color: #2c3e50; font-size: 18px;">🦉 Brother Owl Skyview Authentication</h3>
                <p style="color: #7f8c8d; margin-bottom: 20px;">Enter your Torn API key to enable intelligent stat estimation and data collection.</p>
                
                <label style="display: block; color: #2c3e50; font-weight: 600; margin-bottom: 5px;">Torn API Key:</label>
                <input type="text" id="skyview-api-key" class="skyview-input" placeholder="Enter your Torn API key..." />
                
                <p style="color: #95a5a6; font-size: 12px; margin: 10px 0;">
                    📋 Your API key must be registered with Brother Owl bot using <code>/apikey set</code><br>
                    🔄 Your Discord account will be automatically identified
                </p>
                
                <div style="text-align: right; margin-top: 20px;">
                    <button class="skyview-button cancel" onclick="this.closest('.skyview-modal-overlay').remove()">Cancel</button>
                    <button class="skyview-button" id="skyview-save-config">Connect</button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Focus API key input
            setTimeout(() => {
                const apiKeyInput = document.getElementById('skyview-api-key');
                if (apiKeyInput) apiKeyInput.focus();
            }, 100);
            
            // Handle save button
            document.getElementById('skyview-save-config').addEventListener('click', async () => {
                const apiKey = document.getElementById('skyview-api-key').value.trim();
                
                if (!apiKey) {
                    alert('Please enter your Torn API key.');
                    return;
                }
                
                const credentials = {
                    apiKey: apiKey,
                    discordId: 'auto' // Will be resolved by the bot
                };
                
                GM_setValue('brotherOwl_credentials', credentials);
                overlay.remove();
                
                this.updateIndicator('🔄 Authenticating...');
                const success = await this.authenticate();
                
                if (success) {
                    this.setupPageMonitoring();
                    this.collectPageData();
                    GM_notification('🦉 Brother Owl Skyview activated successfully!', 'Skyview Intelligence');
                } else {
                    this.showConfigModal();
                }
            });
            
            // Handle enter key in API key input
            document.getElementById('skyview-api-key').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('skyview-save-config').click();
                }
            });
        }

        formatNumber(num) {
            if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        }

        log(message) {
            if (CONFIG.debug) {
                console.log('[Skyview]', message);
            }
        }

        logError(message, error) {
            if (CONFIG.debug) {
                console.error('[Skyview]', message, error);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new SkyviewIntelligence());
    } else {
        new SkyviewIntelligence();
    }

})();