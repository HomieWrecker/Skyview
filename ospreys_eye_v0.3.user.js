// ==UserScript==
// @name         Osprey's Eye - Torn Stat Estimator (v0.3)
// @namespace    https://github.com/HomieWrecker/Osprey-s-Eye
// @version      0.3
// @description  Estimate enemy stats and fair fight outcomes using Torn API. PDA-safe version with DOM and fetch fixes.
// @author       Homiewrecker
// @match        https://www.torn.com/profiles.php?XID=*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("Osprey's Eye v0.3 loaded");

    // Utility: Wait for an element to exist
    function waitForElement(selector, callback, timeout = 10000) {
        const startTime = Date.now();
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                callback(el);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(timer);
                console.warn("Osprey's Eye: Element not found in time:", selector);
            }
        }, 300);
    }

    // Try to find a recognizable profile block
    waitForElement(".user-information", (profileContainer) => {
        const userHeader = document.querySelector("div.title-black.xlarge");

        const HARDCODED_API_KEY = "";
        let apiKey = localStorage.getItem("osprey_api_key") || HARDCODED_API_KEY;

        if (!apiKey && userHeader && userHeader.textContent.includes("Your Profile")) {
            const entered = prompt("Osprey's Eye: Enter your Torn API key (kept local).");
            if (entered && entered.length >= 16) {
                localStorage.setItem("osprey_api_key", entered);
                alert("API key saved! Reload the page.");
                return;
            } else {
                alert("No valid API key entered. Limited functionality enabled.");
            }
        }

        const ageTextBlock = [...document.querySelectorAll(".user-information .cont-wrap .value")].find(el =>
            el.textContent.match(/\d+ days/i)
        );
        let accountAge = null;
        if (ageTextBlock) {
            const match = ageTextBlock.textContent.match(/(\d+)/);
            if (match) accountAge = parseInt(match[1]);
        }

        function estimateTotalStats(ageDays) {
            if (!ageDays) return "Unknown";
            const low = ageDays * 200000;
            const high = ageDays * 500000;
            return `${formatNumber(low)} - ${formatNumber(high)}`;
        }

        function formatNumber(n) {
            return n.toLocaleString();
        }

        function insertEstimateBox(estTotal, confirmed = false) {
            const box = document.createElement("div");
            box.style.padding = "10px";
            box.style.marginTop = "10px";
            box.style.border = "2px solid #00bfff";
            box.style.borderRadius = "8px";
            box.style.backgroundColor = "#081f2d";
            box.style.color = "#fff";
            box.innerHTML = `
                <div style="font-size:16px;"><strong>Estimated Total Stats:</strong> ${estTotal}</div>
                ${confirmed ? '<div style="color:#0f0; font-size:12px; margin-top:5px;">[API Verified]</div>' : ''}
            `;

            const btn = document.createElement("button");
            btn.textContent = "Estimate Breakdown";
            btn.style.marginTop = "10px";
            btn.style.padding = "6px 10px";
            btn.style.background = "#007bff";
            btn.style.border = "none";
            btn.style.color = "#fff";
            btn.style.borderRadius = "5px";
            btn.style.cursor = "pointer";
            btn.onclick = () => alert("Stat breakdown coming soon.");

            profileContainer.prepend(btn);
            profileContainer.prepend(box);
        }

        const fallbackEst = estimateTotalStats(accountAge);

        if (apiKey && userHeader && userHeader.textContent.includes("Your Profile")) {
            fetch(`https://api.torn.com/user/?selections=stats&key=${apiKey}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.stats) {
                        const t = data.stats.strength + data.stats.speed + data.stats.defense + data.stats.dexterity;
                        insertEstimateBox(formatNumber(t), true);
                    } else {
                        insertEstimateBox(fallbackEst);
                    }
                })
                .catch(err => {
                    console.error("API fetch failed:", err);
                    insertEstimateBox(fallbackEst);
                });
        } else {
            insertEstimateBox(fallbackEst);
        }
    });
})();
