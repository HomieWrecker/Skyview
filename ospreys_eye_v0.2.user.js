// ==UserScript==
// @name         Osprey's Eye - Torn Stat Estimator (v0.2)
// @namespace    https://greasyfork.org/en/users/123456-osprey
// @version      0.2
// @description  Estimate enemy stats and fair fight outcomes using Torn API when available. Prompts for API key if missing.
// @author       Homiewrecker
// @match        https://www.torn.com/profiles.php?XID=*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const profileContainer = document.querySelector(".profile-wrap .content-wrapper-left .basic-info");
    if (!profileContainer) return;

    // Config: Optional hardcoded API key fallback
    const HARDCODED_API_KEY = ""; // Optional manual set here

    // Attempt to get key from localStorage
    let apiKey = localStorage.getItem("osprey_api_key");
    if (!apiKey && HARDCODED_API_KEY) {
        apiKey = HARDCODED_API_KEY;
    }

    // Prompt user to set API key if not found (only on own profile)
    const userHeader = document.querySelector("div.title-black.xlarge");
    if (!apiKey && userHeader && userHeader.textContent.includes("Your Profile")) {
        const entered = prompt("Osprey's Eye: Enter your Torn API key (kept local).");
        if (entered && entered.length >= 16) {
            localStorage.setItem("osprey_api_key", entered);
            alert("API key saved! Reload the page to activate stat features.");
            return;
        } else {
            alert("No valid API key entered. Some features may not work.");
        }
    }

    function getPlayerAge() {
        const infoBlocks = document.querySelectorAll(".profile-container .user-information .cont-wrap .value");
        if (!infoBlocks || infoBlocks.length < 5) return null;
        const ageText = infoBlocks[4].textContent.trim();
        const match = ageText.match(/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    function estimateTotalStats(accountAgeDays) {
        if (!accountAgeDays) return "Unknown";

        const lowRange = Math.floor(accountAgeDays * 200000);
        const highRange = Math.floor(accountAgeDays * 500000);
        return `${formatNumber(lowRange)} - ${formatNumber(highRange)}`;
    }

    function formatNumber(n) {
        return n.toLocaleString();
    }

    function insertEstimateUI(estTotalStats, actualStats = null) {
        const estBox = document.createElement("div");
        estBox.style.padding = "10px";
        estBox.style.marginBottom = "10px";
        estBox.style.border = "2px solid #00bfff";
        estBox.style.borderRadius = "8px";
        estBox.style.backgroundColor = "#081f2d";
        estBox.style.color = "#fff";

        let innerHTML = `<div style="font-size:16px;"><strong>Estimated Total Stats:</strong> ${estTotalStats}</div>`;

        if (actualStats) {
            innerHTML += `<div style="margin-top:5px; font-size:14px; color:#0f0;">[API Verified]</div>`;
        }

        estBox.innerHTML = innerHTML;

        const estimateButton = document.createElement("button");
        estimateButton.textContent = "Estimate Breakdown";
        estimateButton.style.marginTop = "10px";
        estimateButton.style.padding = "6px 10px";
        estimateButton.style.background = "#007bff";
        estimateButton.style.border = "none";
        estimateButton.style.color = "#fff";
        estimateButton.style.borderRadius = "5px";
        estimateButton.style.cursor = "pointer";
        estimateButton.onclick = () => {
            alert("Stat breakdown estimator coming soon.");
        };

        profileContainer.parentElement.insertBefore(estBox, profileContainer);
        profileContainer.parentElement.insertBefore(estimateButton, profileContainer.nextSibling);
    }

    // Main logic
    const age = getPlayerAge();
    const estimatedStats = estimateTotalStats(age);

    // Check if this is the user's profile to pull their own API stats
    if (apiKey && userHeader && userHeader.textContent.includes("Your Profile")) {
        fetch(`https://api.torn.com/user/?selections=stats&key=${apiKey}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.stats) {
                    const total = data.stats.strength + data.stats.defense + data.stats.speed + data.stats.dexterity;
                    insertEstimateUI(formatNumber(total), true);
                } else {
                    insertEstimateUI(estimatedStats);
                }
            })
            .catch(() => insertEstimateUI(estimatedStats));
    } else {
        insertEstimateUI(estimatedStats);
    }
})();
