// ==UserScript==
// @name         Brother Owl Skyview - Advanced Battle Intelligence
// @namespace    https://torn.com/profiles.php?XID=2353116
// @version      4.1.0
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
// @connect      www.tornstats.com  
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
    
    // ========== COMPREHENSIVE PAGE SCRAPER ==========
    class ProfilePageScraper {
        static enhanceWithScrapedData(apiData) {
            try {
                const scrapedData = this.scrapePageData();
                return { ...apiData, ...scrapedData };
            } catch (error) {
                SkyviewLogger.warn('Page scraping failed:', error.message);
                return apiData;
            }
        }
        
        static scrapePageData() {
            const scrapedData = {};
            
            // Scrape battle stats if visible
            scrapedData.scrapedStats = this.scrapeBattleStats();
            
            // Scrape enhancement usage data
            scrapedData.enhancementUsage = this.scrapeEnhancementData();
            
            // Scrape activity patterns
            scrapedData.activityData = this.scrapeActivityData();
            
            // Scrape faction information
            scrapedData.factionData = this.scrapeFactionData();
            
            // Scrape property and possession data
            scrapedData.possessionData = this.scrapePossessionData();
            
            // Scrape awards and achievements
            scrapedData.achievementData = this.scrapeAchievementData();
            
            SkyviewLogger.info('Scraped comprehensive page data:', Object.keys(scrapedData));
            return scrapedData;
        }
        
        static scrapeBattleStats() {
            const statsElements = document.querySelectorAll('[class*="stat"], [class*="battle"], .user-information li');
            const battleStats = {};
            
            statsElements.forEach(el => {
                const text = el.textContent;
                if (text.includes('Strength:') || text.includes('Defense:') || 
                    text.includes('Speed:') || text.includes('Dexterity:')) {
                    const match = text.match(/(\d+,?\d*)/);
                    if (match) {
                        const statType = text.split(':')[0].toLowerCase();
                        battleStats[statType] = parseInt(match[1].replace(/,/g, ''));
                    }
                }
            });
            
            return battleStats;
        }
        
        static scrapeEnhancementData() {
            const enhancementData = {};
            
            // Look for enhancement usage in various page sections
            const allText = document.body.textContent;
            const infoLists = document.querySelectorAll('.info-table, .user-information, .profile-container');
            
            infoLists.forEach(list => {
                const text = list.textContent;
                
                // Scrape Xanax usage
                let xanMatch = text.match(/Xanax.*?([\d,]+)/i);
                if (xanMatch) {
                    enhancementData.xanax_taken = parseInt(xanMatch[1].replace(/,/g, ''));
                }
                
                // Scrape refills usage
                let refillMatch = text.match(/(?:Energy|Nerve|Happy).*?refill.*?([\d,]+)/i);
                if (refillMatch) {
                    enhancementData.refills_used = parseInt(refillMatch[1].replace(/,/g, ''));
                }
                
                // Scrape enhancer usage
                let enhancerMatch = text.match(/(?:Enhancer|Booster).*?([\d,]+)/i);
                if (enhancerMatch) {
                    enhancementData.enhancers_used = parseInt(enhancerMatch[1].replace(/,/g, ''));
                }
            });
            
            return enhancementData;
        }
        
        static scrapeActivityData() {
            const activityData = {};
            
            // Scrape online status and activity patterns
            const statusElements = document.querySelectorAll('.status, [class*="online"], [class*="activity"]');
            statusElements.forEach(el => {
                const text = el.textContent.toLowerCase();
                if (text.includes('online') || text.includes('offline')) {
                    activityData.online_status = text.includes('online');
                }
                if (text.includes('last seen')) {
                    activityData.last_seen = el.textContent;
                }
            });
            
            // Scrape travel status
            if (document.body.textContent.includes('Traveling') || 
                document.body.textContent.includes('Flying')) {
                activityData.traveling = true;
            }
            
            return activityData;
        }
        
        static scrapeFactionData() {
            const factionData = {};
            
            const factionElements = document.querySelectorAll('[class*="faction"], .faction-name, .faction-info');
            factionElements.forEach(el => {
                const text = el.textContent;
                if (text.includes('Faction:') || text.includes('Member of')) {
                    factionData.faction_name = text.replace(/Faction:|Member of/i, '').trim();
                }
            });
            
            return factionData;
        }
        
        static scrapePossessionData() {
            const possessionData = {};
            
            // Scrape property and valuable possessions
            const propertyElements = document.querySelectorAll('[class*="property"], [class*="possession"]');
            propertyElements.forEach(el => {
                const text = el.textContent;
                if (text.includes('Property:')) {
                    possessionData.properties = text.replace('Property:', '').trim();
                }
            });
            
            return possessionData;
        }
        
        static scrapeAchievementData() {
            const achievementData = {};
            
            // Scrape awards, honors, and achievements
            const awardElements = document.querySelectorAll('.awards, .honors, [class*="achievement"]');
            achievementData.awards_count = awardElements.length;
            
            // Scrape merit count if visible
            const meritText = document.body.textContent;
            const meritMatch = meritText.match(/merit.*?([\d,]+)/i);
            if (meritMatch) {
                achievementData.merits = parseInt(meritMatch[1].replace(/,/g, ''));
            }
            
            return achievementData;
        }
    }
    
    // ========== AI-POWERED BATTLE STATS ESTIMATOR ==========
    class BattleStatsEstimator {
        static async estimate(level, lastAction, userData = {}) {
            try {
                // Call Brother Owl AI Engine for accurate estimation
                const aiEstimate = await this.callAIEngine(level, lastAction, userData);
                if (aiEstimate && aiEstimate.success) {
                    return {
                        total: aiEstimate.estimated,
                        confidence: aiEstimate.confidence,
                        methodology: 'Brother Owl AI Engine',
                        source: aiEstimate.source || 'Machine Learning Analysis',
                        factors: aiEstimate.factors || []
                    };
                }
            } catch (error) {
                SkyviewLogger.warn('AI Engine unavailable:', error.message);
            }
            
            // Fallback to improved local estimation (NO level progression!)
            return this.improvedLocalEstimate(level, lastAction, userData);
        }
        
        static async callAIEngine(level, lastAction, userData) {
            const payload = {
                level: level,
                lastAction: lastAction,
                xanIntake: userData.xanIntake || 0,
                gymProgress: userData.gymProgress || 0,
                trainingActive: userData.trainingActive || false
            };
            
            try {
                const response = await fetch('https://Brother-Owl-Discord-Bot.homiewrecker.repl.co/api/ai-estimate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${storage.get('api-key')}`
                    },
                    body: JSON.stringify(payload),
                    timeout: 10000
                });
                
                if (response.ok) {
                    const result = await response.json();
                    return { success: true, ...result };
                }
            } catch (error) {
                SkyviewLogger.warn('AI Engine connection failed:', error.message);
            }
            
            return { success: false };
        }
        
        static improvedLocalEstimate(level, lastAction, userData) {
            // Improved estimation WITHOUT terrible level progression
            // Base on activity patterns and battle intelligence only
            let baseStats = level * 42000; // Conservative base multiplier
            
            // Activity-based modifier (much more reliable than level progression)
            const hours = this.parseLastAction(lastAction);
            let activityMultiplier = 1.0;
            if (hours < 1) activityMultiplier = 1.4;      // Very active
            else if (hours < 6) activityMultiplier = 1.25; // Active
            else if (hours < 24) activityMultiplier = 1.1; // Recent
            else if (hours < 168) activityMultiplier = 0.95; // Weekly
            else activityMultiplier = 0.8;                 // Inactive
            
            baseStats *= activityMultiplier;
            
            // Enhancement modifiers if available
            if (userData.xanIntake > 0) {
                baseStats += userData.xanIntake * 450;
            }
            
            if (userData.gymProgress > 0) {
                baseStats *= (1 + userData.gymProgress / 180);
            }
            
            return {
                total: Math.floor(baseStats),
                confidence: 0.45, // Lower confidence for fallback
                methodology: 'Local Activity Analysis',
                source: 'Fallback algorithm (AI unavailable)',
                factors: [
                    `Level ${level}`, 
                    `Activity: ${lastAction || 'Unknown'}`,
                    `Multiplier: ${activityMultiplier.toFixed(2)}x`
                ]
            };
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
        
        static formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
    }
    
    // ========== PAGE HANDLERS ==========
    
    // Attack Page Handler - Inspired by Torn S.O.A.P.
    class AttackPageHandler {
        static handle() {
            SkyviewLogger.info('Handling attack page...');
            
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
                        const estimatedStats = await BattleStatsEstimator.estimate(
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
        
        static displaySpyStats(targetData, ownData, spyData) {
            const spy = spyData.spy;
            const statsText = this.buildSpyStatsText(spy, ownData, targetData);
            const intelligenceText = this.buildIntelligenceText(targetData, ownData);
            
            this.addAttackButton(statsText + intelligenceText);
        }
        
        static displayEstimatedStats(targetData, ownData, estimation) {
            const statsText = this.buildEstimatedStatsText(estimation, ownData, targetData);
            const intelligenceText = this.buildIntelligenceText(targetData, ownData);
            
            this.addAttackButton(statsText + intelligenceText);
        }
        
        static buildSpyStatsText(spy, ownData, targetData) {
            const statDiff = [
                (spy.total / ownData.total * 100).toFixed(1),
                spy.strength > 0 ? (spy.strength / ownData.strength * 100).toFixed(1) : null,
                spy.defense > 0 ? (spy.defense / ownData.defense * 100).toFixed(1) : null,
                spy.speed > 0 ? (spy.speed / ownData.speed * 100).toFixed(1) : null,
                spy.dexterity > 0 ? (spy.dexterity / ownData.dexterity * 100).toFixed(1) : null
            ];
            
            const formatStat = (value, percentage) => {
                const color = percentage > 100 ? 'color: #EE4B2B' : 'color: #98FB98';
                return `<span style="${color}">(${percentage}%)</span>`;
            };
            
            return `
🎯 **SPIED BATTLE STATS** (TornStats)
**TOTAL:** ${this.formatNumber(spy.total)} ${formatStat(spy.total, statDiff[0])}
${spy.strength > 0 ? `STR: ${this.formatNumber(spy.strength)} ${formatStat(spy.strength, statDiff[1])}
` : ''}
${spy.defense > 0 ? `DEF: ${this.formatNumber(spy.defense)} ${formatStat(spy.defense, statDiff[2])}
` : ''}
${spy.speed > 0 ? `SPD: ${this.formatNumber(spy.speed)} ${formatStat(spy.speed, statDiff[3])}
` : ''}
${spy.dexterity > 0 ? `DEX: ${this.formatNumber(spy.dexterity)} ${formatStat(spy.dexterity, statDiff[4])}
` : ''}
**Fair Fight: ${spy.fair_fight_bonus ? spy.fair_fight_bonus.toFixed(2) : '0.00'}**

`;
        }
        
        static buildEstimatedStatsText(estimation, ownData, targetData) {
            const statDiff = (estimation.total / ownData.total * 100).toFixed(1);
            const color = statDiff > 100 ? 'color: #EE4B2B' : 'color: #98FB98';
            
            return `
🤖 **AI ESTIMATED STATS** (Brother Owl)
**TOTAL:** ${this.formatNumber(estimation.total)} <span style="${color}">(${statDiff}%)</span>
**Confidence:** ${(estimation.confidence * 100).toFixed(0)}%
**Method:** ${estimation.methodology}

`;
        }
        
        static buildIntelligenceText(targetData, ownData) {
            // Calculate enhancement differences (S.O.A.P. style)
            const diffXan = targetData.personalstats.xantaken - ownData.personalstats.xantaken;
            const diffRefill = targetData.personalstats.refills - ownData.personalstats.refills;
            const diffCans = targetData.personalstats.energydrinkused - ownData.personalstats.energydrinkused;
            const diffSE = targetData.personalstats.statenhancersused - ownData.personalstats.statenhancersused;
            
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
            const dialogButtons = document.querySelector('.dialogButtons___nX4Bz');
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
            
            dialogButtons.appendChild(attackInfo);
        }
        
        static displayAttackIntelligence(targetData, ownData) {
            // This method is called separately to show intelligence even if stats fail
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
        
        static formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
    }
    
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
                // Get comprehensive data - as much as legally possible
                const selections = [
                    'profile',
                    'personalstats', 
                    'crimes',
                    'education',
                    'gym',
                    'honors',
                    'icons',
                    'jobpoints',
                    'medals',
                    'merits',
                    'money',
                    'networth',
                    'notifications',
                    'perks',
                    'refills',
                    'stats',
                    'travel',
                    'weaponexp',
                    'workstats'
                ].join(',');
                
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://api.torn.com/user/${userId}?selections=${selections}&key=${apiKey}`,
                    timeout: CONFIG.API_TIMEOUT,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                reject(new Error(data.error.error));
                                return;
                            }
                            
                            // Enhance data with page scraping
                            const enhancedData = ProfilePageScraper.enhanceWithScrapedData(data);
                            resolve(enhancedData);
                        } catch (e) {
                            reject(e);
                        }
                    },
                    onerror: () => reject(new Error('Request failed'))
                });
            });
        }
        
        static async displayBattleStats(userData) {
            const estimation = await BattleStatsEstimator.estimate(
                userData.level, 
                userData.last_action?.relative,
                userData
            );
            
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
            statsDisplay.title = `Battle Stats: ${estimation.total.toLocaleString()}\nConfidence: ${(estimation.confidence * 100).toFixed(0)}%\nMethod: ${estimation.methodology}`;
            
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
        
        static async createProfileTable(userData) {
            const estimation = await BattleStatsEstimator.estimate(
                userData.level, 
                userData.last_action?.relative,
                userData
            );
            
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
                                <td><strong>Battle Stats</strong></td>
                                <td class="skyview-total-strong">${BattleStatsEstimator.formatNumber(estimation.total)}</td>
                                <td>Confidence: ${(estimation.confidence * 100).toFixed(0)}%</td>
                            </tr>
                            <tr>
                                <td>Estimation Method</td>
                                <td colspan="2">${estimation.methodology}</td>
                            </tr>
                            <tr>
                                <td>Target's Xanax</td>
                                <td>${(userData.enhancementUsage?.xanax_taken || userData.refills?.xanax || 0).toLocaleString()}</td>
                                <td>Target's Refills: ${(userData.enhancementUsage?.refills_used || userData.refills?.energy || 0).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Target's Enhancers</td>
                                <td>${(userData.enhancementUsage?.enhancers_used || 0).toLocaleString()}</td>
                                <td>Activity: ${userData.last_action?.relative || 'Unknown'}</td>
                            </tr>
                            <tr>
                                <td>Intelligence Data</td>
                                <td>Level: ${userData.level}</td>
                                <td>Faction: ${userData.faction?.faction_name || userData.factionData?.faction_name || 'Unknown'}</td>
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
                        const estimatedStats = await BattleStatsEstimator.estimate(
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
        
        static displaySpyStats(targetData, ownData, spyData) {
            const spy = spyData.spy;
            const statsText = this.buildSpyStatsText(spy, ownData, targetData);
            const intelligenceText = this.buildIntelligenceText(targetData, ownData);
            
            this.addAttackButton(statsText + intelligenceText);
        }
        
        static displayEstimatedStats(targetData, ownData, estimation) {
            const statsText = this.buildEstimatedStatsText(estimation, ownData, targetData);
            const intelligenceText = this.buildIntelligenceText(targetData, ownData);
            
            this.addAttackButton(statsText + intelligenceText);
        }
        
        static buildSpyStatsText(spy, ownData, targetData) {
            const statDiff = [
                (spy.total / ownData.total * 100).toFixed(1),
                spy.strength > 0 ? (spy.strength / ownData.strength * 100).toFixed(1) : null,
                spy.defense > 0 ? (spy.defense / ownData.defense * 100).toFixed(1) : null,
                spy.speed > 0 ? (spy.speed / ownData.speed * 100).toFixed(1) : null,
                spy.dexterity > 0 ? (spy.dexterity / ownData.dexterity * 100).toFixed(1) : null
            ];
            
            const formatStat = (value, percentage) => {
                const color = percentage > 100 ? 'color: #EE4B2B' : 'color: #98FB98';
                return `<span style="${color}">(${percentage}%)</span>`;
            };
            
            return `
🎯 **SPIED BATTLE STATS** (TornStats)
**TOTAL:** ${this.formatNumber(spy.total)} ${formatStat(spy.total, statDiff[0])}
${spy.strength > 0 ? `STR: ${this.formatNumber(spy.strength)} ${formatStat(spy.strength, statDiff[1])}
` : ''}
${spy.defense > 0 ? `DEF: ${this.formatNumber(spy.defense)} ${formatStat(spy.defense, statDiff[2])}
` : ''}
${spy.speed > 0 ? `SPD: ${this.formatNumber(spy.speed)} ${formatStat(spy.speed, statDiff[3])}
` : ''}
${spy.dexterity > 0 ? `DEX: ${this.formatNumber(spy.dexterity)} ${formatStat(spy.dexterity, statDiff[4])}
` : ''}
**Fair Fight: ${spy.fair_fight_bonus ? spy.fair_fight_bonus.toFixed(2) : '0.00'}**

`;
        }
        
        static buildEstimatedStatsText(estimation, ownData, targetData) {
            const statDiff = (estimation.total / ownData.total * 100).toFixed(1);
            const color = statDiff > 100 ? 'color: #EE4B2B' : 'color: #98FB98';
            
            return `
🤖 **AI ESTIMATED STATS** (Brother Owl)
**TOTAL:** ${this.formatNumber(estimation.total)} <span style="${color}">(${statDiff}%)</span>
**Confidence:** ${(estimation.confidence * 100).toFixed(0)}%
**Method:** ${estimation.methodology}

`;
        }
        
        static buildIntelligenceText(targetData, ownData) {
            // Calculate enhancement differences (S.O.A.P. style)
            const diffXan = targetData.personalstats.xantaken - ownData.personalstats.xantaken;
            const diffRefill = targetData.personalstats.refills - ownData.personalstats.refills;
            const diffCans = targetData.personalstats.energydrinkused - ownData.personalstats.energydrinkused;
            const diffSE = targetData.personalstats.statenhancersused - ownData.personalstats.statenhancersused;
            
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
            const dialogButtons = document.querySelector('.dialogButtons___nX4Bz');
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
            
            dialogButtons.appendChild(attackInfo);
        }
        
        static displayAttackIntelligence(targetData, ownData) {
            // This method is called separately to show intelligence even if stats fail
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
        
        static formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
    }
    
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
                const userData = await this.fetchUserData(userId, apiKey);
                if (!userData) return;
                
                // Estimate battle stats
                const estimation = await BattleStatsEstimator.estimate(
                    userData.level,
                    userData.last_action?.relative,
                    userData
                );
                
                // Create stats display
                const statsDisplay = document.createElement('span');
                statsDisplay.className = 'skyview-stat-display';
                statsDisplay.innerHTML = ` 🦉 ≈${BattleStatsEstimator.formatNumber(estimation.total)}`;
                statsDisplay.title = `AI Battle Stats: ${estimation.total.toLocaleString()}\nConfidence: ${(estimation.confidence * 100).toFixed(0)}%\nLevel: ${userData.level}\nLast Action: ${userData.last_action?.relative || 'Unknown'}`;
                
                // Add to member name/link
                memberElement.appendChild(statsDisplay);
                
            } catch (error) {
                SkyviewLogger.warn(`Failed to add stats for member ${userId}:`, error);
            }
        }
        
        static fetchUserData(userId, apiKey) {
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://api.torn.com/user/${userId}?selections=profile,personalstats&key=${apiKey}&comment=faction_stats`,
                    timeout: 15000,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) {
                                SkyviewLogger.warn(`API error for user ${userId}: ${data.error.error}`);
                                resolve(null);
                                return;
                            }
                            resolve(data);
                        } catch (e) {
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        }
            
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
        statusDiv.innerHTML = '🦉 Skyview v4.1.0 Loaded';
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