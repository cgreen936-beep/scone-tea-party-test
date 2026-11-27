// ==UserScript==
// @name         Scone Tea Party Morrisons trolley helper
// @namespace    https://www.sconeteaparty.co.uk/
// @version      1.3.1
// @description  Step through shopping-list.json on a logged-in Morrisons tab. Adds a pack only when one clear control is visible. Never checks out.
// @match        *://groceries.morrisons.com/*
// @match        *://*.morrisons.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * Starter helper for Sarah's Morrisons shop.
 *
 * 1. Install this file in Tampermonkey or Violentmonkey.
 * 2. On the ops desk, click Order from Morrisons. That copies the packs still to buy and opens this site.
 * 3. Sign in yourself if Chrome asks. This script never sees or sends a password.
 * 4. Click Load from Clipboard. It uses the local ops desk list when that is available, then the clipboard, and you can still choose a file.
 * 5. Open item goes straight to a saved product page. A search?q= link is only a fallback: pick the pack yourself, then save its /products/ URL in the ops desk.
 * 6. Mark added moves to the next line that still needs packs.
 *
 * This script does not call Morrisons APIs and does not click checkout, basket
 * continue, or payment controls.
 *
 * The local dry-run page can set window.__SCONE_TROLLEY_DRY_RUN__ before this
 * file loads. Open item then stays on that page. groceries.morrisons.com never
 * sets the hook, so a normal shop still navigates for real.
 */

(function () {
  "use strict";

  if (document.querySelector("[data-scone-trolley-helper]")) return;

  var STORAGE_KEY = "scone-tea-party-shopping-list";
  var CHECKOUT = /checkout|payment|pay now|place order|continue to|buy now|confirm order|card number|cvv/i;

  var state = loadState();

  var panel = document.createElement("aside");
  panel.setAttribute("data-scone-trolley-helper", "true");
  panel.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483646",
    "width:320px",
    "max-height:80vh",
    "overflow:auto",
    "padding:12px",
    "border:1px solid #e4d5c3",
    "border-radius:12px",
    "background:#fffaf3",
    "color:#2c241c",
    "font:14px/1.4 Arial, sans-serif",
    "box-shadow:0 8px 24px rgba(44,36,28,0.18)",
  ].join(";");

  panel.innerHTML = [
    "<div style=\"display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;\">",
    "<strong>Scone trolley helper</strong>",
    "<span style=\"display:flex;gap:6px;\">",
    "<button type=\"button\" data-role=\"minimise\">Minimise</button>",
    "<button type=\"button\" data-role=\"close\">Close</button>",
    "</span>",
    "</div>",
    "<div data-role=\"body\">",
    "<p style=\"margin:0 0 8px;color:#5c5146;\">Load the packs still to buy. Nothing here goes to checkout or payment. You pay yourself.</p>",
    "<div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;\">",
    "<button type=\"button\" data-role=\"clipboard\">Load from Clipboard</button>",
    "</div>",
    "<textarea data-role=\"json\" rows=\"5\" style=\"width:100%;box-sizing:border-box;margin-bottom:8px;\" placeholder=\"Paste shopping-list.json\"></textarea>",
    "<div style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;\">",
    "<button type=\"button\" data-role=\"load\">Use pasted list</button>",
    "<label style=\"cursor:pointer;\">Choose file<input data-role=\"file\" type=\"file\" accept=\"application/json,.json\" hidden /></label>",
    "</div>",
    "<p data-role=\"status\" style=\"min-height:1.2em;margin:0 0 8px;\"></p>",
    "<p data-role=\"item\" style=\"margin:0 0 8px;font-weight:700;\"></p>",
    "<p data-role=\"count\" style=\"margin:0 0 8px;\"></p>",
    "<p data-role=\"hint\" style=\"margin:0 0 8px;color:#6b3208;\"></p>",
    "<div style=\"display:flex;gap:8px;flex-wrap:wrap;\">",
    "<button type=\"button\" data-role=\"open\">Open item</button>",
    "<button type=\"button\" data-role=\"add\">Add packs</button>",
    "<button type=\"button\" data-role=\"next\">Next item / Mark added</button>",
    "</div>",
    "</div>",
  ].join("");

  document.documentElement.appendChild(panel);

  var jsonBox = panel.querySelector("[data-role=\"json\"]");
  var status = panel.querySelector("[data-role=\"status\"]");
  var itemLine = panel.querySelector("[data-role=\"item\"]");
  var countLine = panel.querySelector("[data-role=\"count\"]");
  var hintLine = panel.querySelector("[data-role=\"hint\"]");

  panel.querySelector("[data-role=\"clipboard\"]").addEventListener("click", loadFromClipboard);
  panel.querySelector("[data-role=\"load\"]").addEventListener("click", function () {
    applyList(jsonBox.value, "Loaded from pasted text");
  });
  panel.querySelector("[data-role=\"file\"]").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      jsonBox.value = String(reader.result || "");
      applyList(jsonBox.value, "Loaded from file");
    };
    reader.readAsText(file);
  });
  panel.querySelector("[data-role=\"open\"]").addEventListener("click", openCurrent);
  panel.querySelector("[data-role=\"add\"]").addEventListener("click", addCurrent);
  panel.querySelector("[data-role=\"next\"]").addEventListener("click", markAndAdvance);
  panel.querySelector("[data-role=\"minimise\"]").addEventListener("click", function () {
    var body = panel.querySelector("[data-role=\"body\"]");
    var hidden = body.style.display === "none";
    body.style.display = hidden ? "" : "none";
    this.textContent = hidden ? "Minimise" : "Restore";
  });
  panel.querySelector("[data-role=\"close\"]").addEventListener("click", function () {
    panel.remove();
  });

  render();

  function loadState() {
    try {
      var saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "");
      if (saved && Array.isArray(saved.items)) {
        var items = saved.items.map(normalise).filter(needsPacks);
        return { items: items, index: clampIndex(saved.index, items) };
      }
    } catch {
      /* A missing or old note just starts a fresh list. */
    }
    return { items: [], index: 0 };
  }

  function saveState() {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, index: state.index }));
  }

  function loadFromClipboard() {
    setStatus("Checking the ops desk, then the clipboard…");
    fetch("http://localhost:3001/api/shopping-list")
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (body) {
        var rows = body && (Array.isArray(body) ? body : body.items);
        if (rows && rows.length) {
          jsonBox.value = JSON.stringify(rows, null, 2);
          applyList(jsonBox.value, "Loaded from the ops desk");
          return "done";
        }
        return "clipboard";
      })
      .catch(function () {
        return "clipboard";
      })
      .then(function (next) {
        if (next !== "clipboard") return;
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          setStatus("Clipboard is unavailable. Paste the JSON or choose the file.");
          return;
        }
        navigator.clipboard.readText().then(function (text) {
          if (!text || !String(text).trim()) {
            setStatus("The clipboard is empty. Click Order from Morrisons on the ops desk, or choose the file.");
            return;
          }
          jsonBox.value = text;
          applyList(text, "Loaded from the clipboard");
        }).catch(function () {
          setStatus("Clipboard was blocked. Paste the JSON below or choose the file.");
        });
      });
  }

  function applyList(raw, source) {
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setStatus("That text is not JSON.");
      return;
    }
    var rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.items) ? parsed.items : null;
    if (!rows) {
      setStatus("Use the list from Order from Morrisons, or the shopping-list.json file.");
      return;
    }
    state.items = rows.map(normalise).filter(needsPacks);
    state.index = 0;
    saveState();
    var prefix = source ? source + ". " : "";
    setStatus(prefix + state.items.length + " pack line(s) still to buy.");
    render();
  }

  function normalise(row) {
    var name = text(row, ["name", "ingredient"]);
    var url = text(row, ["morrisonsUrl", "url"]);
    var packs = number(row, ["trolleyPacks", "quantity"]);
    var netToBuy = number(row, ["netToBuy"]);
    var unit = text(row, ["unit", "requiredUnit"]);
    var product = isProductUrl(url);
    if (!product) url = searchUrl(name);
    return { name: name, morrisonsUrl: url, trolleyPacks: packs, netToBuy: netToBuy, unit: unit, searchFallback: !product };
  }

  function needsPacks(item) {
    return Boolean(item.name) && item.trolleyPacks > 0 && isMorrisonsUrl(item.morrisonsUrl);
  }

  function current() {
    return state.items[state.index] || null;
  }

  function render() {
    var item = current();
    if (!item) {
      itemLine.textContent = state.items.length ? "Every remaining line is marked added." : "No list loaded yet.";
      countLine.textContent = "";
      hintLine.textContent = "";
      return;
    }
    itemLine.textContent = (state.index + 1) + " / " + state.items.length + " · " + item.name;
    var amount = item.netToBuy > 0 && item.unit ? " Net to buy " + item.netToBuy + " " + item.unit + "." : "";
    countLine.textContent = "Add " + item.trolleyPacks + " pack" + (item.trolleyPacks === 1 ? "" : "s") + "." + amount;
    hintLine.textContent = item.searchFallback ? searchPrompt(item.name) : "Direct product page. Open item goes straight there.";
  }

  function openCurrent() {
    var item = current();
    if (!item) {
      setStatus("Load a list with packs still to buy.");
      return;
    }
    if (samePage(item.morrisonsUrl)) {
      setStatus(item.searchFallback ? searchPrompt(item.name) : "This tab is already on the product page for " + item.name + ".");
      return;
    }
    setStatus(item.searchFallback ? "Opening a search for " + item.name + ". " + searchPrompt(item.name) : "Opening the product page for " + item.name + ".");
    goTo(item.morrisonsUrl);
  }

  function markAndAdvance() {
    if (!current()) return;
    state.index += 1;
    saveState();
    render();
    setStatus("Marked added. Open the next item when you are ready.");
  }

  function addCurrent() {
    var item = current();
    if (!item) return;
    if (item.searchFallback || isSearchPage(pageHref())) {
      setStatus(searchPrompt(item.name));
      return;
    }
    var result = addPacks(item.trolleyPacks);
    setStatus(result);
  }

  function addPacks(packs) {
    var target = Math.max(0, Math.floor(packs));
    if (target < 1) return "This line needs 0 packs.";
    var addButton = singleMatch(visibleControls(), /add to trolley|add to basket|^add$/i);
    if (!addButton) return "No single add button. Add " + target + " by hand.";
    if (looksLikeCheckout(addButton)) return "That control looks like checkout, so it was left alone.";

    var quantity = singleMatch(visibleQuantities(), /quantity|qty/i);
    if (quantity && !looksLikeCheckout(quantity)) {
      setInputValue(quantity, String(target));
      addButton.click();
      return "Set the quantity to " + target + " and clicked the one add button. Check the trolley yourself.";
    }

    addButton.click();
    var added = 1;
    while (added < target && added < 12) {
      var increment = singleMatch(visibleControls(), /increase|increment|\+/i);
      if (!increment || looksLikeCheckout(increment)) {
        return "Added " + added + " of " + target + ". The next plus button was not clear, so the rest is for you.";
      }
      increment.click();
      added += 1;
    }
    if (added < target) {
      return "Added " + added + " of " + target + ". Stopped so this stays a small assist. Add the rest yourself.";
    }
    return "Clicked add " + added + " time" + (added === 1 ? "" : "s") + ". Confirm the trolley before you pay.";
  }

  function setInputValue(input, value) {
    var descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
    if (descriptor && typeof descriptor.set === "function") descriptor.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function visibleControls() {
    return Array.prototype.filter.call(document.querySelectorAll("button, [role=\"button\"]"), isVisible);
  }

  function visibleQuantities() {
    return Array.prototype.filter.call(document.querySelectorAll("input[type=\"number\"]"), isVisible);
  }

  function isVisible(element) {
    if (!element || element.closest("[data-scone-trolley-helper]")) return false;
    var style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  function singleMatch(elements, pattern) {
    var matches = [];
    for (var index = 0; index < elements.length; index += 1) {
      var label = ((elements[index].getAttribute("aria-label") || "") + " " + (elements[index].textContent || "")).replace(/\s+/g, " ").trim();
      if (pattern.test(label) && !CHECKOUT.test(label)) matches.push(elements[index]);
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function looksLikeCheckout(element) {
    var label = ((element.getAttribute("aria-label") || "") + " " + (element.textContent || "") + " " + (element.name || "")).toLowerCase();
    return CHECKOUT.test(label);
  }

  function text(row, keys) {
    if (!row || typeof row !== "object") return "";
    for (var index = 0; index < keys.length; index += 1) {
      var value = row[keys[index]];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function number(row, keys) {
    if (!row || typeof row !== "object") return 0;
    for (var index = 0; index < keys.length; index += 1) {
      var value = row[keys[index]];
      if (typeof value === "number" && isFinite(value)) return value;
      if (typeof value === "string" && value.trim() && isFinite(Number(value))) return Number(value);
    }
    return 0;
  }

  function isProductUrl(value) {
    try {
      var url = new URL(value);
      var path = url.pathname.replace(/\/+$/, "");
      return url.protocol === "https:" && url.hostname === "groceries.morrisons.com" && path.length > 1 && path !== "/search" && path.indexOf("/search/") !== 0;
    } catch {
      return false;
    }
  }

  function isSearchPage(value) {
    try {
      var url = new URL(value, pageHref());
      return url.hostname === "groceries.morrisons.com" && (url.pathname === "/search" || url.pathname.indexOf("/search/") === 0);
    } catch {
      return false;
    }
  }

  function searchPrompt(name) {
    return "Search fallback for " + name + ". This is not a saved product page. Choose the pack, copy its /products/ link, and paste it into Ingredients & Suppliers. Add packs stays off until that product page is open.";
  }

  function samePage(value) {
    try {
      return canonicalUrl(pageHref()) === canonicalUrl(value);
    } catch {
      return false;
    }
  }

  function pageHref() {
    var hook = dryRunHook();
    if (hook && typeof hook.href === "string" && hook.href) return hook.href;
    return location.href;
  }

  function goTo(url) {
    var hook = dryRunHook();
    if (hook && typeof hook.navigate === "function") {
      hook.href = url;
      hook.navigate(url);
      return;
    }
    location.assign(url);
  }

  function dryRunHook() {
    var hook = window.__SCONE_TROLLEY_DRY_RUN__;
    if (!hook || typeof hook !== "object") return null;
    return hook;
  }

  function canonicalUrl(value) {
    var url = new URL(value, pageHref());
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  }

  function isMorrisonsUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "https:" && (url.hostname === "groceries.morrisons.com" || /(^|\.)morrisons\.com$/i.test(url.hostname));
    } catch {
      return false;
    }
  }

  function searchUrl(name) {
    return "https://groceries.morrisons.com/search?q=" + encodeURIComponent(name || "morrisons");
  }

  function clampIndex(index, items) {
    var pending = items.filter(needsPacks);
    if (!pending.length) return 0;
    var value = typeof index === "number" && index >= 0 ? index : 0;
    return Math.min(value, pending.length);
  }

  function setStatus(message) {
    status.textContent = message;
  }
})();
