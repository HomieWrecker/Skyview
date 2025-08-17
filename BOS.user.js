// ==UserScript==
// @name         BOS
// @namespace    Skyview
// @version      0.2.0
// @description  Grand Code Stat Engine connected to BrotherOwl Bot
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

    const API_BASE = "https://3481ca33-d7be-4299-af14-d03248879108-00-1abhp8jokc3pi.worf.replit.dev"; // Your bot’s endpoint
    const API_KEY = localStorage.getItem("bos_api_key") || ""; // stored key

    // === UI Helpers ===
    function addSpyButton(profileId) {
        const container = document.querySelector(".profile-buttons, .profile-info");
        if (!container || document.getElementById("bos-spy-btn")) return;

        const btn = document.createElement("button");
        btn.id = "bos-spy-btn";
        btn.textContent = "🔎 Spy";
        btn.style.margin = "6px";
        btn.style.padding = "4px 8px";
        btn.style.background = "#1c1c2b";
        btn.style.color = "#fff";
        btn.style.border = "1px solid #444";
        btn.style.borderRadius = "6px";
        btn.style.cursor = "pointer";

        btn.addEventListener("click", () => doSpy(profileId));
        container.appendChild(btn);
    }

    function showResultBox(data) {
        let box = document.getElementById("bos-result-box");
        if (!box) {
            box = document.createElement("div");
            box.id = "bos-result-box";
            box.style.background = "#111";
            box.style.color = "#0f0";
            box.style.border = "1px solid #444";
            box.style.padding = "10px";
            box.style.marginTop = "8px";
            box.style.fontFamily = "monospace";
            box.style.whiteSpace = "pre-wrap";
            box.style.borderRadius = "8px";
            document.body.appendChild(box);
        }
        box.textContent = JSON.stringify(data, null, 2);
    }

    // === Networking ===
    function doSpy(profileId) {
        if (!API_KEY) {
            alert("⚠️ No BOS API key set! Please register.");
            return;
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: `${API_BASE}/spy`,
            headers: {
                "Content-Type": "application/json",
                "x-api-key": API_KEY
            },
            data: JSON.stringify({ target: profileId }),
            onload: (res) => {
                try {
                    const data = JSON.parse(res.responseText);
                    showResultBox(data);
                } catch (err) {
                    console.error("Spy parse error", err);
                    alert("Error parsing spy result.");
                }
            },
            onerror: (err) => {
                console.error("Spy failed", err);
                alert("Spy request failed.");
            }
        });
    }

    // === Hook into Torn pages ===
    function getProfileIdFromUrl() {
        const match = window.location.href.match(/XID=(\d+)/i);
        return match ? match[1] : null;
    }

    function init() {
        const profileId = getProfileIdFromUrl();
        if (profileId) {
            addSpyButton(profileId);
        }
    }

    // Run after load
    setTimeout(init, 1500);

})();
