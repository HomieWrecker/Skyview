// ==UserScript==
// @name         Osprey's Eye
// @namespace    https://torn.com/
// @version      1.0.0
// @description  Fight tool with custom logic
// @author       Homiewrecker
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      api.torn.com
// @connect      tornstats.com
// @run-at       document-end
// @license      MIT
// ==/UserScript==

// Osprey's Eye Final Script (v1.0.0)
(function() {
  "use strict";

  // SETTINGS LOADER
  const SETTINGS_KEY = "ospreys-eye";
  const DEFAULTS = {
    tornApiKey: "",
    tornStatsKey: "",
    tornPalKey: "",
    enabled: true,
    debug: false,
  };

  function loadSettings() {
    try {
      const raw = GM_getValue(SETTINGS_KEY);
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

  // STYLE INJECTION
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

  function classifyFF(value) {
    if (value < 2) return "ff-good";
    if (value < 4) return "ff-medium";
    return "ff-bad";
  }

  async function fetchTDUPFallback(targetId) {
    // Placeholder fallback estimation logic (replace with real TDUP logic)
    return Promise.resolve((Math.random() * 8).toFixed(2));
  }

  async function fetchTornStats(targetId) {
    return new Promise(resolve => {
      if (!settings.tornStatsKey) return resolve(null);
      const url = \`https://www.tornstats.com/api/v2/\${settings.tornStatsKey}/spy/user/\${targetId}\`;
      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: res => {
          try {
            const json = JSON.parse(res.responseText);
            resolve(json?.spy?.total || null);
          } catch {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
      });
    });
  }

  async function renderBoxes(anchorNode, targetId) {
    let ffValue = await fetchTornStats(targetId);
    if (!ffValue) ffValue = await fetchTDUPFallback(targetId);

    const ffClass = classifyFF(ffValue);
    const box = document.createElement("span");
    box.className = \`osprey-box \${ffClass}\`;
    box.textContent = \`FF: \${ffValue}\`;
    anchorNode.appendChild(box);

    const statsBox = document.createElement("span");
    statsBox.className = "osprey-box ff-medium";
    statsBox.textContent = "Stats: ?";
    anchorNode.appendChild(statsBox);

    const spyBtn = document.createElement("span");
    spyBtn.textContent = "Spy";
    spyBtn.className = "osprey-spy-btn";
    spyBtn.onclick = () => alert("Stat breakdown coming soon...");
    anchorNode.appendChild(spyBtn);
  }

  function scanFactionPage() {
    const anchors = document.querySelectorAll('a[href*="XID="]');
    anchors.forEach(a => {
      const match = a.href.match(/XID=(\d+)/);
      if (match) {
        const id = match[1];
        renderBoxes(a.parentNode, id);
      }
    });
  }

  function renderSettings() {
    const container = document.querySelector(".profile-wrapper") || document.body;
    const div = document.createElement("div");
    div.innerHTML = \`
      <div style="padding: 10px; background: #eee; border: 1px solid #999;">
        <strong>Osprey's Eye Settings</strong><br><br>
        Torn API Key: <input id="oe-torn" style="width:200px"><br>
        TornStats API Key: <input id="oe-ts" style="width:200px"><br>
        <button id="oe-save">Save</button>
      </div>
    \`;
    container.prepend(div);
    document.getElementById("oe-save").onclick = () => {
      const data = {
        tornApiKey: document.getElementById("oe-torn").value,
        tornStatsKey: document.getElementById("oe-ts").value,
        tornPalKey: "", // deprecated
        enabled: true,
        debug: false,
      };
      saveSettings(data);
      alert("Settings saved!");
    };
  }

  function init() {
    if (window.location.href.includes("factions.php")) {
      setTimeout(scanFactionPage, 1500);
    }
    if (window.location.href.includes("profiles.php")) {
      renderSettings();
    }
  }

  init();
})();
