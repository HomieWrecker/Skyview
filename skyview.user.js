// ==UserScript==
// @name         BOS
// @namespace    Skyview  
// @version      5.0.2
// @author       Homiewrecker
// @description  Grand Code's personal battle eye
// @icon         🦉
// @match        https://www.torn.com/profiles.php?*
// @match        https://www.torn.com/factions.php*
// @match        https://www.torn.com/loader.php?sid=attack&user2ID=*
// @match        https://www.torn.com/hospitalview.php*
// @match        https://www.torn.com/markets.php*
// @connect      api.torn.com
// @connect      www.tornstats.com
// @connect      *.replit.app
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// @downloadURL  https://raw.githubusercontent.com/HomieWrecker/Skyview/main/skyview.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    // Enhanced Storage System with Learning Engine
    const storage = {
        get: (key) => GM_getValue(key),
        set: (key, value) => GM_setValue(key, value),
        remove: (key) => GM_deleteValue(key),
        
        // AI Learning Data Storage
        getPlayerData: (userId) => {
            const data = GM_getValue(`player_${userId}`, '{}');
            return JSON.parse(data);
        },
        
        savePlayerData: (userId, data) => {
            const existing = storage.getPlayerData(userId);
            const updated = { ...existing, ...data, lastUpdated: Date.now() };
            GM_setValue(`player_${userId}`, JSON.stringify(updated));
        },
        
        // Battle Stats Learning Cache
        getBattleStatsHistory: (userId) => {
            const history = GM_getValue(`stats_history_${userId}`, '[]');
            return JSON.parse(history);
        },
        
        addBattleStatsEntry: (userId, stats, level, timestamp = Date.now()) => {
            const history = storage.getBattleStatsHistory(userId);
            history.push({ stats, level, timestamp });
            
            // Keep only last 50 entries for performance
            if (history.length > 50) {
                history.splice(0, history.length - 50);
            }
            
            GM_setValue(`stats_history_${userId}`, JSON.stringify(history));
        }
    };
    
    // Enhanced Logger System
    const SkyviewLogger = {
        info: (msg, ...args) => console.log(`[SKYVIEW] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[SKYVIEW] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[SKYVIEW] ${msg}`, ...args),
        debug: (msg, ...args) => console.debug(`[SKYVIEW] ${msg}`, ...args)
    };
    
    // FF Scouter Color Coding System
    const FFScouter = {
        getFFColor: (fairFight) => {
            if (fairFight >= 3.0) return '#FF0000'; // Red - Very High
            if (fairFight >= 2.5) return '#FF6600'; // Orange-Red - High  
            if (fairFight >= 2.0) return '#FF9900'; // Orange - Medium-High
            if (fairFight >= 1.5) return '#FFCC00'; // Yellow-Orange - Medium
            if (fairFight >= 1.2) return '#FFFF00'; // Yellow - Fair
            if (fairFight >= 1.0) return '#CCFF00'; // Yellow-Green - Low
            if (fairFight >= 0.8) return '#99FF00'; // Light Green - Very Low
            if (fairFight >= 0.5) return '#66FF00'; // Green - Minimal
            return '#00FF00'; // Bright Green - No Bonus
        },
        
        getFFText: (fairFight) => {
            if (fairFight >= 3.0) return 'VERY HIGH';
            if (fairFight >= 2.5) return 'HIGH';  
            if (fairFight >= 2.0) return 'MEDIUM-HIGH';
            if (fairFight >= 1.5) return 'MEDIUM';
            if (fairFight >= 1.2) return 'FAIR';
            if (fairFight >= 1.0) return 'LOW';
            if (fairFight >= 0.8) return 'VERY LOW';
            if (fairFight >= 0.5) return 'MINIMAL';
            return 'NO BONUS';
        },
        
        calculateFF: (targetStats, ownStats) => {
            if (!targetStats || !ownStats || ownStats === 0) return 1.0;
            const ratio = targetStats / ownStats;
            
            if (ratio >= 4.0) return 3.0;
            if (ratio >= 2.67) return 2.5;
            if (ratio >= 2.0) return 2.0;
            if (ratio >= 1.5) return 1.5;
            if (ratio >= 1.25) return 1.25;
            if (ratio >= 1.0) return 1.0;
            if (ratio >= 0.8) return 0.75;
            if (ratio >= 0.6) return 0.5;
            return 0.25;
        }
    };
    
    // Advanced AI Battle Stats Learning Engine
    const AIBattleStatsEngine = {
        // Enhanced estimation using multiple data points
        estimate: (userData, ownData = null) => {
            const level = userData.level;
            const lastAction = userData.last_action?.relative;
            const userId = userData.player_id;
            
            // Get historical data for this player
            const history = storage.getBattleStatsHistory(userId);
            const playerData = storage.getPlayerData(userId);
            
            // Multi-method estimation
            const methods = {
                levelBased: this.levelBasedEstimation(level),
                activityWeighted: this.activityWeightedEstimation(level, lastAction),
                historicalTrend: this.historicalTrendEstimation(history, level),
                factionContext: this.factionContextEstimation(userData),
                enhancementAnalysis: this.enhancementBasedEstimation(userData)
            };
            
            // Weighted combination of methods
            const weights = {
                levelBased: 0.3,
                activityWeighted: 0.25,
                historicalTrend: history.length > 0 ? 0.25 : 0,
                factionContext: 0.1,
                enhancementAnalysis: userData.personalstats ? 0.1 : 0
            };
            
            let totalWeight = 0;
            let weightedSum = 0;
            
            Object.keys(methods).forEach(method => {
                if (weights[method] > 0 && methods[method] > 0) {
                    weightedSum += methods[method] * weights[method];
                    totalWeight += weights[method];
                }
            });
            
            const finalEstimate = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : methods.levelBased;
            
            // Calculate confidence based on data availability
            let confidence = 0.6; // Base confidence
            if (history.length > 5) confidence += 0.2;
            if (userData.personalstats) confidence += 0.1;
            if (lastAction && lastAction.includes('minute')) confidence += 0.1;
            
            confidence = Math.min(confidence, 0.95);
            
            // Fair Fight calculation if own data available
            let fairFight = null;
            if (ownData && ownData.total) {
                fairFight = FFScouter.calculateFF(finalEstimate, ownData.total);
            }
            
            return {
                total: finalEstimate,
                confidence: confidence,
                methods: methods,
                fairFight: fairFight,
                methodology: this.getMethodologyText(methods, weights, history.length)
            };
        },
        
        levelBasedEstimation: (level) => {
            // Enhanced level-based formula with variance
            const baseStats = Math.pow(level, 2.3) * 125;
            const variance = 0.15; // 15% variance
            return Math.round(baseStats * (1 + (Math.random() - 0.5) * variance));
        },
        
        activityWeightedEstimation: (level, lastAction) => {
            let multiplier = 1.0;
            
            if (!lastAction) return this.levelBasedEstimation(level) * 0.9;
            
            if (lastAction.includes('minute')) multiplier = 1.4; // Very active
            else if (lastAction.includes('hour')) {
                const hours = parseInt(lastAction.match(/\d+/));
                if (hours <= 2) multiplier = 1.3;
                else if (hours <= 12) multiplier = 1.1;
                else multiplier = 0.9;
            } else if (lastAction.includes('day')) {
                const days = parseInt(lastAction.match(/\d+/));
                if (days <= 1) multiplier = 0.8;
                else if (days <= 7) multiplier = 0.6;
                else multiplier = 0.4;
            }
            
            return Math.round(this.levelBasedEstimation(level) * multiplier);
        },
        
        historicalTrendEstimation: (history, currentLevel) => {
            if (history.length < 2) return 0;
            
            // Find most recent stats and calculate growth trend
            const recent = history.slice(-5);
            const avgGrowthPerLevel = recent.reduce((sum, entry, index) => {
                if (index === 0) return 0;
                const levelDiff = entry.level - recent[index - 1].level;
                const statsDiff = entry.stats - recent[index - 1].stats;
                return sum + (levelDiff > 0 ? statsDiff / levelDiff : 0);
            }, 0) / Math.max(recent.length - 1, 1);
            
            const lastEntry = recent[recent.length - 1];
            const levelIncrease = currentLevel - lastEntry.level;
            
            return Math.round(lastEntry.stats + (avgGrowthPerLevel * levelIncrease));
        },
        
        factionContextEstimation: (userData) => {
            // Estimate based on faction reputation and size
            const factionName = userData.faction?.faction_name;
            if (!factionName) return 0;
            
            // Higher stats for well-known war factions
            const warFactions = ['Subversive Alliance', 'Breakfast Club', 'Eternal', 'DarkSyde', 'Umbrella', 'Grand Code'];
            const isWarFaction = warFactions.some(name => factionName.includes(name));
            
            return isWarFaction ? this.levelBasedEstimation(userData.level) * 1.2 : 0;
        },
        
        enhancementBasedEstimation: (userData) => {
            const stats = userData.personalstats;
            if (!stats) return 0;
            
            // Enhancement usage indicates higher battle stats investment
            const xanUsage = stats.xantaken || 0;
            const refills = stats.refills || 0;
            const enhancers = stats.statenhancersused || 0;
            
            const enhancementScore = (xanUsage * 0.3) + (refills * 0.4) + (enhancers * 0.3);
            const multiplier = 1 + Math.min(enhancementScore / 10000, 0.5); // Max 50% bonus
            
            return Math.round(this.levelBasedEstimation(userData.level) * multiplier);
        },
        
        getMethodologyText: (methods, weights, historyCount) => {
            const primary = Object.keys(methods).reduce((a, b) => 
                (methods[a] * weights[a] || 0) > (methods[b] * weights[b] || 0) ? a : b
            );
            
            const methodNames = {
                levelBased: 'Level Analysis',
                activityWeighted: 'Activity Pattern',
                historicalTrend: `Historical Trend (${historyCount} data points)`,
                factionContext: 'Faction Analysis',
                enhancementAnalysis: 'Enhancement Analysis'
            };
            
            return methodNames[primary] || 'AI Estimation';
        },
        
        formatNumber: (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
    };
    
    // TSC Companion Utilities Integration
    const TSCUtilities = {
        // Profile page enhancements
        addProfileEnhancements: () => {
            const profileContent = document.querySelector('.profile-container, .user-info-blackbox, .content-wrapper');
            if (!profileContent) return;
            
            const container = document.createElement('div');
            container.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 10px; border-radius: 8px; margin: 10px 0; color: white; font-family: monospace;';
            
            const title = document.createElement('div');
            title.innerHTML = '<strong>🚀 SKYVIEW QUICK UTILITIES</strong>';
            title.style.marginBottom = '8px';
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;';
            
            // Attack button
            const attackBtn = document.createElement('button');
            attackBtn.textContent = '⚔️ Attack';
            attackBtn.style.cssText = 'padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
            attackBtn.addEventListener('click', () => {
                const userId = window.location.search.match(/XID=(\d+)/)?.[1];
                if (userId) window.open('/loader.php?sid=attack&user2ID=' + userId, '_blank');
            });
            
            // Copy link button
            const copyBtn = document.createElement('button');
            copyBtn.textContent = '📋 Copy Link';
            copyBtn.style.cssText = 'padding: 4px 8px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText('https://www.torn.com' + window.location.pathname + window.location.search);
                alert('Profile link copied!');
            });
            
            // Message button
            const messageBtn = document.createElement('button');
            messageBtn.textContent = '💬 Message';
            messageBtn.style.cssText = 'padding: 4px 8px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
            messageBtn.addEventListener('click', () => {
                const userId = window.location.search.match(/XID=(\d+)/)?.[1];
                if (userId) window.open('/messages.php#/p=compose&XID=' + userId, '_blank');
            });
            
            buttonContainer.appendChild(attackBtn);
            buttonContainer.appendChild(copyBtn);
            buttonContainer.appendChild(messageBtn);
            
            container.appendChild(title);
            container.appendChild(buttonContainer);
            
            profileContent.insertBefore(container, profileContent.firstChild);
        },
        
        // Market page enhancements
        addMarketEnhancements: () => {
            const items = document.querySelectorAll('.item, .market-item, [class*="item"]');
            items.forEach(item => {
                const priceElement = item.querySelector('[class*="price"], .price');
                if (priceElement) {
                    const price = parseInt(priceElement.textContent.replace(/[$,]/g, ''));
                    if (price) {
                        const efficiency = this.calculateItemEfficiency(price, item);
                        if (efficiency) {
                            const badge = document.createElement('span');
                            badge.innerHTML = `💡 ${efficiency}`;
                            badge.style.cssText = `
                                background: #f39c12; color: white; padding: 2px 6px; 
                                border-radius: 3px; font-size: 10px; margin-left: 5px;
                            `;
                            priceElement.appendChild(badge);
                        }
                    }
                }
            });
        },
        
        calculateItemEfficiency: (price, itemElement) => {
            // Enhanced item efficiency calculation based on item type
            const itemName = itemElement.textContent.toLowerCase();
            
            if (itemName.includes('xanax')) {
                const efficiency = (price / 1000).toFixed(1);
                return `${efficiency}k/pill`;
            } else if (itemName.includes('energy drink')) {
                const efficiency = (price / 20).toFixed(1);
                return `${efficiency}/E`;
            } else if (itemName.includes('medical')) {
                return 'Medical';
            }
            
            return null;
        },
        
        // Hospital page enhancements
        addHospitalEnhancements: () => {
            const players = document.querySelectorAll('.hospital-player, [class*="player"], .user');
            players.forEach(player => {
                const nameElement = player.querySelector('a[href*="profiles.php"]');
                if (nameElement) {
                    const userId = nameElement.href.match(/XID=(\d+)/)?.[1];
                    if (userId) {
                        const actionButtons = document.createElement('div');
                        actionButtons.innerHTML = `
                            <div style="margin-top: 5px;">
                                <button onclick="window.open('/loader.php?sid=attack&user2ID=${userId}', '_blank')" 
                                        style="padding: 2px 6px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px; margin-right: 3px;">
                                    Attack
                                </button>
                                <button onclick="window.open('/profiles.php?XID=${userId}', '_blank')" 
                                        style="padding: 2px 6px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">
                                    Profile
                                </button>
                            </div>
                        `;
                        player.appendChild(actionButtons);
                    }
                }
            });
        },
        
        // Enhanced faction page utilities  
        addFactionPageUtilities: () => {
            const memberList = document.querySelector('.faction-members, .members-list, [class*="member"]');
            if (memberList) {
                const container = document.createElement('div');
                container.style.cssText = 'background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); padding: 12px; border-radius: 8px; margin: 10px 0; color: white;';
                
                const title = document.createElement('div');
                title.innerHTML = '<strong>🔧 FACTION UTILITIES</strong>';
                title.style.marginBottom = '8px';
                
                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;';
                
                // Export button
                const exportBtn = document.createElement('button');
                exportBtn.textContent = '📊 Export Members';
                exportBtn.style.cssText = 'padding: 6px 12px; background: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer;';
                exportBtn.addEventListener('click', () => TSCUtilities.exportMemberList());
                
                // Activity button
                const activityBtn = document.createElement('button');
                activityBtn.textContent = '📈 Activity Analysis';
                activityBtn.style.cssText = 'padding: 6px 12px; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer;';
                activityBtn.addEventListener('click', () => TSCUtilities.analyzeActivity());
                
                // Bulk profile button
                const bulkBtn = document.createElement('button');
                bulkBtn.textContent = '👥 Bulk Profile';
                bulkBtn.style.cssText = 'padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;';
                bulkBtn.addEventListener('click', () => TSCUtilities.bulkProfile());
                
                buttonContainer.appendChild(exportBtn);
                buttonContainer.appendChild(activityBtn);
                buttonContainer.appendChild(bulkBtn);
                
                container.appendChild(title);
                container.appendChild(buttonContainer);
                
                memberList.insertBefore(container, memberList.firstChild);
            }
        },
        
        exportMemberList: () => {
            const members = [];
            document.querySelectorAll('a[href*="profiles.php?XID="]').forEach(link => {
                const match = link.href.match(/XID=(\d+)/);
                if (match) {
                    members.push({
                        name: link.textContent.trim(),
                        id: match[1],
                        url: link.href
                    });
                }
            });
            
            const csv = 'Name,ID,URL\n' + members.map(m => `"${m.name}",${m.id},${m.url}`).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'faction_members.csv';
            a.click();
            
            URL.revokeObjectURL(url);
        },
        
        analyzeActivity: () => {
            let activeCount = 0;
            let totalCount = 0;
            
            document.querySelectorAll('.last-action, [class*="action"], .member').forEach(element => {
                totalCount++;
                const text = element.textContent.toLowerCase();
                if (text.includes('minute') || text.includes('hour')) {
                    activeCount++;
                }
            });
            
            alert(`Activity Analysis: ${activeCount}/${totalCount} members active recently (${(activeCount/totalCount*100).toFixed(1)}%)`);
        },
        
        bulkProfile: () => {
            const members = Array.from(document.querySelectorAll('a[href*="profiles.php?XID="]'))
                .slice(0, 10)
                .map(link => link.href);
            
            members.forEach((url, index) => {
                setTimeout(() => window.open(url, '_blank'), index * 500);
            });
        }
    };
    
    // Enhanced Attack Page Handler with Complete S.O.A.P. Integration
    class AttackPageHandler {
        static handle() {
            SkyviewLogger.info('Handling attack page with Ultimate S.O.A.P. integration...');
            
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
                // Fetch comprehensive data
                const [targetData, ownData] = await Promise.all([
                    this.fetchUserData(attackId, apiKey, 'profile,personalstats,battlestats,crimes,education,perks'),
                    this.fetchUserData('', apiKey, 'battlestats,profile,personalstats')
                ]);
                
                if (targetData && ownData) {
                    // Try TornStats spy data first
                    const spyData = await this.fetchTornStatsData(attackId, apiKey);
                    
                    let finalStats = null;
                    let dataSource = 'AI Estimation';
                    
                    if (spyData && spyData.spy?.status && spyData.spy.total > 0) {
                        finalStats = spyData.spy;
                        dataSource = 'TornStats Spy Data';
                        
                        // Save spy data to learning engine
                        AIBattleStatsEngine.addBattleStatsEntry(attackId, finalStats.total, targetData.level);
                    } else {
                        // Use AI estimation with learning
                        const estimation = AIBattleStatsEngine.estimate(targetData, ownData);
                        finalStats = { total: estimation.total, confidence: estimation.confidence };
                        dataSource = estimation.methodology;
                    }
                    
                    // Calculate Fair Fight with FF Scouter color coding
                    const fairFight = FFScouter.calculateFF(finalStats.total, ownData.total);
                    const ffColor = FFScouter.getFFColor(fairFight);
                    const ffText = FFScouter.getFFText(fairFight);
                    
                    // Display comprehensive attack intelligence
                    this.displayAttackIntelligence(targetData, ownData, finalStats, spyData, fairFight, ffColor, ffText, dataSource);
                    
                    // Save data for future learning
                    storage.savePlayerData(attackId, {
                        level: targetData.level,
                        faction: targetData.faction?.faction_name,
                        lastAction: targetData.last_action?.relative,
                        estimatedStats: finalStats.total
                    });
                }
            } catch (error) {
                SkyviewLogger.error('Attack page processing failed:', error);
                this.showErrorMessage(error.message);
            }
        }
        
        static fetchUserData(userId, apiKey, selections) {
            return new Promise((resolve, reject) => {
                const url = userId ? 
                    `https://api.torn.com/user/${userId}?selections=${selections}&key=${apiKey}&comment=skyview_ultimate` :
                    `https://api.torn.com/user/?selections=${selections}&key=${apiKey}&comment=skyview_ultimate`;
                    
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
                    onerror: () => reject(new Error('API request failed'))
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
        
        static displayAttackIntelligence(targetData, ownData, finalStats, spyData, fairFight, ffColor, ffText, dataSource) {
            // Enhanced S.O.A.P. style intelligence display
            const diffXan = (targetData.personalstats?.xantaken || 0) - (ownData.personalstats?.xantaken || 0);
            const diffRefill = (targetData.personalstats?.refills || 0) - (ownData.personalstats?.refills || 0);
            const diffCans = (targetData.personalstats?.energydrinkused || 0) - (ownData.personalstats?.energydrinkused || 0);
            const diffSE = (targetData.personalstats?.statenhancersused || 0) - (ownData.personalstats?.statenhancersused || 0);
            
            const formatDiff = (diff, name) => {
                if (diff === 0) return `${name}: <span style="color: #FFFF00">**SAME as you**</span>`;
                const color = diff > 0 ? '#EE4B2B' : '#98FB98';
                const moreOrLess = diff > 0 ? 'MORE' : 'LESS';
                return `${name}: <span style="color: ${color}">**${Math.abs(diff).toLocaleString()} ${moreOrLess} than you**</span>`;
            };
            
            // Job/Company information
            let jobText = 'Unemployed';
            if (targetData.job && targetData.job.company_type > 0) {
                jobText = this.getCompanyName(targetData.job.company_type);
            } else if (targetData.job && targetData.job.job) {
                jobText = targetData.job.job;
            }
            
            // Education analysis
            let educationText = 'No Education Data';
            if (targetData.education_completed && targetData.education_completed.length > 0) {
                const completedCourses = targetData.education_completed.length;
                educationText = `${completedCourses} Courses Completed`;
            }
            
            // Battle experience analysis
            let battleExp = 'Unknown';
            if (targetData.personalstats) {
                const attacks = targetData.personalstats.attackswon || 0;
                const defends = targetData.personalstats.defendslost || 0;
                battleExp = `${attacks.toLocaleString()} Wins / ${defends.toLocaleString()} Losses`;
            }
            
            let content = `
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 20px; border-radius: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: 3px solid #3498db; box-shadow: 0 8px 32px rgba(0,0,0,0.3); margin: 10px 0;">
                
                <div style="text-align: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #3498db; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">🦉 BROTHER OWL ULTIMATE S.O.A.P. v5.0</h3>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    
                    <div style="background: rgba(52, 152, 219, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #3498db;">
                        <h4 style="margin: 0 0 8px 0; color: #3498db;">⚔️ BATTLE INTELLIGENCE</h4>
                        <div style="font-size: 14px; line-height: 1.4;">
                            <strong>Battle Stats:</strong> ${AIBattleStatsEngine.formatNumber(finalStats.total)}<br>
                            <strong>Data Source:</strong> ${dataSource}<br>
                            ${finalStats.confidence ? `<strong>Confidence:</strong> ${(finalStats.confidence * 100).toFixed(0)}%<br>` : ''}
                            <strong>Battle Experience:</strong> ${battleExp}
                        </div>
                    </div>
                    
                    <div style="background: rgba(${ffColor.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(', ')}, 0.2); padding: 12px; border-radius: 8px; border-left: 4px solid ${ffColor};">
                        <h4 style="margin: 0 0 8px 0; color: ${ffColor};">🎯 FAIR FIGHT ANALYSIS</h4>
                        <div style="font-size: 14px; line-height: 1.4;">
                            <strong style="color: ${ffColor}; font-size: 16px;">${fairFight.toFixed(2)}x - ${ffText}</strong><br>
                            <strong>Your Stats:</strong> ${AIBattleStatsEngine.formatNumber(ownData.total)}<br>
                            <strong>Target Stats:</strong> ${AIBattleStatsEngine.formatNumber(finalStats.total)}<br>
                            <strong>Ratio:</strong> ${(finalStats.total / ownData.total).toFixed(2)}:1
                        </div>
                    </div>
                </div>
                
                <div style="background: rgba(231, 76, 60, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #e74c3c; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #e74c3c;">📊 ENHANCEMENT COMPARISON</h4>
                    <div style="font-size: 13px; line-height: 1.3; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div>${formatDiff(diffXan, 'Xanax')}</div>
                        <div>${formatDiff(diffRefill, 'Energy Refills')}</div>
                        <div>${formatDiff(diffCans, 'Energy Drinks')}</div>
                        <div>${formatDiff(diffSE, 'Stat Enhancers')}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    
                    <div style="background: rgba(46, 204, 113, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #2ecc71;">
                        <h4 style="margin: 0 0 8px 0; color: #2ecc71;">👤 TARGET PROFILE</h4>
                        <div style="font-size: 13px; line-height: 1.3;">
                            <strong>Name:</strong> ${targetData.name} [${targetData.player_id}]<br>
                            <strong>Level:</strong> ${targetData.level}<br>
                            <strong>Last Action:</strong> ${targetData.last_action?.relative || 'Unknown'}<br>
                            <strong>Status:</strong> ${targetData.status?.description || 'Unknown'}
                        </div>
                    </div>
                    
                    <div style="background: rgba(155, 89, 182, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #9b59b6;">
                        <h4 style="margin: 0 0 8px 0; color: #9b59b6;">🏢 CAREER & FACTION</h4>
                        <div style="font-size: 13px; line-height: 1.3;">
                            <strong>Faction:</strong> ${targetData.faction?.faction_name || 'None'}<br>
                            <strong>Job:</strong> ${jobText}<br>
                            <strong>Education:</strong> ${educationText}<br>
                            ${targetData.competition ? `<strong>Competition:</strong> ${targetData.competition.name}<br>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // Add TornStats specific data if available
            if (spyData && spyData.spy?.status) {
                content += `
                <div style="background: rgba(241, 196, 15, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #f1c40f; margin-top: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #f1c40f;">🕵️ TORNSTATS SPY DATA</h4>
                    <div style="font-size: 13px; line-height: 1.3; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
                        ${spyData.spy.strength > 0 ? `<div><strong>STR:</strong> ${AIBattleStatsEngine.formatNumber(spyData.spy.strength)}</div>` : ''}
                        ${spyData.spy.defense > 0 ? `<div><strong>DEF:</strong> ${AIBattleStatsEngine.formatNumber(spyData.spy.defense)}</div>` : ''}
                        ${spyData.spy.speed > 0 ? `<div><strong>SPD:</strong> ${AIBattleStatsEngine.formatNumber(spyData.spy.speed)}</div>` : ''}
                        ${spyData.spy.dexterity > 0 ? `<div><strong>DEX:</strong> ${AIBattleStatsEngine.formatNumber(spyData.spy.dexterity)}</div>` : ''}
                        <div><strong>Spy Date:</strong> ${new Date(spyData.spy.timestamp * 1000).toLocaleDateString()}</div>
                        <div><strong>Age:</strong> ${Math.floor((Date.now() - spyData.spy.timestamp * 1000) / (1000 * 60 * 60 * 24))} days</div>
                    </div>
                </div>
                `;
            }
            
            content += `</div>`;
            
            this.addToAttackPage(content);
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
        
        static addToAttackPage(content) {
            const selectors = [
                '.dialogButtons___nX4Bz',
                '.dialog-buttons', 
                '[class*="dialog"][class*="button"]',
                '.attack-dialog',
                '.user-info-blackbox'
            ];
            
            let dialogButtons = null;
            for (const selector of selectors) {
                dialogButtons = document.querySelector(selector);
                if (dialogButtons) break;
            }
            
            if (!dialogButtons) {
                setTimeout(() => this.addToAttackPage(content), 500);
                return;
            }
            
            const existing = document.getElementById('skyview-attack-info');
            if (existing) existing.remove();
            
            const attackInfo = document.createElement('div');
            attackInfo.id = 'skyview-attack-info';
            attackInfo.innerHTML = content;
            
            dialogButtons.appendChild(attackInfo);
        }
        
        static showApiKeyPrompt() {
            const container = document.createElement('div');
            container.style.cssText = 'background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 15px; border-radius: 8px; font-family: monospace; border: 2px solid #c0392b;';
            
            const text = document.createElement('div');
            text.innerHTML = '<strong>❌ API KEY REQUIRED</strong><br>BOS requires your Torn API key for enhanced features.';
            
            const button = document.createElement('button');
            button.textContent = 'Set API Key';
            button.style.cssText = 'margin-top: 10px; padding: 8px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;';
            
            button.addEventListener('click', function() {
                const key = window.prompt('Enter your Torn API key (Full Access recommended):');
                if (key && key.trim()) {
                    try {
                        GM_setValue('api-key', key.trim());
                        SkyviewLogger.info('API key saved successfully');
                        window.location.reload();
                    } catch (error) {
                        SkyviewLogger.error('Failed to save API key:', error);
                        alert('Failed to save API key. Please try again.');
                    }
                } else if (key !== null) {
                    alert('Please enter a valid API key.');
                }
            });
            
            container.appendChild(text);
            container.appendChild(button);
            
            this.addToAttackPage(container.outerHTML);
        }
        
        static showErrorMessage(error) {
            const content = `
            <div style="background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); color: white; padding: 15px; border-radius: 8px; font-family: monospace; border: 2px solid #d35400;">
                <strong>⚠️ ERROR</strong><br>
                ${error}<br>
                Please check your API key and try again.
            </div>
            `;
            this.addToAttackPage(content);
        }
    }
    
    // Enhanced Faction Page Handler with TSC Integration
    class FactionPageHandler {
        static handle() {
            SkyviewLogger.info('Handling faction page with TSC utilities and AI stats...');
            
            const apiKey = storage.get('api-key');
            if (!apiKey) {
                TSCUtilities.addFactionPageUtilities();
                return;
            }
            
            // Add TSC utilities first
            TSCUtilities.addFactionPageUtilities();
            
            setTimeout(() => {
                this.processFactionPage(apiKey);
            }, 2000);
        }
        
        static async processFactionPage(apiKey) {
            try {
                const memberLinks = document.querySelectorAll('a[href*="profiles.php?XID="]');
                if (memberLinks.length === 0) return;
                
                const membersToProcess = Array.from(memberLinks).slice(0, 20);
                
                for (const link of membersToProcess) {
                    const match = link.href.match(/XID=(\d+)/);
                    if (match) {
                        const userId = match[1];
                        setTimeout(() => {
                            this.addStatsToMember(link, userId, apiKey);
                        }, Math.random() * 3000);
                    }
                }
            } catch (error) {
                SkyviewLogger.error('Faction page processing failed:', error);
            }
        }
        
        static async addStatsToMember(memberElement, userId, apiKey) {
            try {
                if (memberElement.querySelector('.skyview-stat-display')) return;
                
                const userData = await AttackPageHandler.fetchUserData(userId, apiKey, 'profile');
                if (!userData) return;
                
                const estimation = AIBattleStatsEngine.estimate(userData);
                
                const statsDisplay = document.createElement('span');
                statsDisplay.className = 'skyview-stat-display';
                statsDisplay.innerHTML = ` 🦉 ≈${AIBattleStatsEngine.formatNumber(estimation.total)}`;
                statsDisplay.title = `AI Battle Stats: ${estimation.total.toLocaleString()}\\nLevel: ${userData.level}\\nLast Action: ${userData.last_action?.relative || 'Unknown'}\\nConfidence: ${(estimation.confidence * 100).toFixed(0)}%\\nMethod: ${estimation.methodology}`;
                statsDisplay.style.cssText = `
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    margin-left: 5px;
                    font-weight: bold;
                    cursor: help;
                `;
                
                memberElement.appendChild(statsDisplay);
                
                // Save data for learning
                storage.savePlayerData(userId, {
                    level: userData.level,
                    faction: userData.faction?.faction_name,
                    lastAction: userData.last_action?.relative,
                    estimatedStats: estimation.total
                });
                
            } catch (error) {
                SkyviewLogger.warn(`Failed to add stats for member ${userId}:`, error);
            }
        }
    }
    
    // Enhanced Profile Page Handler with TSC Integration
    class ProfilePageHandler {
        static handle() {
            SkyviewLogger.info('Handling profile page with TSC utilities...');
            
            const apiKey = storage.get('api-key');
            if (!apiKey) {
                TSCUtilities.addProfileEnhancements();
                return;
            }
            
            // Add TSC utilities first
            TSCUtilities.addProfileEnhancements();
            
            // Get user ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('XID');
            
            if (userId) {
                setTimeout(() => {
                    this.processProfilePage(userId, apiKey);
                }, 1000);
            }
        }
        
        static async processProfilePage(userId, apiKey) {
            try {
                const userData = await AttackPageHandler.fetchUserData(userId, apiKey, 'profile,personalstats,battlestats');
                if (!userData) return;
                
                // AI estimation for profile display
                const estimation = AIBattleStatsEngine.estimate(userData);
                
                // Add battle stats display to profile
                this.addStatsToProfile(userData, estimation);
                
                // Save data for learning
                storage.savePlayerData(userId, {
                    level: userData.level,
                    faction: userData.faction?.faction_name,
                    lastAction: userData.last_action?.relative,
                    estimatedStats: estimation.total
                });
                
            } catch (error) {
                SkyviewLogger.error('Profile page processing failed:', error);
            }
        }
        
        static addStatsToProfile(userData, estimation) {
            const profileContent = document.querySelector('.profile-container, .user-info-blackbox, .content-wrapper');
            if (!profileContent) return;
            
            const existing = document.getElementById('skyview-profile-stats');
            if (existing) existing.remove();
            
            const statsDisplay = document.createElement('div');
            statsDisplay.id = 'skyview-profile-stats';
            statsDisplay.innerHTML = `
                <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #3498db;">
                    <h4 style="margin: 0 0 10px 0; color: #3498db;">🦉 SKYVIEW BATTLE INTELLIGENCE</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                        <div>
                            <strong>Estimated Battle Stats:</strong><br>
                            ${AIBattleStatsEngine.formatNumber(estimation.total)}<br>
                            <strong>Confidence:</strong> ${(estimation.confidence * 100).toFixed(0)}%<br>
                            <strong>Method:</strong> ${estimation.methodology}
                        </div>
                        <div>
                            <strong>Level:</strong> ${userData.level}<br>
                            <strong>Last Action:</strong> ${userData.last_action?.relative || 'Unknown'}<br>
                            <strong>Faction:</strong> ${userData.faction?.faction_name || 'None'}
                        </div>
                    </div>
                </div>
            `;
            
            profileContent.insertBefore(statsDisplay, profileContent.children[1]);
        }
    }
    
    // Enhanced Market Page Handler
    class MarketPageHandler {
        static handle() {
            SkyviewLogger.info('Handling market page with TSC utilities...');
            TSCUtilities.addMarketEnhancements();
        }
    }
    
    // Enhanced Hospital Page Handler  
    class HospitalPageHandler {
        static handle() {
            SkyviewLogger.info('Handling hospital page with TSC utilities...');
            TSCUtilities.addHospitalEnhancements();
        }
    }
    
    // API Key Management - Fixed Button Functionality
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
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const title = document.createElement('div');
        title.innerHTML = '<strong>🦉 BOS v5.0.2</strong><br>API key required for enhanced features.';
        title.style.marginBottom = '10px';
        
        const button = document.createElement('button');
        button.textContent = 'Set API Key';
        button.style.cssText = `
            margin-top: 10px;
            padding: 8px 12px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
        `;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 5px;
            right: 8px;
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
        `;
        
        // Proper event listeners instead of inline onclick
        button.addEventListener('click', function() {
            const key = window.prompt('Enter your Torn API key (Full Access recommended):');
            if (key && key.trim()) {
                try {
                    GM_setValue('api-key', key.trim());
                    prompt.remove();
                    SkyviewLogger.info('API key saved successfully');
                    window.location.reload();
                } catch (error) {
                    SkyviewLogger.error('Failed to save API key:', error);
                    alert('Failed to save API key. Please try again.');
                }
            } else if (key !== null) {
                alert('Please enter a valid API key.');
            }
        });
        
        closeButton.addEventListener('click', function() {
            prompt.remove();
        });
        
        prompt.appendChild(closeButton);
        prompt.appendChild(title);
        prompt.appendChild(button);
        
        document.body.appendChild(prompt);
        
        SkyviewLogger.info('API key prompt displayed - click button to set key');
    }
    
    // Global CSS Styling
    GM_addStyle(`
        .skyview-stat-display {
            transition: all 0.3s ease;
        }
        
        .skyview-stat-display:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .skyview-ff-indicator {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .skyview-utility-button {
            transition: background-color 0.3s ease;
        }
        
        .skyview-utility-button:hover {
            filter: brightness(1.2);
        }
    `);
    
    // Enhanced Initialization with Auto-Detection
    function initializeSkyview() {
        SkyviewLogger.info('BOS v5.0.2 starting...');
        
        const apiKey = storage.get('api-key');
        if (!apiKey) {
            showApiKeyPrompt();
        }
        
        const currentPage = window.location.pathname;
        const currentSearch = window.location.search;
        
        // Enhanced page detection with multiple conditions
        if (currentPage === '/profiles.php' && currentSearch.includes('XID=')) {
            ProfilePageHandler.handle();
        } else if (currentPage === '/loader.php' && currentSearch.includes('sid=attack')) {
            AttackPageHandler.handle();
        } else if (currentPage === '/factions.php') {
            FactionPageHandler.handle();
        } else if (currentPage === '/hospitalview.php') {
            HospitalPageHandler.handle();
        } else if (currentPage === '/markets.php' || currentPage === '/pmarket.php') {
            MarketPageHandler.handle();
        } else {
            SkyviewLogger.info('Page not supported for enhanced features');
        }
        
        SkyviewLogger.info('BOS initialization complete');
    }
    
    // Version Check and Auto-Update
    const VERSION_CHECK = {
        current: '5.0.2',
        checkForUpdates: () => {
            const lastCheck = storage.get('last-version-check');
            const now = Date.now();
            
            if (!lastCheck || now - parseInt(lastCheck) > 24 * 60 * 60 * 1000) {
                storage.set('last-version-check', now.toString());
                SkyviewLogger.info('Version 5.0.2 - BOS with functional interface');
            }
        }
    };
    
    // Initialize everything
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            VERSION_CHECK.checkForUpdates();
            initializeSkyview();
        });
    } else {
        VERSION_CHECK.checkForUpdates();
        initializeSkyview();
    }
    
})();