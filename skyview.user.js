// ==UserScript==
// @name         BOS
// @namespace    Brother Owl's Skyview
// @version      3.2.8
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
            this.log('🦉 Brother Owl Skyview v3.2.8 - Initializing...');
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
                            userscriptVersion: '3.2.8'
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
                // Extract comprehensive player info from page
                const playerInfo = this.extractPlayerInfo();
                this.log(`🔍 Scraped player data: ${JSON.stringify(playerInfo)}`);
                
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
                
                // Perform actual Brother Owl intelligence analysis
                const intelligenceData = await this.getBrotherOwlIntelligence(playerInfo);
                
                // Get battle stats analysis (from backend or local estimation)
                const analysisData = intelligenceData || this.generateBattleStatsEstimate(playerInfo);
                
                statsContent.innerHTML = `
                    <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 8px;">
                        <div><strong>Battle Rating:</strong> <span style="color: #4CAF50;">${analysisData.battleRating}</span></div>
                        <div><strong>Fair Fight:</strong> <span style="color: #FFC107;">${analysisData.fairFightChance}</span></div>
                        <div><strong>Activity:</strong> <span style="color: #2196F3;">${analysisData.activityStatus}</span></div>
                    </div>
                    <div style="margin-bottom: 5px; font-size: 11px; color: #666;">
                        <div><strong>Total Stats:</strong> ${analysisData.totalStats}</div>
                        <div style="margin-top: 2px;">${analysisData.breakdown}</div>
                    </div>
                    <div style="font-size: 10px; opacity: 0.7;">
                        ${playerInfo.playerName} [Level ${playerInfo.level}] • ${analysisData.statsFound ? 'Scraped' : 'Estimated'} • ${new Date().toLocaleTimeString()}
                    </div>
                `;
                
            } catch (error) {
                this.logError('Battle stats analysis failed', error);
                // Even on error, provide basic estimates based on scraped data
                const playerInfo = this.extractPlayerInfo();
                const fallbackStats = this.generateBattleStatsEstimate(playerInfo);
                statsContent.innerHTML = `
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div><strong>Battle Rating:</strong> <span style="color: #4CAF50;">${fallbackStats.battleRating}</span></div>
                        <div><strong>Fair Fight:</strong> <span style="color: #FFC107;">${fallbackStats.fairFightChance}</span></div>
                        <div><strong>Activity:</strong> <span style="color: #2196F3;">${fallbackStats.activityStatus}</span></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
                        Basic estimate • ${new Date().toLocaleTimeString()}
                    </div>
                `;
            }
        }
        
        async getBrotherOwlIntelligence(playerInfo) {
            if (!this.isAuthenticated || !this.currentEndpoint) {
                return null;
            }
            
            try {
                this.log('🧠 Requesting Brother Owl intelligence analysis...');
                const response = await this.makeRequest(`${this.currentEndpoint}/api/skyview-intelligence`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        apiKey: this.apiKey,
                        playerData: playerInfo,
                        analysisType: 'battle-stats-estimation'
                    })
                });
                
                if (response && response.success) {
                    this.log('✅ Intelligence analysis received');
                    return response.intelligence;
                }
            } catch (error) {
                this.log(`⚠️ Intelligence service unavailable: ${error.message}`);
            }
            return null;
        }
        
        generateBattleStatsEstimate(playerInfo) {
            this.log('🧮 Advanced battle analysis initiated...');
            
            const battleStats = playerInfo.battleStats;
            const profileIntel = playerInfo.profileIntelligence;
            const factionData = playerInfo.factionData;
            
            let analysisData = {};
            
            // If we have actual battle stats, analyze them
            if (battleStats.found && battleStats.confidence > 70) {
                const total = battleStats.total || (battleStats.strength + battleStats.defense + battleStats.speed + battleStats.dexterity);
                
                analysisData = {
                    battleRating: this.categorizeBattleStats(total),
                    fairFightChance: this.calculateFairFightChance(total),
                    activityStatus: this.determineActivityStatus(profileIntel),
                    statsFound: true,
                    totalStats: total ? total.toLocaleString() : 'Calculating...',
                    breakdown: `STR: ${battleStats.strength?.toLocaleString() || '?'} | DEF: ${battleStats.defense?.toLocaleString() || '?'} | SPD: ${battleStats.speed?.toLocaleString() || '?'} | DEX: ${battleStats.dexterity?.toLocaleString() || '?'}`,
                    confidence: `${battleStats.confidence}% confidence`
                };
            } else {
                // Use PVP/battle-related data for estimation when stats can't be scraped
                const battleDataEstimate = this.estimateFromBattleData(playerInfo);
                
                analysisData = {
                    battleRating: battleDataEstimate.threatLevel,
                    fairFightChance: battleDataEstimate.winChance,
                    activityStatus: this.determineActivityStatus(profileIntel),
                    statsFound: false,
                    totalStats: battleDataEstimate.estimatedRange,
                    breakdown: battleDataEstimate.analysisMethod,
                    confidence: battleDataEstimate.confidence
                };
            }
            
            this.log(`✅ Analysis complete: ${analysisData.battleRating}, confidence: ${analysisData.confidence}`);
            return analysisData;
        }

        estimateFromBattleData(playerInfo) {
            this.log('⚔️ Estimating battle stats from PVP/battle data...');
            
            const level = playerInfo.level || 1;
            const profileIntel = playerInfo.profileIntelligence;
            
            // Scrape for actual battle-related data from the profile
            let battleDataPoints = [];
            let estimatedTotal = 0;
            let confidence = 'Battle data analysis';
            
            // Look for attack/defense wins/losses data
            const attackData = this.scrapeBattlePerformanceData();
            if (attackData.found) {
                battleDataPoints.push('Attack Record');
                // High win rate suggests strong stats
                if (attackData.winRate > 0.8) estimatedTotal += 200000;
                else if (attackData.winRate > 0.6) estimatedTotal += 150000;
                else if (attackData.winRate > 0.4) estimatedTotal += 100000;
                else estimatedTotal += 50000;
            }
            
            // Look for honor/respect points (from PVP)
            const honorData = this.scrapeHonorData();
            if (honorData.found) {
                battleDataPoints.push('Honor Points');
                // Honor typically comes from successful fights
                if (honorData.points > 10000) estimatedTotal += 300000;
                else if (honorData.points > 5000) estimatedTotal += 200000;
                else if (honorData.points > 1000) estimatedTotal += 100000;
                else estimatedTotal += 50000;
            }
            
            // Look for battle skills/experience
            const battleSkills = this.scrapeBattleSkills();
            if (battleSkills.found) {
                battleDataPoints.push('Battle Skills');
                estimatedTotal += battleSkills.skillLevel * 1000;
            }
            
            // Look for war participation history
            const warHistory = this.scrapeWarHistory();
            if (warHistory.found) {
                battleDataPoints.push('War Participation');
                estimatedTotal += warHistory.participationScore * 50000;
            }
            
            // Look for bounty/hit completion data
            const bountyData = this.scrapeBountyData();
            if (bountyData.found) {
                battleDataPoints.push('Bounty Success');
                estimatedTotal += bountyData.successRate * 100000;
            }
            
            // Fallback to level-based estimation only if no battle data found
            if (battleDataPoints.length === 0) {
                this.log('⚠️ No battle data found, using conservative level-based estimate');
                estimatedTotal = Math.max(level * 2000, 10000); // Very conservative
                battleDataPoints.push('Level-based (no battle data)');
                confidence = 'Limited data available';
            }
            
            // Categorize threat level based on estimated total
            let threatLevel;
            if (estimatedTotal < 50000) threatLevel = 'Low Threat';
            else if (estimatedTotal < 150000) threatLevel = 'Moderate Threat';
            else if (estimatedTotal < 300000) threatLevel = 'High Threat';
            else if (estimatedTotal < 500000) threatLevel = 'Elite Fighter';
            else threatLevel = 'Legendary';
            
            // Calculate win chance
            let winChance;
            const avgPlayerStats = 250000;
            const ratio = avgPlayerStats / estimatedTotal;
            if (ratio > 1.5) winChance = '~75%';
            else if (ratio > 1.2) winChance = '~60%';
            else if (ratio > 0.8) winChance = '~45%';
            else if (ratio > 0.5) winChance = '~30%';
            else winChance = '~15%';
            
            return {
                threatLevel,
                winChance,
                estimatedRange: '~' + Math.floor(estimatedTotal * 0.8).toLocaleString() + ' - ' + Math.floor(estimatedTotal * 1.2).toLocaleString(),
                analysisMethod: 'Battle analysis: ' + battleDataPoints.join(', '),
                confidence
            };
        }
        
        scrapeBattlePerformanceData() {
            // Look for attack/defense records on profile
            const battleElements = document.querySelectorAll('*');
            let attackWins = 0, attackLosses = 0, found = false;
            
            battleElements.forEach(element => {
                const text = element.textContent || '';
                const attackWinMatch = text.match(/attack(?:s)?s*won[:s]*(d+)/i);
                const attackLossMatch = text.match(/attack(?:s)?s*lost[:s]*(d+)/i);
                
                if (attackWinMatch) {
                    attackWins = parseInt(attackWinMatch[1]);
                    found = true;
                }
                if (attackLossMatch) {
                    attackLosses = parseInt(attackLossMatch[1]);
                    found = true;
                }
            });
            
            const winRate = attackWins + attackLosses > 0 ? attackWins / (attackWins + attackLosses) : 0;
            return { found, winRate, wins: attackWins, losses: attackLosses };
        }
        
        scrapeHonorData() {
            // Look for honor/respect points
            const elements = document.querySelectorAll('*');
            let honorPoints = 0, found = false;
            
            elements.forEach(element => {
                const text = element.textContent || '';
                const honorMatch = text.match(/honor[:s]*(d{1,3}(?:,d{3})*)/i) || 
                                 text.match(/respect[:s]*(d{1,3}(?:,d{3})*)/i);
                
                if (honorMatch) {
                    honorPoints = parseInt(honorMatch[1].replace(/,/g, ''));
                    found = true;
                }
            });
            
            return { found, points: honorPoints };
        }
        
        scrapeBattleSkills() {
            // Look for fighting/battle skill levels
            const elements = document.querySelectorAll('*');
            let skillLevel = 0, found = false;
            
            elements.forEach(element => {
                const text = element.textContent || '';
                const skillMatch = text.match(/(?:fighting|combat|martial)s*(?:skill|level)[:s]*(d+)/i);
                
                if (skillMatch) {
                    skillLevel = parseInt(skillMatch[1]);
                    found = true;
                }
            });
            
            return { found, skillLevel };
        }
        
        scrapeWarHistory() {
            // Look for war participation indicators
            const elements = document.querySelectorAll('*');
            let participationScore = 0, found = false;
            
            elements.forEach(element => {
                const text = element.textContent || '';
                if (text.toLowerCase().includes('war') && text.toLowerCase().includes('won')) {
                    participationScore += 1;
                    found = true;
                } else if (text.toLowerCase().includes('battle') && text.toLowerCase().includes('veteran')) {
                    participationScore += 2;
                    found = true;
                }
            });
            
            return { found, participationScore };
        }
        
        scrapeBountyData() {
            // Look for bounty completion data
            const elements = document.querySelectorAll('*');
            let successRate = 0, found = false;
            
            elements.forEach(element => {
                const text = element.textContent || '';
                const bountyMatch = text.match(/bounty[:s]*(d+)/i);
                
                if (bountyMatch) {
                    const bountyCount = parseInt(bountyMatch[1]);
                    successRate = Math.min(bountyCount / 100, 1.0); // Normalize to 0-1
                    found = true;
                }
            });
            
            return { found, successRate };
        }
        
        categorizeBattleStats(totalStats) {
            // Pure battle stats based categorization - no level dependency
            if (totalStats < 10000) return 'Minimal Threat';
            else if (totalStats < 50000) return 'Low Threat';
            else if (totalStats < 200000) return 'Moderate Threat';
            else if (totalStats < 500000) return 'High Threat';
            else if (totalStats < 1000000) return 'Elite Fighter';
            else if (totalStats < 5000000) return 'Legendary';
            else return 'Mythical';
        }
        
        calculateFairFightChance(totalStats) {
            // Fair fight calculation based on realistic stat comparison
            // Assume average active player has around 250k total stats
            const averagePlayerStats = 250000;
            const ratio = averagePlayerStats / totalStats;
            
            let chance;
            if (ratio > 2.0) chance = '~90%';
            else if (ratio > 1.5) chance = '~75%';
            else if (ratio > 1.2) chance = '~65%';
            else if (ratio > 0.8) chance = '~50%';
            else if (ratio > 0.5) chance = '~35%';
            else if (ratio > 0.3) chance = '~20%';
            else chance = '~10%';
            
            return chance;
        }
        
        determineActivityStatus(intelligence) {
            if (!intelligence || !intelligence.lastAction) return 'Activity Unknown';
            
            const lastAction = intelligence.lastAction.toLowerCase();
            if (lastAction.includes('online')) return 'Currently Online';
            else if (lastAction.includes('minute')) return 'Recently Active';
            else if (lastAction.includes('hour')) return 'Active Today';
            else if (lastAction.includes('day')) return 'Active This Week';
            else return 'Inactive';
        }
        
        extractPlayerInfo() {
            this.log('🔍 Starting comprehensive battle stats scraping...');
            
            // Basic player identification
            const playerId = window.location.href.match(/XID=(d+)/)?.[1] || 
                           document.querySelector('[href*="XID="]')?.href.match(/XID=(d+)/)?.[1] ||
                           document.querySelector('input[name="XID"]')?.value;
            
            const playerName = document.querySelector('.username, .player-name, h4, .profile-wrapper h4, [class*="name"], .honor-text')?.textContent?.trim() ||
                              document.title?.match(/([^-]+) -/)?.[1]?.trim();
            
            const levelText = document.querySelector('.level, [class*="level"], .profile-wrapper .level, .honor-text')?.textContent;
            const level = levelText?.match(/(d+)/)?.[1] ? parseInt(levelText.match(/(d+)/)[1]) : null;
            
            // BATTLE STATS SCRAPING - Core functionality
            const battleStats = this.scrapeBattleStats();
            
            // Additional profile intelligence
            const profileIntelligence = this.scrapeProfileIntelligence();
            
            // Faction intelligence
            const factionData = this.scrapeFactionData();
            
            const playerData = {
                playerId: playerId || 'unknown',
                playerName: playerName || 'Player',
                level: level || 1,
                battleStats,
                profileIntelligence,
                factionData,
                scrapedAt: new Date().toISOString()
            };
            
            this.log(`✅ Player data extracted: ${playerName} [Level ${level}] - Battle Stats: ${battleStats.found ? 'Found' : 'Estimated'}`);
            return playerData;
        }
        
        scrapeBattleStats() {
            this.log('⚔️ Comprehensive battle stats extraction initiated...');
            
            const battleStats = {
                strength: null,
                defense: null, 
                speed: null,
                dexterity: null,
                total: null,
                found: false,
                method: 'none',
                confidence: 0
            };
            
            // Method 1: Aggressive DOM scraping - ALL elements
            this.log('🔍 Method 1: Aggressive DOM scraping');
            const allElements = document.querySelectorAll('*');
            const statPatterns = {
                strength: /str(?:ength)?[:=s]*(d{1,3}(?:,d{3})*)/i,
                defense: /def(?:en[cs]e)?[:=s]*(d{1,3}(?:,d{3})*)/i,
                speed: /sp(?:eed|d)[:=s]*(d{1,3}(?:,d{3})*)/i,
                dexterity: /dex(?:terity)?[:=s]*(d{1,3}(?:,d{3})*)/i
            };
            
            allElements.forEach(element => {
                const text = element.textContent || element.innerText || '';
                const attributes = Array.from(element.attributes || []).map(a => `${a.name}="${a.value}"`).join(' ');
                const fullText = text + ' ' + attributes;
                
                Object.entries(statPatterns).forEach(([statType, pattern]) => {
                    if (!battleStats[statType]) {
                        const match = fullText.match(pattern);
                        if (match && match[1]) {
                            const value = parseInt(match[1].replace(/,/g, ''));
                            if (value > 0 && value < 10000000) { // Reasonable bounds
                                battleStats[statType] = value;
                                battleStats.found = true;
                                battleStats.method = 'dom-pattern-match';
                                battleStats.confidence = Math.max(battleStats.confidence, 85);
                                this.log(`✅ Found ${statType}: ${value} via DOM pattern`);
                            }
                        }
                    }
                });
            });
            
            // Method 2: JavaScript variable extraction
            if (!battleStats.found || battleStats.confidence < 90) {
                this.log('🔍 Method 2: JavaScript variable extraction');
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    const content = script.textContent || '';
                    
                    // Look for common JS variable patterns
                    const jsPatterns = [
                        /"stats":s*{[^}]*"strength":s*(d+)[^}]*"defense":s*(d+)[^}]*"speed":s*(d+)[^}]*"dexterity":s*(d+)/,
                        /battleStatss*[:=]s*{s*str:s*(d+),s*def:s*(d+),s*spd:s*(d+),s*dex:s*(d+)/,
                        /player.statss*=s*{s*strength:s*(d+),s*defense:s*(d+),s*speed:s*(d+),s*dexterity:s*(d+)/,
                        /vars+statss*=s*[(d+),s*(d+),s*(d+),s*(d+)]/
                    ];
                    
                    jsPatterns.forEach((pattern, index) => {
                        const match = content.match(pattern);
                        if (match && !battleStats.found) {
                            battleStats.strength = parseInt(match[1]);
                            battleStats.defense = parseInt(match[2]);
                            battleStats.speed = parseInt(match[3]);
                            battleStats.dexterity = parseInt(match[4]);
                            battleStats.found = true;
                            battleStats.method = `js-pattern-${index + 1}`;
                            battleStats.confidence = 95;
                            this.log('🎯 Extracted stats from JavaScript variables');
                        }
                    });
                });
            }
            
            // Method 3: Page source and meta content analysis
            if (!battleStats.found) {
                this.log('🔍 Method 3: Page source and meta content analysis');
                
                // Check meta tags for battle stats
                const metaTags = document.querySelectorAll('meta');
                metaTags.forEach(meta => {
                    const content = meta.getAttribute('content') || '';
                    const name = meta.getAttribute('name') || '';
                    
                    // Look for stats in meta content
                    Object.entries(statPatterns).forEach(([statType, pattern]) => {
                        if (!battleStats[statType]) {
                            const match = (content + ' ' + name).match(pattern);
                            if (match && match[1]) {
                                const value = parseInt(match[1].replace(/,/g, ''));
                                if (value > 0 && value < 10000000) {
                                    battleStats[statType] = value;
                                    battleStats.found = true;
                                    battleStats.method = 'meta-content';
                                    battleStats.confidence = Math.max(battleStats.confidence, 75);
                                    this.log(`✅ Found ${statType}: ${value} in meta content`);
                                }
                            }
                        }
                    });
                });
                
                // Check HTML comments for stats
                const htmlSource = document.documentElement.outerHTML;
                const commentPattern = /<!--[sS]*?-->/g;
                let commentMatch;
                while ((commentMatch = commentPattern.exec(htmlSource)) !== null) {
                    const comment = commentMatch[0];
                    Object.entries(statPatterns).forEach(([statType, pattern]) => {
                        if (!battleStats[statType]) {
                            const match = comment.match(pattern);
                            if (match && match[1]) {
                                const value = parseInt(match[1].replace(/,/g, ''));
                                if (value > 0 && value < 10000000) {
                                    battleStats[statType] = value;
                                    battleStats.found = true;
                                    battleStats.method = 'html-comments';
                                    battleStats.confidence = Math.max(battleStats.confidence, 70);
                                    this.log(`✅ Found ${statType}: ${value} in HTML comments`);
                                }
                            }
                        }
                    });
                }
            }
            
            // Method 4: CSS computed values and styling clues
            if (!battleStats.found) {
                this.log('🔍 Method 4: CSS and styling analysis');
                const elementsWithNumbers = document.querySelectorAll('[data-stat], [data-value], .stat-value, .battle-stat');
                elementsWithNumbers.forEach(element => {
                    const dataAttrs = ['data-stat', 'data-value', 'data-strength', 'data-defense', 'data-speed', 'data-dexterity'];
                    dataAttrs.forEach(attr => {
                        const value = element.getAttribute(attr);
                        if (value && /^d+$/.test(value)) {
                            const num = parseInt(value);
                            if (num > 1000) { // Likely a battle stat
                                const attrLower = attr.toLowerCase();
                                if (attrLower.includes('str') && !battleStats.strength) battleStats.strength = num;
                                else if (attrLower.includes('def') && !battleStats.defense) battleStats.defense = num;
                                else if (attrLower.includes('spd') || attrLower.includes('speed')) battleStats.speed = num;
                                else if (attrLower.includes('dex') && !battleStats.dexterity) battleStats.dexterity = num;
                                
                                if (num > 0) {
                                    battleStats.found = true;
                                    battleStats.method = 'css-data-attributes';
                                    battleStats.confidence = 80;
                                }
                            }
                        }
                    });
                });
            }
            
            // Method 5: Form data and input value extraction
            if (!battleStats.found) {
                this.log('🔍 Method 5: Form data and input value extraction');
                
                // Check all form elements and inputs
                const formElements = document.querySelectorAll('input, textarea, select, option');
                formElements.forEach(element => {
                    const value = element.value || element.textContent || '';
                    const name = (element.name || element.id || '').toLowerCase();
                    const placeholder = (element.placeholder || '').toLowerCase();
                    const allText = value + ' ' + name + ' ' + placeholder;
                    
                    Object.entries(statPatterns).forEach(([statType, pattern]) => {
                        if (!battleStats[statType]) {
                            const match = allText.match(pattern);
                            if (match && match[1]) {
                                const num = parseInt(match[1].replace(/,/g, ''));
                                if (num > 100 && num < 10000000) {
                                    battleStats[statType] = num;
                                    battleStats.found = true;
                                    battleStats.method = 'form-data-extraction';
                                    battleStats.confidence = Math.max(battleStats.confidence, 80);
                                    this.log(`✅ Found ${statType}: ${num} in form data`);
                                }
                            }
                        }
                    });
                });
                
                // Check for JSON data in page
                const jsonPattern = /"(?:str|strength|def|defense|spd|speed|dex|dexterity)":s*(d+)/gi;
                let jsonMatch;
                while ((jsonMatch = jsonPattern.exec(document.documentElement.innerHTML)) !== null) {
                    const value = parseInt(jsonMatch[1]);
                    if (value > 100 && value < 10000000) {
                        // Try to identify which stat this is
                        const contextBefore = document.documentElement.innerHTML.substring(Math.max(0, jsonMatch.index - 50), jsonMatch.index);
                        const contextAfter = document.documentElement.innerHTML.substring(jsonMatch.index, jsonMatch.index + 100);
                        const context = (contextBefore + contextAfter).toLowerCase();
                        
                        if (context.includes('str') && !battleStats.strength) {
                            battleStats.strength = value;
                            battleStats.found = true;
                            battleStats.method = 'json-data-extraction';
                            battleStats.confidence = Math.max(battleStats.confidence, 85);
                        } else if (context.includes('def') && !battleStats.defense) {
                            battleStats.defense = value;
                            battleStats.found = true;
                            battleStats.method = 'json-data-extraction';
                            battleStats.confidence = Math.max(battleStats.confidence, 85);
                        } else if (context.includes('spd') || context.includes('speed')) {
                            if (!battleStats.speed) {
                                battleStats.speed = value;
                                battleStats.found = true;
                                battleStats.method = 'json-data-extraction';
                                battleStats.confidence = Math.max(battleStats.confidence, 85);
                            }
                        } else if (context.includes('dex') && !battleStats.dexterity) {
                            battleStats.dexterity = value;
                            battleStats.found = true;
                            battleStats.method = 'json-data-extraction';
                            battleStats.confidence = Math.max(battleStats.confidence, 85);
                        }
                    }
                }
            }
            
            // Calculate total if we have individual stats
            if (battleStats.strength && battleStats.defense && battleStats.speed && battleStats.dexterity) {
                battleStats.total = battleStats.strength + battleStats.defense + battleStats.speed + battleStats.dexterity;
                battleStats.confidence = Math.max(battleStats.confidence, 90);
            }
            
            if (battleStats.found) {
                this.log(`✅ Battle stats extracted via ${battleStats.method} (confidence: ${battleStats.confidence}%)`);
            } else {
                this.log('❌ No battle stats found through scraping - stats may be completely private');
            }
            
            return battleStats;
        }
        
        scrapeProfileIntelligence() {
            // Extract additional intelligence data
            const intelligence = {
                lastAction: null,
                status: null,
                networth: null,
                criminalRecord: null,
                awards: [],
                properties: null
            };
            
            // Last action scraping
            const actionElements = document.querySelectorAll('.last-action, [class*="last"], .status, [class*="status"]');
            actionElements.forEach(element => {
                const text = element.textContent?.trim();
                if (text && (text.includes('ago') || text.includes('Online') || text.includes('Offline'))) {
                    intelligence.lastAction = text;
                }
            });
            
            // Networth scraping
            const netElements = document.querySelectorAll('td, div, span');
            netElements.forEach(element => {
                const text = element.textContent?.toLowerCase();
                if (text?.includes('networth') || text?.includes('net worth')) {
                    const value = text.match(/$?[d,]+/)?.[0]?.replace(/[$,]/g, '');
                    if (value) {
                        intelligence.networth = parseInt(value);
                    }
                }
            });
            
            return intelligence;
        }
        
        scrapeFactionData() {
            const factionData = {
                name: null,
                id: null,
                position: null,
                respect: null
            };
            
            const factionLink = document.querySelector('[href*="factions.php"], [href*="faction"]');
            if (factionLink) {
                factionData.name = factionLink.textContent?.trim();
                factionData.id = factionLink.href?.match(/ID=(d+)/)?.[1];
            }
            
            // Look for faction position
            const posElements = document.querySelectorAll('td, div, span');
            posElements.forEach(element => {
                const text = element.textContent?.toLowerCase();
                if (text?.includes('position') || text?.includes('rank')) {
                    const nextElement = element.nextElementSibling;
                    if (nextElement) {
                        factionData.position = nextElement.textContent?.trim();
                    }
                }
            });
            
            return factionData;
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