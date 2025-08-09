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
    
    const storage = {
        get: (key) => GM_getValue(key),
        set: (key, value) => GM_setValue(key, value)
    };
    
    const SkyviewLogger = {
        info: (msg, ...args) => console.log(`[SKYVIEW] ${msg}`, ...args),
        warn: (msg, ...args) => console.warn(`[SKYVIEW] ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[SKYVIEW] ${msg}`, ...args)
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
                return;
            }
            
            try {
                const [targetData, ownData] = await Promise.all([
                    this.fetchUserData(attackId, apiKey, 'profile,personalstats,battlestats'),
                    this.fetchUserData('', apiKey, 'battlestats,profile,personalstats')
                ]);
                
                if (targetData && ownData) {
                    const spyData = await this.fetchTornStatsData(attackId, apiKey);
                    this.displayAttackIntelligence(targetData, ownData, spyData);
                }
            } catch (error) {
                SkyviewLogger.error('Attack page processing failed:', error);
            }
        }
        
        static fetchUserData(userId, apiKey, selections) {
            return new Promise((resolve, reject) => {
                const url = userId ? 
                    `https://api.torn.com/user/${userId}?selections=${selections}&key=${apiKey}` :
                    `https://api.torn.com/user/?selections=${selections}&key=${apiKey}`;
                    
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
                            resolve(null);
                        }
                    },
                    onerror: () => resolve(null)
                });
            });
        }
        
        static displayAttackIntelligence(targetData, ownData, spyData) {
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
            
            let content = `
            <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 15px; border-radius: 8px; font-family: monospace; border: 2px solid #3498db;">
                <strong>🦉 S.O.A.P. INTELLIGENCE</strong><br>
                📊 <strong>ENHANCEMENT COMPARISON</strong><br>
                ${formatDiff(diffXan, 'Xanax')}<br>
                ${formatDiff(diffRefill, 'Refills')}<br>
                ${formatDiff(diffCans, 'Energy Cans')}<br>
                ${formatDiff(diffSE, 'Stat Enhancers')}<br><br>
                📋 <strong>TARGET INFO</strong><br>
                <strong>Last Action:</strong> ${targetData.last_action?.relative || 'Unknown'}<br>
                <strong>Faction:</strong> ${targetData.faction?.faction_name || 'None'}<br>
            `;
            
            if (spyData && spyData.spy?.status) {
                content += `<br>🎯 <strong>SPIED STATS (TornStats)</strong><br>`;
                content += `<strong>Total:</strong> ${this.formatNumber(spyData.spy.total)}<br>`;
                if (spyData.spy.fair_fight_bonus) {
                    content += `<strong>Fair Fight:</strong> ${spyData.spy.fair_fight_bonus.toFixed(2)}<br>`;
                }
            }
            
            content += `</div>`;
            
            this.addToAttackPage(content);
        }
        
        static formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        }
        
        static addToAttackPage(content) {
            const dialogButtons = document.querySelector('.dialogButtons___nX4Bz, .dialog-buttons, [class*="dialog"][class*="button"]');
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
    }
    
    // Faction Page Handler
    class FactionPageHandler {
        static handle() {
            SkyviewLogger.info('Handling faction page...');
            
            const apiKey = storage.get('api-key');
            if (!apiKey) return;
            
            setTimeout(() => {
                this.processFactionPage(apiKey);
            }, 2000);
        }
        
        static async processFactionPage(apiKey) {
            try {
                const memberLinks = document.querySelectorAll('a[href*="profiles.php?XID="]');
                if (memberLinks.length === 0) return;
                
                const membersToProcess = Array.from(memberLinks).slice(0, 15);
                
                for (const link of membersToProcess) {
                    const match = link.href.match(/XID=(\d+)/);
                    if (match) {
                        const userId = match[1];
                        setTimeout(() => {
                            this.addStatsToMember(link, userId, apiKey);
                        }, Math.random() * 2000);
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
                
                const estimation = Math.round(Math.pow(userData.level, 2.2) * 100);
                
                const statsDisplay = document.createElement('span');
                statsDisplay.className = 'skyview-stat-display';
                statsDisplay.innerHTML = ` 🦉 ≈${AttackPageHandler.formatNumber(estimation)}`;
                statsDisplay.title = `AI Battle Stats: ${estimation.toLocaleString()}\\nLevel: ${userData.level}\\nLast Action: ${userData.last_action?.relative || 'Unknown'}`;
                statsDisplay.style.cssText = `
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 11px;
                    margin-left: 5px;
                    font-weight: bold;
                `;
                
                memberElement.appendChild(statsDisplay);
                
            } catch (error) {
                SkyviewLogger.warn(`Failed to add stats for member ${userId}:`, error);
            }
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
            showApiKeyPrompt();
            return;
        }
        
        const currentPage = window.location.pathname;
        
        if (currentPage === '/profiles.php') {
            SkyviewLogger.info('Processing profile page...');
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
