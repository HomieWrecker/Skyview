// ==UserScript==
// @name         BOS
// @namespace    Skyview
// @version      0.2.0
// @description  Grand Code Stat Engine (Bot Connected)
// @author       Homiewrecker
// @license      MIT
// @match        https://www.torn.com/*
// @run-at       document-end
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
  'use strict';

  // --- CONFIG ---
  const API_BASE = "https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev";
  const STORAGE_KEY = "bos-cache";

  // --- UTILS ---
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function saveCache(cache) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  function createButton(label, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.marginLeft = "6px";
    btn.style.padding = "2px 6px";
    btn.style.fontSize = "11px";
    btn.style.borderRadius = "6px";
    btn.style.background = "#222";
    btn.style.color = "#eee";
    btn.style.cursor = "pointer";
    btn.onclick = onClick;
    return btn;
  }
  function createBox(stats) {
    const box = document.createElement("div");
    box.style.background = "#111";
    box.style.color = "#0f0";
    box.style.fontSize = "11px";
    box.style.padding = "6px";
    box.style.marginTop = "4px";
    box.style.borderRadius = "6px";
    box.style.border = "1px solid #333";
    box.innerHTML = `
      <b>Fair Fight:</b> ${stats.fairFight?.toFixed(2)}<br>
      <b>Total:</b> ${stats.total.toLocaleString()}<br>
      <b>Strength:</b> ${stats.strength.toLocaleString()}<br>
      <b>Defense:</b> ${stats.defense.toLocaleString()}<br>
      <b>Speed:</b> ${stats.speed.toLocaleString()}<br>
      <b>Dexterity:</b> ${stats.dexterity.toLocaleString()}<br>
      <b>Confidence:</b> ${(stats.confidence*100).toFixed(0)}%<br>
      <small>Source: ${stats.source}</small>
    `;
    return box;
  }

  // --- CORE ---
  async function fetchStats(userId) {
    const cache = loadCache();
    if (cache[userId] && Date.now() - cache[userId].timestamp < 3600000) {
      return cache[userId]; // 1 hour cache
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `${API_BASE}/spy/${userId}`,
        onload: function(res) {
          try {
            const data = JSON.parse(res.responseText);
            cache[userId] = data;
            saveCache(cache);
            resolve(data);
          } catch (e) { reject(e); }
        },
        onerror: reject
      });
    });
  }

  function injectButtons() {
    // Faction / profile player links
    document.querySelectorAll("a.user.name").forEach(link => {
      if (link.dataset.bosAdded) return;
      link.dataset.bosAdded = "1";

      const userId = link.href.match(/XID=(\d+)/)?.[1];
      if (!userId) return;

      const btn = createButton("Spy", async () => {
        btn.textContent = "Loading...";
        try {
          const stats = await fetchStats(userId);
          const box = createBox(stats);
          link.parentElement.appendChild(box);
          btn.textContent = "Spy";
        } catch {
          btn.textContent = "Error";
        }
      });
      link.parentElement.appendChild(btn);
    });
  }

  // --- LOOP ---
  setInterval(injectButtons, 2000);
})();
