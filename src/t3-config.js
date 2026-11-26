(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const STORAGE_KEY = 't3.obsidianPrism.config.v1';
  const SETTING_BINDING = '__t3OpSetting';

  const DEFAULT_CONFIG = Object.freeze({
    palette: 'obsidian',       // 'obsidian' | 'warm' | 'host'
    lightPreset: 'crystal',    // 'crystal' | 'alabaster'
    accentTone: 'follow',      // 'follow' | 'cobalt' | 'iris' | 'amber' | 'mono'
    cornerStyle: 'balanced',   // 'sharp' | 'balanced' | 'soft'
    motionLevel: 'ultra',      // 'off' | 'subtle' | 'standard' | 'ultra'
    ambientIntensity: '100',   // '0' | '35' | '70' | '100'
    homeRipple: true,
    convRipple: 'subtle',      // 'off' | 'subtle' | 'medium' | 'full'
    prismRim: true,
    streamInk: true,
    effortSlider: true,
    periodicBadges: true,
    vialHud: true,
    studioHome: true,
    mascot: 'minis',           // 'off' | 'crab' | 'minis' | 'quad' | 'quad-minis'
    smoothCaret: true,
    codeFold: true,
    outlineRail: true,
    sidebarChatMode: true,
    pollIntervalMs: 2500,
  });

  const ENUMS = Object.freeze({
    palette: ['obsidian', 'warm', 'host'],
    lightPreset: ['crystal', 'alabaster'],
    accentTone: ['follow', 'cobalt', 'iris', 'amber', 'mono'],
    cornerStyle: ['sharp', 'balanced', 'soft'],
    motionLevel: ['off', 'subtle', 'standard', 'ultra'],
    ambientIntensity: ['0', '35', '70', '100'],
    convRipple: ['off', 'subtle', 'medium', 'full'],
    mascot: ['off', 'crab', 'minis', 'quad', 'quad-minis'],
  });

  const BOOLEANS = new Set([
    'homeRipple',
    'prismRim',
    'streamInk',
    'effortSlider',
    'periodicBadges',
    'vialHud',
    'studioHome',
    'smoothCaret',
    'codeFold',
    'outlineRail',
    'sidebarChatMode',
  ]);

  function validateEntry(key, value) {
    if (key === 'pollIntervalMs') {
      const n = Number(value);
      return Number.isFinite(n) && n >= 500 && n <= 30000;
    }
    if (BOOLEANS.has(key)) return typeof value === 'boolean';
    if (Object.prototype.hasOwnProperty.call(ENUMS, key)) {
      return ENUMS[key].includes(String(value));
    }
    return false;
  }

  function normalizeConfig(raw) {
    const out = { ...DEFAULT_CONFIG };
    if (!raw || typeof raw !== 'object') return out;
    for (const [k, v] of Object.entries(raw)) {
      if (keyIsKnown(k)) {
        if (k === 'ambientIntensity' && typeof v === 'number') {
          const s = String(v);
          if (validateEntry(k, s)) out[k] = s;
        } else if (validateEntry(k, v)) {
          out[k] = k === 'pollIntervalMs' ? Number(v) : v;
        }
      }
    }
    return out;
  }

  function keyIsKnown(k) {
    return Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, k);
  }

  function detectDarkTheme(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return true;
    const html = d.documentElement;
    if (html) {
      if (html.classList.contains('dark')) return true;
      if (html.classList.contains('light')) return false;
      const scheme = html.getAttribute('data-color-scheme') || html.style?.colorScheme || '';
      if (scheme === 'light') return false;
      if (scheme === 'dark') return true;
    }
    try {
      if (typeof getComputedStyle === 'function' && d.body) {
        const bg = getComputedStyle(d.body).backgroundColor || '';
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255;
          return lum < 0.52;
        }
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch {}
    return true;
  }

  function createConfigStore(initialConfig) {
    let stored = null;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) stored = JSON.parse(raw);
    } catch {}

    let state = normalizeConfig({ ...(stored || {}), ...(initialConfig || {}) });
    const listeners = new Set();

    function applyRootAttrs(doc) {
      const d = doc || (typeof document !== 'undefined' ? document : null);
      const html = d?.documentElement;
      if (!html) return;
      const isDark = detectDarkTheme(d);
      const set = (k, v) => {
        if (html.getAttribute(k) !== String(v)) html.setAttribute(k, String(v));
      };
      // T3 Obsidian Prism attributes
      set('data-t3-op-active', '1');
      set('data-t3-op-dark', isDark ? '1' : '0');
      set('data-t3-op-palette', state.palette);
      set('data-t3-op-light-preset', state.lightPreset);
      set('data-t3-op-accent', state.accentTone);
      set('data-t3-op-corner', state.cornerStyle);
      set('data-t3-op-motion', state.motionLevel);
      set('data-t3-op-ambient', state.ambientIntensity);
      set('data-t3-op-stream-ink', state.streamInk ? 'on' : 'off');
      set('data-t3-op-mascot', state.mascot);

      // Mirror upstream Obsidian Prism attributes so all 8 optical engines auto-sync
      set('data-ag-cs-palette', state.palette);
      set('data-ag-cs-light-preset', state.lightPreset);
      set('data-ag-cs-accent', state.accentTone);
      set('data-ag-cs-motion', state.motionLevel);
      set('data-ag-cs-ambient', state.ambientIntensity);
    }

    function clearRootAttrs(doc) {
      const d = doc || (typeof document !== 'undefined' ? document : null);
      const html = d?.documentElement;
      if (!html) return;
      for (const attr of [
        'data-t3-op-active',
        'data-t3-op-dark',
        'data-t3-op-palette',
        'data-t3-op-light-preset',
        'data-t3-op-accent',
        'data-t3-op-corner',
        'data-t3-op-motion',
        'data-t3-op-ambient',
        'data-t3-op-stream-ink',
        'data-t3-op-mascot',
        'data-t3-op-chat-mode',
        'data-ag-cs-palette',
        'data-ag-cs-light-preset',
        'data-ag-cs-accent',
        'data-ag-cs-motion',
        'data-ag-cs-ambient',
        'data-ag-cs-win-blur',
      ]) {
        html.removeAttribute(attr);
      }
    }

    function persist(patch) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
      } catch {}
      try {
        if (typeof G[SETTING_BINDING] === 'function' && patch && Object.keys(patch).length > 0) {
          G[SETTING_BINDING](JSON.stringify(patch));
        }
      } catch {}
    }

    function update(patch, opts = {}) {
      if (!patch || typeof patch !== 'object') return state;
      const validPatch = {};
      let changed = false;
      for (const [k, rawV] of Object.entries(patch)) {
        const v = k === 'ambientIntensity' && typeof rawV === 'number' ? String(rawV) : rawV;
        if (!validateEntry(k, v)) continue;
        if (state[k] !== v) {
          validPatch[k] = k === 'pollIntervalMs' ? Number(v) : v;
          changed = true;
        }
      }
      if (!changed) return state;
      state = { ...state, ...validPatch };
      applyRootAttrs();
      if (!opts.silentPersist) persist(validPatch);
      for (const fn of listeners) {
        try {
          fn(state, validPatch);
        } catch {}
      }
      return state;
    }

    function reset() {
      return update({ ...DEFAULT_CONFIG });
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    return {
      get: () => state,
      update,
      reset,
      subscribe,
      applyRootAttrs,
      clearRootAttrs,
      detectDarkTheme,
    };
  }

  const api = {
    STORAGE_KEY,
    SETTING_BINDING,
    DEFAULT_CONFIG,
    ENUMS,
    validateEntry,
    normalizeConfig,
    detectDarkTheme,
    createConfigStore,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
