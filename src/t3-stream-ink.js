(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const HIGHLIGHT_NAMES = ['t3-stream-f0', 't3-stream-f1', 't3-stream-f2', 't3-stream-f3', 't3-stream-f4'];
  const STEP_MS = 60;
  const TOTAL_MS = STEP_MS * HIGHLIGHT_NAMES.length;
  const MAX_ACTIVE_ITEMS = 64;

  function supportsCssHighlights() {
    return typeof CSS !== 'undefined' && Boolean(CSS.highlights) && typeof Highlight === 'function';
  }

  function createStreamInkController({ isEnabled, isReducedMotion }) {
    let destroyed = false;
    let rafId = 0;
    let obs = null;
    const textLenMap = new WeakMap();
    const activeItems = [];
    let buckets = null;

    function ensureBuckets() {
      if (!supportsCssHighlights()) return null;
      if (buckets) return buckets;
      buckets = HIGHLIGHT_NAMES.map((name) => {
        const hl = new Highlight();
        try {
          CSS.highlights.set(name, hl);
        } catch {}
        return hl;
      });
      return buckets;
    }

    function clearHighlights() {
      activeItems.length = 0;
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (buckets) {
        for (const hl of buckets) {
          try {
            hl.clear();
          } catch {}
        }
      }
    }

    function unregisterHighlights() {
      clearHighlights();
      if (supportsCssHighlights()) {
        for (const name of HIGHLIGHT_NAMES) {
          try {
            CSS.highlights.delete(name);
          } catch {}
        }
      }
      buckets = null;
    }

    function scheduleTick() {
      if (destroyed || rafId || activeItems.length === 0) return;
      if (typeof requestAnimationFrame !== 'function') return;
      rafId = requestAnimationFrame(tick);
    }

    function tick(now) {
      rafId = 0;
      if (destroyed) return;
      const b = ensureBuckets();
      if (!b) {
        activeItems.length = 0;
        return;
      }
      for (let i = 0; i < b.length; i += 1) b[i].clear();

      let writeIdx = 0;
      for (let i = 0; i < activeItems.length; i += 1) {
        const item = activeItems[i];
        if (!item.node || item.node.isConnected === false) continue;
        const elapsed = now - item.startAt;
        if (elapsed >= TOTAL_MS) continue;
        const stage = Math.max(0, Math.min(HIGHLIGHT_NAMES.length - 1, Math.floor(elapsed / STEP_MS)));
        const maxLen = item.node.nodeValue ? item.node.nodeValue.length : 0;
        const s = Math.max(0, Math.min(item.startOffset, maxLen));
        const e = Math.max(s, Math.min(item.endOffset, maxLen));
        if (e > s) {
          try {
            const range = document.createRange();
            range.setStart(item.node, s);
            range.setEnd(item.node, e);
            b[stage].add(range);
            activeItems[writeIdx++] = item;
          } catch {}
        }
      }
      activeItems.length = writeIdx;
      if (activeItems.length > 0) scheduleTick();
    }

    function enqueueRange(textNode, startOffset, endOffset) {
      if (destroyed || !isEnabled() || isReducedMotion?.()) return;
      if (!supportsCssHighlights()) return;
      if (!textNode || textNode.nodeType !== 3 || !textNode.isConnected) return;
      if (endOffset <= startOffset) return;
      ensureBuckets();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      activeItems.push({ node: textNode, startOffset, endOffset, startAt: now });
      if (activeItems.length > MAX_ACTIVE_ITEMS) {
        activeItems.splice(0, activeItems.length - MAX_ACTIVE_ITEMS);
      }
      scheduleTick();
    }

    function scanTextNode(node, animateNew) {
      if (!node || node.nodeType !== 3) return;
      const len = node.nodeValue ? node.nodeValue.length : 0;
      const prev = textLenMap.get(node);
      textLenMap.set(node, len);
      if (animateNew && len > (prev || 0)) {
        enqueueRange(node, prev || 0, len);
      }
    }

    function walkSubtree(el, animateNew) {
      if (!el) return;
      if (el.nodeType === 3) {
        scanTextNode(el, animateNew);
        return;
      }
      if (el.nodeType !== 1) return;
      // Skip code blocks / kbd / svg where syntax highlight already paints tokens
      const tag = String(el.tagName || '').toUpperCase();
      if (tag === 'PRE' || tag === 'CODE' || tag === 'SVG' || tag === 'STYLE' || tag === 'SCRIPT') return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        const parentTag = String(n.parentElement?.tagName || '').toUpperCase();
        if (parentTag !== 'CODE' && parentTag !== 'PRE' && parentTag !== 'STYLE' && parentTag !== 'SCRIPT') {
          scanTextNode(n, animateNew);
        }
        n = walker.nextNode();
      }
    }

    function isInsideStreamingMarkdown(node) {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      if (!el || !el.closest) return false;
      return Boolean(el.closest('.chat-markdown[data-streaming], [data-t3op-streaming="1"]'));
    }

    function start() {
      if (destroyed || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
      if (obs) return;
      // Seed existing text nodes without animating historical text
      document.querySelectorAll('.chat-markdown').forEach((el) => walkSubtree(el, false));
      obs = new MutationObserver((records) => {
        if (destroyed || !isEnabled()) return;
        for (const rec of records) {
          if (rec.type === 'characterData') {
            if (isInsideStreamingMarkdown(rec.target)) {
              scanTextNode(rec.target, true);
            }
          } else if (rec.type === 'childList' && rec.addedNodes && rec.addedNodes.length > 0) {
            if (!isInsideStreamingMarkdown(rec.target)) continue;
            for (const added of rec.addedNodes) {
              walkSubtree(added, true);
            }
          }
        }
      });
      obs.observe(document.body || document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    function refresh() {
      if (!isEnabled() || isReducedMotion?.()) {
        clearHighlights();
      } else {
        ensureBuckets();
      }
    }

    function destroy() {
      destroyed = true;
      if (obs) {
        try {
          obs.disconnect();
        } catch {}
        obs = null;
      }
      unregisterHighlights();
    }

    return {
      start,
      refresh,
      clearHighlights,
      enqueueRange,
      destroy,
      getActiveCount: () => activeItems.length,
    };
  }

  const api = { HIGHLIGHT_NAMES, supportsCssHighlights, createStreamInkController };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpStreamInk = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
