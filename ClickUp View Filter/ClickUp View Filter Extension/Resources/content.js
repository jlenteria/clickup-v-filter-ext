/* ClickUp View Filter: cosmetic filtering in this browser only. */
(() => {
  'use strict';
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const KEY = 'clickupHideConfig';
  const HIDDEN_KEY = 'clickupHideHidden';
  const HIDDEN = 'data-cvf-hidden';
  const DEFAULTS = {
    enabled: true, channelFilter: '', reveal: false,
  };
  const ROW_SELECTOR = [
    '[data-message-id]', '[data-comment-id]',
    'cu-chat-message', 'cu-chat-message-item', 'cu-comment',
    '[role="article"]', 'article', '[role="listitem"]',
  ].join(',');
  const CANDIDATE_SELECTOR = [
    ROW_SELECTOR, '[class*="message"]', '[class*="comment"]',
    '[data-test*="message"]', '[data-testid*="message"]',
    '[data-test*="comment"]', '[data-testid*="comment"]',
  ].join(',');
  const ROW_SIGNAL = /(?:^|\s)(?:cu[-_])?(?:chat[-_])?(?:message|comment)(?:[-_]+(?:item|row|container|wrapper))?(?:\s|$)/i;
  const CONTENT_SIGNAL = /(?:message|comment)[-_](?:text|content|body)|(?:message|comment)__(?:text|content|body)/i;
  const LIST_SIGNAL = /(?:messages|comments)(?:[-_](?:list|container|wrapper))?(?:\s|$)|(?:message|comment|chat)[-_](?:list|feed|history|viewport)(?:\s|$)/i;
  const EXCLUDED = 'nav, aside, [role="navigation"], [contenteditable="true"], textarea, input, [data-cvf-hide-btn], [role="complementary"]';

  let config = { ...DEFAULTS };
  let controlsVisible = false;
  let hiddenHashes = new Set();
  let marked = new Map();
  let lastMatch = 0;
  let timer = null;

  function normalizeText(value) {
    return String(value || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normalizeConfig(raw) {
    const c = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
    delete c.messages;
    delete c.debugOutline;
    c.channelFilter = String(c.channelFilter || '').trim();
    c.enabled = !!c.enabled;
    c.reveal = !!c.reveal;
    return c;
  }

  async function loadConfig() {
    const stored = await api.storage.local.get([KEY, HIDDEN_KEY]);
    config = normalizeConfig(stored[KEY]);
    let hidden = stored[HIDDEN_KEY];
    if (typeof hidden === 'string') {
      try { hidden = JSON.parse(hidden); } catch { hidden = []; }
    }
    hiddenHashes = new Set(Array.isArray(hidden) ? hidden : []);
  }

  function inScope() {
    return !config.channelFilter || location.href.toLowerCase().includes(config.channelFilter.toLowerCase());
  }

  function blob(el) {
    return [el.tagName.toLowerCase(), el.id, el.getAttribute('class'),
      el.getAttribute('data-test'), el.getAttribute('data-testid')].filter(Boolean).join(' ');
  }

  function isRow(el) {
    if (LIST_SIGNAL.test(blob(el))) return false;
    if (el.matches('[data-message-id], [data-comment-id], cu-chat-message, cu-chat-message-item, cu-comment') || ROW_SIGNAL.test(blob(el))) return true;
    return el.matches('article, [role="article"], [role="listitem"]') &&
      !!el.closest('[class*="chat"], [class*="message"], [class*="comment"], [data-testid*="chat"], [data-test*="chat"]');
  }

  const METADATA_SELECTOR = [
    'img', 'time', '[class*="avatar"]', '[class*="author"]',
    '[class*="sender"]', '[class*="timestamp"]', '[class*="user-name"]',
    '[data-testid*="avatar"]', '[data-testid*="author"]',
    '[data-test*="avatar"]', '[data-test*="author"]',
  ].join(',');

  function isBoundary(el) {
    return el === document.body || el === document.documentElement ||
      el.matches(`${EXCLUDED}, main, [role="main"], [role="list"], [role="log"], [role="feed"]`) ||
      LIST_SIGNAL.test(blob(el));
  }

  function containsMultipleMessages(el) {
    const parts = Array.from(el.querySelectorAll(CANDIDATE_SELECTOR));
    const rows = parts.filter(isRow);
    // Nested row/content wrappers represent the same message. Independent
    // rows or bodies identify neighboring messages, including grouped replies.
    const leafRows = rows.filter((row) => !rows.some((other) => row !== other && row.contains(other)));
    if (leafRows.length > 1) return true;
    const bodies = parts.filter((part) => CONTENT_SIGNAL.test(blob(part)));
    const outerBodies = bodies.filter((body) => !bodies.some((other) => body !== other && other.contains(body)));
    return outerBodies.length > 1;
  }

  function completeRow(start) {
    let best = start;
    // ClickUp can put the author/avatar beside an inner message component.
    // Include that enclosing row, but retain shared headers for visible siblings.
    for (let parent = start.parentElement, depth = 0; parent && depth < 8; parent = parent.parentElement, depth++) {
      if (isBoundary(parent) || containsMultipleMessages(parent)) break;
      const hasOwnMetadata = Array.from(parent.querySelectorAll(METADATA_SELECTOR))
        .some((metadata) => !best.contains(metadata));
      if (isRow(parent) || hasOwnMetadata) best = parent;
    }
    return best;
  }

  function findContainer(start) {
    if (start.closest(EXCLUDED)) return null;
    let fallback = null;
    for (let el = start, depth = 0; el && depth < 20; el = el.parentElement, depth++) {
      if (isBoundary(el)) break;
      if (isRow(el)) return completeRow(el);
      if (!fallback && CONTENT_SIGNAL.test(blob(el))) fallback = el;
    }
    return fallback ? completeRow(fallback) : null;
  }

  // Ignore our controls. Add boundaries for rich-text paragraphs and line breaks.
  function messageText(el) {
    let text = '';
    function visit(node) {
      if (node.nodeType === 3) { text += node.nodeValue; return; }
      if (node.nodeType !== 1) return;
      if (node.matches('[data-cvf-hide-btn], script, style, button, time, [contenteditable="true"]')) return;
      const block = /^(P|DIV|LI|BR|PRE|BLOCKQUOTE)$/.test(node.tagName);
      if (block) text += ' ';
      for (const child of node.childNodes) visit(child);
      if (block) text += ' ';
    }
    visit(el);
    return normalizeText(text);
  }

  function hashText(text) {
    let h = 0;
    const t = (text || '').trim().toLowerCase();
    for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
    return String(h);
  }

  function identity(el, text) {
    const identified = el.matches('[data-message-id], [data-comment-id]') ? el :
      el.querySelector('[data-message-id], [data-comment-id]');
    const id = (identified && (identified.getAttribute('data-message-id') || identified.getAttribute('data-comment-id'))) ||
      (/^(?:message|comment)[-_]/i.test(el.id) ? el.id : '');
    return id ? `id:${location.pathname}:${id}` : `text:${location.pathname}:${hashText(text)}`;
  }

  function isManuallyHidden(el, text) {
    if (hiddenHashes.has(identity(el, text)) || hiddenHashes.has(hashText(text))) return true;
    // Keep manual selections from versions that stored only the inner bubble.
    return Array.from(el.querySelectorAll(CANDIDATE_SELECTOR)).some((part) => {
      const partText = messageText(part);
      return hiddenHashes.has(identity(part, partText)) || hiddenHashes.has(hashText(partText));
    });
  }

  function clearMark(el) {
    const previous = marked.get(el);
    if (!previous) return;
    for (const [property, value, priority] of previous) {
      if (value) el.style.setProperty(property, value, priority);
      else el.style.removeProperty(property);
    }
    el.removeAttribute(HIDDEN);
    marked.delete(el);
  }

  function applyMark(el) {
    if (!marked.has(el)) {
      marked.set(el, ['display'].map((property) =>
        [property, el.style.getPropertyValue(property), el.style.getPropertyPriority(property)]));
    }
    el.setAttribute(HIDDEN, '1');
    if (config.reveal) {
      const display = marked.get(el)[0];
      if (display[1]) el.style.setProperty(...display);
      else el.style.removeProperty('display');
    } else {
      el.style.setProperty('display', 'none', 'important');
    }
  }

  function clearButtons() {
    document.querySelectorAll('[data-cvf-hide-btn]').forEach((btn) => btn.remove());
  }

  function addHideButton(el) {
    if (el.querySelector('[data-cvf-hide-btn]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-cvf-hide-btn', '1');
    btn.textContent = 'Hide';
    btn.title = 'Hide this message (your view only)';
    btn.style.cssText = 'float:right;position:relative;z-index:1;padding:2px 6px;border-radius:4px;border:0;background:#d93025;color:white;font:11px/1.2 sans-serif;cursor:pointer';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      hiddenHashes.add(identity(el, messageText(el)));
      api.storage.local.set({ [HIDDEN_KEY]: Array.from(hiddenHashes) }).catch(console.error);
      scan();
    });
    el.appendChild(btn);
  }

  function scan() {
    const matches = new Set();
    const active = config.enabled && inScope();
    if (active) {
      const candidates = new Set();
      document.querySelectorAll(CANDIDATE_SELECTOR).forEach((el) => {
        const row = findContainer(el);
        if (row) candidates.add(row);
      });
      for (const el of candidates) {
        // Keep neighboring messages and shared author groups visible.
        if (containsMultipleMessages(el)) continue;
        const text = messageText(el);
        const matched = text && isManuallyHidden(el, text);
        if (matched) matches.add(el);
        else if (text && controlsVisible) addHideButton(el);
      }
    }
    for (const el of marked.keys()) {
      if (!matches.has(el)) clearMark(el);
    }
    if (!active) controlsVisible = false;
    if (!controlsVisible) clearButtons();
    for (const el of matches) {
      const btn = el.querySelector('[data-cvf-hide-btn]');
      if (btn) btn.remove();
      applyMark(el);
    }
    lastMatch = matches.size;
  }

  function status() {
    return { ok: true, href: location.href, enabled: config.enabled, inScope: inScope(),
      matched: lastMatch, hidden: config.enabled && inScope() && !config.reveal ? lastMatch : 0,
      manualHidden: hiddenHashes.size, reveal: config.reveal, controlsVisible };
  }

  function toggleControls() {
    controlsVisible = config.enabled && inScope() ? !controlsVisible : false;
    scan();
  }

  function schedule(delay = 150) {
    // Coalesce mutations without letting a busy chat postpone filtering forever.
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      try { scan(); } catch (error) { console.error('[ClickUp View Filter]', error); }
    }, delay);
  }

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'cvf:rescan') {
      loadConfig().then(() => { scan(); sendResponse(status()); }).catch((error) => {
        console.error('[ClickUp View Filter]', error);
        sendResponse({ ok: false });
      });
      return true;
    }
    if (msg.type === 'cvf:status') {
      scan();
      sendResponse(status());
    } else if (msg.type === 'cvf:toggle-controls') {
      toggleControls();
      sendResponse(status());
    } else if (msg.type === 'cvf:toggle') {
      config.reveal = !config.reveal;
      api.storage.local.set({ [KEY]: config }).catch(console.error);
      scan();
      sendResponse(status());
    } else if (msg.type === 'cvf:reveal-all') {
      hiddenHashes.clear();
      api.storage.local.set({ [HIDDEN_KEY]: [] }).catch(console.error);
      scan();
      sendResponse(status());
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[KEY] || changes[HIDDEN_KEY])) {
      loadConfig().then(() => schedule(0)).catch(console.error);
    }
  });

  // Our own controls and inline styles must not trigger another scan.
  new MutationObserver((records) => {
    if (records.some((record) => {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target && target.closest('[data-cvf-hide-btn]')) return false;
      if (record.type === 'childList') {
        return [...record.addedNodes, ...record.removedNodes].some((node) =>
          node.nodeType !== 1 || !node.matches('[data-cvf-hide-btn]'));
      }
      return true;
    })) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && controlsVisible) {
      controlsVisible = false;
      scan();
    }
  });
  window.addEventListener('popstate', () => schedule(0));
  window.addEventListener('hashchange', () => schedule(0));
  setInterval(() => schedule(0), 3000);
  loadConfig().then(scan).catch((error) => console.error('[ClickUp View Filter]', error));
})();
