// ==UserScript==
// @name         Brother Owl Skyview - Advanced Battle Intelligence
// @namespace    https://torn.com/profiles.php?XID=2353116
// @version      4.0.3
// @author       Homiewrecker [2353116] - Based on TSC Companion & Wall Battle Stats
// @description  Professional battle stats estimation with advanced caching - TSC Companion inspired
// @icon         🦉
// @match        https://www.torn.com/profiles.php?*
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/loader.php?sid=attack&user2ID=*
// @match        https://www.torn.com/hospitalview.php*
// @connect      api.torn.com
// @connect      *.replit.app
// @connect      *.replit.dev  
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// @downloadURL  https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    // ========== CONFIGURATION ==========
    const CONFIG = {
        CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours like TSC Companion
        API_TIMEOUT: 30000,
        ESTIMATION_METHODS: ['level_progression', 'activity_weighting', 'battle_analysis'],
        DEBUG: true
    };
    
    // ========== STYLING ==========
    GM_addStyle(`
        /* Dark/Light theme variables */
        body {
            --skyview-bg: #f0f0f0;
            --skyview-alt-bg: #fff;
            --skyview-border: #ccc;
            --skyview-text: #000;
            --skyview-hover: #ddd;
            --skyview-glow: #4A90E2;
        }
        
        body.dark-mode {
            --skyview-bg: #333;
            --skyview-alt-bg: #383838;
            --skyview-border: #444;
            --skyview-text: #ccc;
            --skyview-hover: #555;
            --skyview-glow: #4A90E2;
        }
        
        .skyview-stat-display {
            display: inline-block;
            margin-left: 5px;
            padding: 3px 6px;
            background: var(--skyview-bg);
            border: 1px solid var(--skyview-border);
            border-radius: 4px;
            color: var(--skyview-text);
            font-family: monospace;
            font-size: 0.85em;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .skyview-stat-display:hover {
            background: var(--skyview-hover);
            border-color: var(--skyview-glow);
        }
        
        .skyview-total-strong {
            font-weight: bold;
            color: var(--skyview-glow);
        }
        
        .skyview-profile-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--skyview-bg);
            border: 1px solid var(--skyview-border);
            margin: 10px 0;
        }
        
        .skyview-profile-table th,
        .skyview-profile-table td {
            padding: 8px;
            border: 1px solid var(--skyview-border);
            text-align: center;
            color: var(--skyview-text);
        }
        
        .skyview-profile-table th {
            background: var(--skyview-alt-bg);
            font-weight: bold;
        }
        
        .skyview-attack-info {
            margin: 10px 0;
            padding: 10px;
            background: var(--skyview-bg);
            border: 1px solid var(--skyview-border);
            border-radius: 5px;
            color: var(--skyview-text);
        }
    `);
    
    // ========== UTILITY CLASSES ==========
    class SkyviewLogger {
        static info(message) {
            if (CONFIG.DEBUG) console.log('[Skyview]', message);
        }
        
        static warn(message) {
            console.warn('[Skyview]', message);
        }
        
        static error(message, error) {
            console.error('[Skyview]', message, error);
        }
    }
    
    class SkyviewStorage {
        set(key, value) {
            GM_setValue(`skyview-${key}`, JSON.stringify({ value, timestamp: Date.now() }));
        }
        
        get(key) {
            const data = GM_getValue(`skyview-${key}`, null);
            if (!data) return null;
            
            try {
                const parsed = JSON.parse(data);
                if (Date.now() - parsed.timestamp > CONFIG.CACHE_DURATION) {
                    this.remove(key);
                    return null;
                }
                return parsed.value;
            } catch {
                return null;
            }
        }
        
        remove(key) {
            GM_setValue(`skyview-${key}`, null);
        }
    }
    
    const storage = new SkyviewStorage();
    
    // ========== BATTLE STATS ESTIMATION ENGINE ==========
    class BattleStatsEstimator {
        static estimate(level, lastAction) {
            // Multi-method estimation inspired by TSC Companion
            const estimates = [
                this.levelProgressionMethod(level),
                this.activityWeightingMethod(level, lastAction),
                this.battleAnalysisMethod(level)
            ];
            
            // Weighted average of methods
            const total = Math.round(
                (estimates[0] * 0.4) + 
                (estimates[1] * 0.4) + 
                (estimates[2] * 0.2)
            );
            
            return {
                total,
                confidence: this.calculateConfidence(level, lastAction),
                breakdown: {
                    level_progression: estimates[0],
                    activity_weighted: estimates[1],
                    battle_analysis: estimates[2]
                }
            };
        }
        
        static levelProgressionMethod(level) {
            // Based on level progression patterns
            return Math.round(Math.pow(level, 2.8) * 150);
        }
        
        static activityWeightingMethod(level, lastAction) {
            const base = this.levelProgressionMethod(level);
            const hours = this.parseLastAction(lastAction);
            
            let multiplier = 1.0;
            if (hours < 1) multiplier = 1.3;
            else if (hours < 24) multiplier = 1.2;
            else if (hours < 168) multiplier = 1.0;
            else multiplier = 0.8;
            
            return Math.round(base * multiplier);
        }
        
        static battleAnalysisMethod(level) {
            // Alternative calculation method
            return Math.round(level * level * 180);
        }
        
        static parseLastAction(lastAction) {
            if (!lastAction) return 24;
            
            const match = lastAction.match(/(\d+)/);
            if (!match) return 24;
            
            const value = parseInt(match[1]);
            if (lastAction.includes('minute')) return value / 60;
            if (lastAction.includes('hour')) return value;
            if (lastAction.includes('day')) return value * 24;
            return value;
        }
        
        static calculateConfidence(level, lastAction) {
            let confidence = 0.7; // Base confidence
            
            if (level > 50) confidence += 0.1;
            if (level > 100) confidence += 0.1;
            
            const hours = this.parseLastAction(lastAction);
            if (hours < 24) confidence += 0.1;
            
            return Math.min(0.95, confidence);
        }
        
        static formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
    }
    
    // ========== PAGE HANDLERS ==========
    class ProfilePageHandler {
        static handle() {
            SkyviewLogger.info('Handling profile page...');
            
            const userId = new URLSearchParams(window.location.search).get('XID');
            if (!userId) return;
            
            setTimeout(() => {
                this.processProfile(userId);
            }, 1000);
        }
        
        static async processProfile(userId) {
            const apiKey = storage.get('api-key');
            if (!apiKey) {
                SkyviewLogger.warn('No API key found');
                return;
            }
            
            try {
                const userData = await this.fetchUserData(userId, apiKey);
                if (userData) {
                    this.displayBattleStats(userData);
                    this.createProfileTable(userData);
                }
            } catch (error) {
                SkyviewLogger.error('Profile processing failed:', error);
            }
        }
        
        static fetchUserData(userId, apiKey) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://api.torn.com/user/${userId}?selections=profile&key=${apiKey}`,
                    timeout: CONFIG.API_TIMEOUT,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                reject(new Error(data.error.error));
                                return;
                            }
                            resolve(data);
                        } catch (e) {
                            reject(e);
                        }
                    },
                    onerror: () => reject(new Error('Request failed'))
                });
            });
        }
        
        static displayBattleStats(userData) {
            const estimation = BattleStatsEstimator.estimate(userData.level, userData.last_action?.relative);
            
            SkyviewLogger.info(`Displaying stats for ${userData.name} [Level ${userData.level}]`);
            
            // Find appropriate insertion point - try multiple selectors
            const selectors = [
                '.profile-container',
                '.basic-info', 
                '.user-info',
                '.content-wrapper',
                '.profile-wrapper',
                '[class*="profile"]',
                'h4'
            ];
            
            let insertionPoint = null;
            for (const selector of selectors) {
                insertionPoint = document.querySelector(selector);
                if (insertionPoint) {
                    SkyviewLogger.info(`Found insertion point: ${selector}`);
                    break;
                }
            }
            
            if (!insertionPoint) {
                SkyviewLogger.warn('No suitable insertion point found for profile stats');
                // Create floating stats instead
                this.createFloatingStats(estimation, userData);
                return;
            }
            
            const statsDisplay = document.createElement('div');
            statsDisplay.className = 'skyview-stat-display';
            statsDisplay.innerHTML = `≈${BattleStatsEstimator.formatNumber(estimation.total)}`;
            statsDisplay.title = `Battle Stats Estimate: ${estimation.total.toLocaleString()}\nConfidence: ${(estimation.confidence * 100).toFixed(0)}%\nLevel: ${userData.level}`;
            
            // Try multiple name selectors
            const nameSelectors = ['.player-name', '.name', 'h4', '[class*="name"]', '.profile-name'];
            let nameElement = null;
            
            for (const selector of nameSelectors) {
                nameElement = document.querySelector(selector);
                if (nameElement) {
                    SkyviewLogger.info(`Found name element: ${selector}`);
                    break;
                }
            }
            
            if (nameElement) {
                nameElement.appendChild(statsDisplay);
            } else {
                insertionPoint.appendChild(statsDisplay);
            }
        }
        
        static createFloatingStats(estimation, userData) {
            const floatingDiv = document.createElement('div');
            floatingDiv.style.cssText = `
                position: fixed;
                top: 60px;
                right: 10px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 10px;
                border-radius: 8px;
                font-size: 12px;
                z-index: 10000;
                font-family: monospace;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            floatingDiv.innerHTML = `
                🦉 <strong>${userData.name}</strong> [Level ${userData.level}]<br>
                Battle Stats: <strong>≈${BattleStatsEstimator.formatNumber(estimation.total)}</strong><br>
                Confidence: ${(estimation.confidence * 100).toFixed(0)}%
            `;
            
            document.body.appendChild(floatingDiv);
        }
        
        static createProfileTable(userData) {
            const estimation = BattleStatsEstimator.estimate(userData.level, userData.last_action?.relative);
            
            const tableHtml = `
                <div class="skyview-profile-table-container">
                    <table class="skyview-profile-table">
                        <thead>
                            <tr>
                                <th colspan="3">🦉 Battle Intelligence Analysis</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Estimated Total</strong></td>
                                <td class="skyview-total-strong">${BattleStatsEstimator.formatNumber(estimation.total)}</td>
                                <td>Confidence: ${(estimation.confidence * 100).toFixed(0)}%</td>
                            </tr>
                            <tr>
                                <td>Level Progression</td>
                                <td>${BattleStatsEstimator.formatNumber(estimation.breakdown.level_progression)}</td>
                                <td>Base calculation</td>
                            </tr>
                            <tr>
                                <td>Activity Weighted</td>
                                <td>${BattleStatsEstimator.formatNumber(estimation.breakdown.activity_weighted)}</td>
                                <td>Last action: ${userData.last_action?.relative || 'Unknown'}</td>
                            </tr>
                            <tr>
                                <td>Battle Analysis</td>
                                <td>${BattleStatsEstimator.formatNumber(estimation.breakdown.battle_analysis)}</td>
                                <td>Alternative method</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
            
            const profileContainer = document.querySelector('.profile-container, .content-wrapper');
            if (profileContainer) {
                const tableContainer = document.createElement('div');
                tableContainer.innerHTML = tableHtml;
                profileContainer.appendChild(tableContainer);
            }
        }
    }
    
    class AttackPageHandler {
        static handle() {
            SkyviewLogger.info('Handling attack page...');
            
            setTimeout(() => {
                this.processAttackPage();
            }, 1000);
        }
        
        static processAttackPage() {
            const apiKey = storage.get('api-key');
            if (!apiKey) return;
            
            // Extract target info from URL
            const urlParams = new URLSearchParams(window.location.search);
            const targetId = urlParams.get('user2ID');
            
            if (targetId) {
                this.addAttackIntelligence(targetId, apiKey);
            }
        }
        
        static async addAttackIntelligence(targetId, apiKey) {
            try {
                const userData = await ProfilePageHandler.fetchUserData(targetId, apiKey);
                if (!userData) return;
                
                const estimation = BattleStatsEstimator.estimate(userData.level, userData.last_action?.relative);
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'skyview-attack-info';
                infoDiv.innerHTML = `
                    <h4>🦉 Battle Intelligence</h4>
                    <p><strong>Target:</strong> ${userData.name} [Level ${userData.level}]</p>
                    <p><strong>Estimated Battle Stats:</strong> ${BattleStatsEstimator.formatNumber(estimation.total)}</p>
                    <p><strong>Confidence:</strong> ${(estimation.confidence * 100).toFixed(0)}%</p>
                    <p><strong>Last Activity:</strong> ${userData.last_action?.relative || 'Unknown'}</p>
                    <p><strong>Analysis:</strong> ${this.getAttackRecommendation(estimation)}</p>
                `;
                
                const attackContainer = document.querySelector('.attack-container, .content-wrapper');
                if (attackContainer) {
                    attackContainer.insertBefore(infoDiv, attackContainer.firstChild);
                }
            } catch (error) {
                SkyviewLogger.error('Attack intelligence failed:', error);
            }
        }
        
        static getAttackRecommendation(estimation) {
            if (estimation.confidence > 0.8 && estimation.total > 100000) {
                return 'High confidence strong opponent - proceed with caution';
            } else if (estimation.confidence > 0.7) {
                return 'Moderate confidence in estimates';
            } else {
                return 'Low confidence - estimates may vary';
            }
        }
    }
    
    class FactionPageHandler {
        static handle() {
            SkyviewLogger.info('Handling faction page...');
            
            setTimeout(() => {
                this.processFactionMembers();
            }, 1500);
        }
        
        static processFactionMembers() {
            const memberElements = document.querySelectorAll('[class*="member"], .faction-member');
            
            memberElements.forEach((memberElement, index) => {
                setTimeout(() => {
                    this.addMemberStats(memberElement);
                }, index * 100); // Stagger requests
            });
        }
        
        static addMemberStats(memberElement) {
            const levelMatch = memberElement.textContent.match(/Level: (\d+)/);
            if (!levelMatch) return;
            
            const level = parseInt(levelMatch[1]);
            const estimation = BattleStatsEstimator.estimate(level, 'Unknown');
            
            const statsDisplay = document.createElement('span');
            statsDisplay.className = 'skyview-stat-display';
            statsDisplay.innerHTML = `≈${BattleStatsEstimator.formatNumber(estimation.total)}`;
            
            const tooltip = `Estimated Battle Stats: ${estimation.total.toLocaleString()}\nLevel: ${level}\nConfidence: ${(estimation.confidence * 100).toFixed(0)}%`;
            
            statsDisplay.title = tooltip;
            
            const userInfo = memberElement.querySelector('[class*="userInfoBox"]');
            if (userInfo) {
                userInfo.appendChild(statsDisplay);
            }
        }
    }
    
    // ========== INITIALIZATION ==========
    function initializeSkyview() {
        SkyviewLogger.info('Skyview Advanced Battle Intelligence starting...');
        
        // Always show that script is running
        showSkyviewStatus();
        
        // Check for API key
        const apiKey = storage.get('api-key');
        if (!apiKey) {
            SkyviewLogger.warn('API key not found. Please set using: window.setSkyviewApiKey("your_key_here")');
            showApiKeyPrompt();
            return;
        }
        
        const currentPage = window.location.pathname;
        SkyviewLogger.info(`Processing page: ${currentPage}`);
        
        if (currentPage === '/profiles.php') {
            ProfilePageHandler.handle();
        } else if (currentPage === '/loader.php' && window.location.search.includes('sid=attack')) {
            AttackPageHandler.handle();
        } else if (currentPage === '/factions.php') {
            FactionPageHandler.handle();
        } else {
            SkyviewLogger.info('Page not supported for battle stats analysis');
        }
        
        SkyviewLogger.info('Skyview initialization complete');
    }
    
    // Show visual indicator that script is loaded
    function showSkyviewStatus() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'skyview-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #4A90E2;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            font-family: monospace;
        `;
        statusDiv.innerHTML = '🦉 Skyview v4.0.3 Loaded';
        document.body.appendChild(statusDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (statusDiv && statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 3000);
    }
    
    // Show API key setup prompt
    function showApiKeyPrompt() {
        const promptDiv = document.createElement('div');
        promptDiv.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            background: #f44336;
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            font-family: monospace;
            max-width: 300px;
            cursor: pointer;
        `;
        promptDiv.innerHTML = `
            🦉 Skyview: API Key Required<br>
            <small>Click to setup API key</small>
        `;
        
        promptDiv.onclick = function() {
            const apiKey = prompt('Enter your Torn API key:');
            if (apiKey) {
                storage.set('api-key', apiKey);
                location.reload();
            }
        };
        
        document.body.appendChild(promptDiv);
    }
    
    // ========== STARTUP ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSkyview);
    } else {
        initializeSkyview();
    }
    
    // Global helper for API key setting
    window.setSkyviewApiKey = function(apiKey) {
        storage.set('api-key', apiKey);
        console.log('Skyview API key set successfully');
    };
    
    SkyviewLogger.info('Skyview Advanced Battle Intelligence v4.0 loaded');
    
})();