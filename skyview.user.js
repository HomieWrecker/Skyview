// ==UserScript==
// @name         Brother Owl Skyview - S.O.A.P. Integration v4.1.0
// @namespace    https://torn.com/profiles.php?XID=2353116
// @version      4.1.0
// @author       Homiewrecker [2353116] - S.O.A.P. Style Attack Page Integration
// @description  Complete S.O.A.P. integration with TornStats spy data, enhancement comparison, and faction page stats
// @icon         🦉
// @match        https://www.torn.com/profiles.php?*
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/loader.php?sid=attack&user2ID=*
// @connect      api.torn.com
// @connect      www.tornstats.com
// @connect      *.replit.app
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    // Storage utility
    const storage = {
        get: (key) => GM_getValue(key),
        set: (key, value) => GM_setValue(key, value)
    };
    
    // Logger
    const SkyviewLogger = {
        info: (msg, ...args) => console.log(`[SKYVIEW] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[SKYVIEW] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[SKYVIEW] ${msg}`, ...args)
    };
    
    // Basic battle stats estimator
    const BattleStatsEstimator = {
        estimate: (level, lastAction, userData) => {
            const baseStats = Math.pow(level, 2.2) * 100;
            const activityMultiplier = this.getActivityMultiplier(lastAction);
            const total = Math.round(baseStats * activityMultiplier);
            
            return {
                total: total,
                confidence: 0.75,
                methodology: 'AI Level-based estimation'
            };
        },
        
        getActivityMultiplier: (lastAction) => {
            if (!lastAction) return 1.0;
            if (lastAction.includes('minute')) return 1.5;
            if (lastAction.includes('hour')) return 1.2;
            if (lastAction.includes('day')) return 0.8;
            return 1.0;
        },
        
        formatNumber: (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
    };
    
    // Attack Page Handler with S.O.A.P. Integration
    class AttackPageHandler {
        static handle() {
            SkyviewLogger.info('Handling attack page with S.O.A.P. integration...');
            
            const urlParams = new URLSearchParams(window.location.search);
            const attackId = urlParams.get('user2ID');
            
            if (!attackId) {
                SkyviewLogger.warn('No target user ID found on attack page');
                return;
            }
            
            setTimeout(() => {
                this.processAttackPage(attackId);
            }, 1000);
        }
        
        static async processAttackPage(attackId) {
            const apiKey = storage.get('api-key');
            if (!apiKey) {
                SkyviewLogger.warn('No API key found for attack page');
                this.showApiKeyPrompt();
                return;
            }
            
            try {
                // Fetch both target and own data for comparison
                const [targetData, ownData] = await Promise.all([
                    this.fetchUserData(attackId, apiKey, 'profile,personalstats,battlestats'),
                    this.fetchUserData('', apiKey, 'battlestats,profile,personalstats')
                ]);
                
                if (targetData && ownData) {
                    // Try to get TornStats spy data first
                    const spyData = await this.fetchTornStatsData(attackId, apiKey);
                    
                    if (spyData && spyData.spy?.status) {
                        this.displaySpyStats(targetData, ownData, spyData);
                    } else {
                        // Fall back to AI estimation with comprehensive data
                        const estimatedStats = BattleStatsEstimator.estimate(
                            targetData.level, 
                            targetData.last_action?.relative,
                            targetData
                        );
                        this.displayEstimatedStats(targetData, ownData, estimatedStats);
                    }
                    
                    // Always show enhancement comparison and intelligence
                    this.displayAttackIntelligence(targetData, ownData);
                }
            } catch (error) {
                SkyviewLogger.error('Attack page processing failed:', error);
            }
        }
        
        static fetchUserData(userId, apiKey, selections) {
            return new Promise((resolve, reject) => {
                const url = userId ? 
                    `https://api.torn.com/user/${userId}?selections=${selections}&key=${apiKey}&comment=attack_stats` :
                    `https://api.torn.com/user/?selections=${selections}&key=${apiKey}&comment=attack_stats`;
                    
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 15000,
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
        
        static fetchTornStatsData(userId, apiKey) {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://www.tornstats.com/api/v1/${apiKey}/spy/${userId}`,
                    timeout: 10000,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            SkyviewLogger.warn('TornStats data parsing failed:', e);
                            resolve(null);
                        }
                    },
                    onerror: () => {
                        SkyviewLogger.warn('TornStats request failed');
                        resolve(null);
                    }
                });
            });
        }
        
        static buildIntelligenceText(targetData, ownData) {
            // Calculate enhancement differences (S.O.A.P. style)
            const diffXan = (targetData.personalstats?.xantaken || 0) - (ownData.personalstats?.xantaken || 0);
            const diffRefill = (targetData.personalstats?.refills || 0) - (ownData.personalstats?.refills || 0);
            const diffCans = (targetData.personalstats?.energydrinkused || 0) - (ownData.personalstats?.energydrinkused || 0);
            const diffSE = (targetData.personalstats?.statenhancersused || 0) - (ownData.personalstats?.statenhancersused || 0);
            
            const formatDiff = (diff, name) => {
                if (diff === 0) return `${name}: **SAME as you**`;
                const color = diff > 0 ? 'color: #EE4B2B' : 'color: #98FB98';
                const moreOrLess = diff > 0 ? 'MORE' : 'LESS';
                return `${name}: <span style="${color}">**${Math.abs(diff)} ${moreOrLess} than you**</span>`;
            };
            
            // Get job information
            let jobText = 'Unemployed';
            if (targetData.job && targetData.job.company_type > 0) {
                jobText = this.getCompanyName(targetData.job.company_type);
            } else if (targetData.job && targetData.job.job) {
                jobText = targetData.job.job;
            }
            
            return `
📊 **ENHANCEMENT INTELLIGENCE**
${formatDiff(diffXan, 'Xanax')}
${formatDiff(diffRefill, 'Refills')}  
${formatDiff(diffCans, 'Energy Cans')}
${formatDiff(diffSE, 'Stat Enhancers')}

📋 **TARGET INTELLIGENCE**
**Last Action:** ${targetData.last_action?.relative || 'Unknown'}
**Faction:** ${targetData.faction?.faction_name || 'None'}
**Job:** ${jobText}
`;
        }
        
        static getCompanyName(companyType) {
            const companies = {
                1: "Hair Salon", 2: "Law Firm", 3: "Flower Shop", 4: "Car Dealership", 
                5: "Clothing Store", 6: "Gun Shop", 7: "Game Shop", 8: "Candle Shop",
                9: "Toy Shop", 10: "Adult Novelties", 11: "Cyber Cafe", 12: "Grocery Store", 
                13: "Theater", 14: "Sweet Shop", 15: "Cruise Line", 16: "Television Network",
                18: "Zoo", 19: "Firework Stand", 20: "Property Broker", 21: "Furniture Store", 
                22: "Gas Station", 23: "Music Store", 24: "Nightclub", 25: "Pub",
                26: "Gents Strip Club", 27: "Restaurant", 28: "Oil Rig", 29: "Fitness Center", 
                30: "Mechanic Shop", 31: "Amusement Park", 32: "Lingerie Store", 33: "Meat Warehouse",
                34: "Farm", 35: "Software Corporation", 36: "Ladies Strip Club", 37: "Private Security Firm", 
                38: "Mining Corporation", 39: "Detective Agency", 40: "Logistics Management"
            };
            return companies[companyType] || 'Unknown Company';
        }
        
        static addAttackButton(content) {
            const dialogButtons = document.querySelector('.dialogButtons___nX4Bz, .dialog-buttons, [class*="dialog"][class*="button"]');
            if (!dialogButtons) {
                SkyviewLogger.warn('Attack dialog buttons not found');
                return;
            }
            
            // Remove existing attack info if present
            const existing = document.getElementById('skyview-attack-info');
            if (existing) existing.remove();
            
            const attackInfo = document.createElement('div');
            attackInfo.id = 'skyview-attack-info';
            attackInfo.className = 'skyview-attack-info';
            attackInfo.innerHTML = content;
            attackInfo.style.cssText = `
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 15px;
                border-radius: 8px;
                margin: 10px 0;
                font-family: monospace;
                border: 2px solid #3498db;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            `;
            
            dialogButtons.appendChild(attackInfo);
        }
        
        static displayAttackIntelligence(targetData, ownData) {
            const intelligenceText = this.buildIntelligenceText(targetData, ownData);
            this.addAttackButton(intelligenceText);
        }
        
        static showApiKeyPrompt() {
            const promptText = `
❌ **API KEY REQUIRED**
Please set your API key in Skyview settings.
Use the same key registered with TornStats for spy data access.
`;
            this.addAttackButton(promptText);
        }
    }
    
    // Faction Page Handler
    class FactionPageHandler {
        static handle() {
            SkyviewLogger.info('Handling faction page...');
            
            const apiKey = storage.get('api-key');
            if (!apiKey) {
                SkyviewLogger.warn('No API key for faction page');
                return;
            }
            
            setTimeout(() => {
                this.processFactionPage(apiKey);
            }, 2000);
        }
        
        static async processFactionPage(apiKey) {
            try {
                // Find all member links on the faction page
                const memberLinks = document.querySelectorAll('a[href*="profiles.php?XID="]');
                if (memberLinks.length === 0) {
                    SkyviewLogger.warn('No member links found on faction page');
                    return;
                }
                
                SkyviewLogger.info(`Found ${memberLinks.length} members on faction page`);
                
                // Process each member (limit to first 20 to avoid rate limits)
                const membersToProcess = Array.from(memberLinks).slice(0, 20);
                
                for (const link of membersToProcess) {
                    const match = link.href.match(/XID=(\d+)/);
                    if (match) {
                        const userId = match[1];
                        setTimeout(() => {
                            this.addStatsToMember(link, userId, apiKey);
                        }, Math.random() * 3000); // Stagger requests
                    }
                }
            } catch (error) {
                SkyviewLogger.error('Faction page processing failed:', error);
            }
        }
        
        static async addStatsToMember(memberElement, userId, apiKey) {
            try {
                // Check if already processed
                if (memberElement.querySelector('.skyview-stat-display')) {
                    return;
                }
                
                // Fetch user data
                const userData = await AttackPageHandler.fetchUserData(userId, apiKey, 'profile');
                if (!userData) return;
                
                // Estimate battle stats
                const estimation = BattleStatsEstimator.estimate(
                    userData.level,
                    userData.last_action?.relative,
                    userData
                );
                
                // Create stats display
                const statsDisplay = document.createElement('span');
                statsDisplay.className = 'skyview-stat-display';
                statsDisplay.innerHTML = ` 🦉 ≈${BattleStatsEstimator.formatNumber(estimation.total)}`;
                statsDisplay.title = `AI Battle Stats: ${estimation.total.toLocaleString()}\nConfidence: ${(estimation.confidence * 100).toFixed(0)}%\nLevel: ${userData.level}\nLast Action: ${userData.last_action?.relative || 'Unknown'}`;
                statsDisplay.style.cssText = `
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    margin-left: 5px;
                    font-weight: bold;
                `;
                
                // Add to member name/link
                memberElement.appendChild(statsDisplay);
                
            } catch (error) {
                SkyviewLogger.warn(`Failed to add stats for member ${userId}:`, error);
            }
        }
    }
    
    // Profile Page Handler
    class ProfilePageHandler {
        static handle() {
            SkyviewLogger.info('Handling profile page...');
            
            const apiKey = storage.get('api-key');
            if (!apiKey) {
                SkyviewLogger.warn('No API key for profile page');
                return;
            }
            
            setTimeout(() => {
                this.processProfilePage(apiKey);
            }, 1500);
        }
        
        static async processProfilePage(apiKey) {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const userId = urlParams.get('XID');
                
                if (!userId) {
                    SkyviewLogger.warn('No user ID found on profile page');
                    return;
                }
                
                const userData = await AttackPageHandler.fetchUserData(userId, apiKey, 'profile');
                if (!userData) return;
                
                const estimation = BattleStatsEstimator.estimate(
                    userData.level,
                    userData.last_action?.relative,
                    userData
                );
                
                this.addProfileStats(estimation, userData);
                
            } catch (error) {
                SkyviewLogger.error('Profile page processing failed:', error);
            }
        }
        
        static addProfileStats(estimation, userData) {
            const selectors = [
                '.profile-container',
                '.basic-info', 
                '.user-info',
                '.content-wrapper',
                'h4'
            ];
            
            let insertionPoint = null;
            for (const selector of selectors) {
                insertionPoint = document.querySelector(selector);
                if (insertionPoint) break;
            }
            
            if (!insertionPoint) {
                SkyviewLogger.warn('No suitable insertion point found for profile stats');
                return;
            }
            
            const statsDisplay = document.createElement('div');
            statsDisplay.className = 'skyview-profile-stats';
            statsDisplay.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px; border-radius: 8px; margin: 10px 0; font-family: monospace;">
                    🦉 <strong>Battle Stats:</strong> ≈${BattleStatsEstimator.formatNumber(estimation.total)}<br>
                    <small>Confidence: ${(estimation.confidence * 100).toFixed(0)}% | Level: ${userData.level}</small>
                </div>
            `;
            
            insertionPoint.appendChild(statsDisplay);
        }
    }
    
    // API Key Management
    function showApiKeyPrompt() {
        if (document.getElementById('skyview-api-prompt')) return;
        
        const prompt = document.createElement('div');
        prompt.id = 'skyview-api-prompt';
        prompt.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #2c3e50;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            font-family: monospace;
            max-width: 300px;
            border: 2px solid #e74c3c;
        `;
        prompt.innerHTML = `
            <strong>🦉 Skyview S.O.A.P. Integration</strong><br>
            API key required for enhanced features.<br>
            <button onclick="
                const key = prompt('Enter your Torn API key:');
                if (key) {
                    GM_setValue('api-key', key);
                    this.parentElement.remove();
                    location.reload();
                }
            " style="margin-top: 10px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Set API Key
            </button>
        `;
        
        document.body.appendChild(prompt);
    }
    
    // Initialization
    function initializeSkyview() {
        SkyviewLogger.info('Skyview S.O.A.P. Integration v4.1.0 starting...');
        
        const apiKey = storage.get('api-key');
        if (!apiKey) {
            SkyviewLogger.warn('API key not found. Please set using the prompt.');
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
        
        SkyviewLogger.info('Skyview S.O.A.P. initialization complete');
    }
    
    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSkyview);
    } else {
        initializeSkyview();
    }
    
})();