// ==UserScript==
// @name         Osprey's Eye
// @namespace    https://torn.com/
// @version      1.0.0
// @description  Test runner
// @author       Homiewrecker
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      api.torn.com
// @connect      tornstats.com
// @connect      tornpal.com
// @run-at       document-end
// @license      MIT
// ==/UserScript==

// Osprey's Eye
// Integrated spy engine with custom logic.

(function () {
  "use strict";

  const SETTINGS_KEY = "ospreys-eye";
  const DEFAULTS = {
    tornApiKey: "",
    tornStatsKey: "",
    tornPalKey: "",
    enabled: true,
    debug: false,
  };

  const $ = window.jQuery;

  function loadSettings() {
    const raw = GM_getValue(SETTINGS_KEY);
    try {
      return raw ? JSON.parse(raw) : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(settings) {
    GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
  }

  const settings = loadSettings();

  function log(...args) {
    if (settings.debug) console.log("[Osprey's Eye]", ...args);
  }

  function addStyles() {
    GM_addStyle(\`
      .osprey-box {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        color: #fff;
      }
      .osprey-box.ff-good { background: green; }
      .osprey-box.ff-medium { background: goldenrod; }
      .osprey-box.ff-bad { background: crimson; }
      .osprey-spy-btn {
        margin-left: 6px;
        padding: 2px 5px;
        font-size: 10px;
        background: #333;
        color: white;
        border: 1px solid #555;
        border-radius: 3px;
        cursor: pointer;
      }
    \`);
  }

  function insertBox(targetNode, label, value, type) {
    const box = document.createElement("span");
    box.className = \`osprey-box \${type}\`;
    box.textContent = \`\${label}: \${value}\`;
    targetNode.appendChild(box);
  }

  function classifyFF(value) {
    if (value < 2) return "ff-good";
    if (value < 4) return "ff-medium";
    return "ff-bad";
  }

  function fetchTornPalFF(targetId) {
    return new Promise((resolve) => {
      if (!settings.tornPalKey) return resolve(null);
      GM_xmlhttpRequest({
        method: "GET",
        url: \`https://tornpal.com/api/v1/ffscoutergroup?key=\${settings.tornPalKey}&targets=\${targetId}\`,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            if (data.results && data.results[targetId]) {
              resolve(data.results[targetId].result.value);
            } else resolve(null);
          } catch {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
      });
    });
  }

  function estimateFallbackStats(targetId) {
    return Promise.resolve((Math.random() * 8).toFixed(2)); // placeholder logic
  }

  async function insertFFAndStatsUI(anchorNode, targetId) {
    const ffValue = await fetchTornPalFF(targetId) || await estimateFallbackStats(targetId);
    const ffClass = classifyFF(ffValue);
    insertBox(anchorNode, "FF", ffValue, ffClass);

    // Placeholder for stats box, refine later
    insertBox(anchorNode, "Stats", "?", "ff-medium");

    const btn = document.createElement("span");
    btn.textContent = "Spy";
    btn.className = "osprey-spy-btn";
    btn.onclick = () => alert("Manual spy estimate coming soon!");
    anchorNode.appendChild(btn);
  }

  function scanFactionPage() {
    const playerLinks = document.querySelectorAll('a[href*="XID="]');
    for (const a of playerLinks) {
      if (!a.parentNode.querySelector(".osprey-box")) {
        const xidMatch = a.href.match(/XID=(\d+)/);
        if (xidMatch) {
          const xid = xidMatch[1];
          insertFFAndStatsUI(a.parentNode, xid);
        }
      }
    }
  }

  function initSettingsUI() {
    if (!window.location.href.includes("profiles.php?XID=")) return;

    const container = document.querySelector(".profile-wrapper") || document.body;
    const settingsUI = document.createElement("div");
    settingsUI.style.padding = "10px";
    settingsUI.style.border = "1px solid #999";
    settingsUI.style.margin = "10px 0";
    settingsUI.style.background = "#eee";
    settingsUI.innerHTML = \`
      <strong>Osprey's Eye Settings</strong><br><br>
      Torn API Key: <input id="oe-torn" style="width:200px" value="\${settings.tornApiKey}"><br>
      TornStats API Key: <input id="oe-ts" style="width:200px" value="\${settings.tornStatsKey}"><br>
      TornPal API Key: <input id="oe-pal" style="width:200px" value="\${settings.tornPalKey}"><br>
      <button id="oe-save">Save</button>
    \`;

    container.prepend(settingsUI);
    document.getElementById("oe-save").onclick = () => {
      settings.tornApiKey = document.getElementById("oe-torn").value;
      settings.tornStatsKey = document.getElementById("oe-ts").value;
      settings.tornPalKey = document.getElementById("oe-pal").value;
      saveSettings(settings);
      alert("Saved!");
    };
  }

  function init() {
    if (!settings.enabled) return;
    addStyles();
    initSettingsUI();
    if (window.location.href.includes("factions.php")) {
      setTimeout(scanFactionPage, 1500);
    }
  }

  init();
})();
