(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const RIPPLE_HOST_CLASS = 't3op-ripple-host';
  const MASCOT_STAGE_CLASS = 't3op-mascot-stage';
  const SMOOTH_CARET_CLASS = 'ag-cs-smooth-caret';

  function resolveSpectrumName(cfg, isDark) {
    if (cfg.accentTone && cfg.accentTone !== 'follow') return cfg.accentTone;
    if (cfg.palette === 'warm' || (!isDark && cfg.lightPreset === 'alabaster')) return 'warm';
    return 'default';
  }

  function createOpticsHost({ configStore, getRuntimeState }) {
    let destroyed = false;
    let rafId = 0;
    let lastTickMs = 0;
    let pointerX = -9999;
    let pointerY = -9999;
    let prevPointerX = -9999;
    let prevPointerY = -9999;
    let prevPointerAt = 0;

    // Ripple & Horizon state
    let rippleContainer = null;
    let rippleHostEl = null;
    let horizonCanvas = null;
    let rippleCanvas = null;
    let horizonCtl = null;
    let waves = null;
    let glyphField = null;
    let rippleCols = 0;
    let rippleRows = 0;
    let rippleRo = null;

    // 1px GPU Prism Rim state
    let prismRimCtl = null;
    let activeCrystalTrack = null;
    let activeCrystalCtrl = null;
    let lastRimState = null;

    // Mascot stage state
    let mascotComposer = null;
    let mascotStageEl = null;
    let mascotRig = null;

    // Smooth caret state
    let caretEl = null;
    let caretHostEl = null;
    let caretRaf = 0;
    let caretHiddenTimer = 0;

    let mutatingGuard = false;
    const runGuardedMut = (fn) => {
      const prev = mutatingGuard;
      mutatingGuard = true;
      try {
        return fn();
      } finally {
        mutatingGuard = prev;
      }
    };

    const setAttrIfChanged = (el, k, v) => {
      if (!el?.setAttribute) return;
      const sv = String(v);
      if (el.getAttribute(k) !== sv) el.setAttribute(k, sv);
    };

    function isMotionReduced() {
      const cfg = configStore.get();
      if (cfg.motionLevel === 'off') return true;
      try {
        return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch {
        return false;
      }
    }

    function isHomeEmptyState(convArea) {
      if (!convArea) return false;
      const msgs = convArea.querySelectorAll('[data-message-role="user"], [data-message-role="assistant"]');
      for (const el of msgs) {
        if (el.offsetParent !== null && !el.closest('.hidden')) return false;
      }
      return true;
    }

    function getRippleVisibility(convArea) {
      const cfg = configStore.get();
      if (cfg.motionLevel === 'off' || Number(cfg.ambientIntensity) <= 0) return { enabled: false, alphaScale: 0, isHome: true };
      const isHome = isHomeEmptyState(convArea);
      if (isHome) {
        return { enabled: Boolean(cfg.homeRipple), alphaScale: 1, isHome: true };
      }
      if (cfg.convRipple === 'off') return { enabled: false, alphaScale: 0, isHome: false };
      const map = { subtle: 0.36, medium: 0.65, full: 0.95 };
      return { enabled: true, alphaScale: map[cfg.convRipple] || 0.36, isHome: false };
    }

    function rebuildRippleField() {
      const core = G.__agCsRippleCore;
      if (!core || !rippleHostEl || !rippleCanvas || !horizonCanvas) return;
      const rect = rippleHostEl.getBoundingClientRect();
      const w = Math.max(0, Math.floor(rect.width));
      const h = Math.max(0, Math.floor(rect.height));
      if (w < 32 || h < 32) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const cellW = core.RIPPLE?.cellWidth || 12;
      const cellH = core.RIPPLE?.cellHeight || 20;
      const cols = Math.max(8, Math.ceil(w / cellW));
      const rows = Math.max(6, Math.ceil(h / cellH));

      if (horizonCtl) {
        horizonCtl.resize(w, h, dpr);
      } else {
        horizonCtl = core.mountBrandHorizonGlow(horizonCanvas, {
          width: w,
          height: h,
          dpr,
          reach: 0.62,
          prism: 0.85,
          speed: 1,
        });
      }

      if (cols !== rippleCols || rows !== rippleRows || !glyphField || !waves) {
        if (glyphField) {
          try {
            glyphField.dispose();
          } catch {}
          glyphField = null;
        }
        // Always swap in a fresh <canvas> before creating a new WebGL2 context,
        // because dispose() invokes WEBGL_lose_context on the previous canvas element.
        if (rippleCanvas && rippleCanvas.parentNode) {
          const freshCanvas = document.createElement('canvas');
          freshCanvas.className = 't3op-ripple-canvas';
          rippleCanvas.replaceWith(freshCanvas);
          rippleCanvas = freshCanvas;
        }
        rippleCols = cols;
        rippleRows = rows;
        rippleCanvas.width = Math.max(1, Math.round(w * dpr));
        rippleCanvas.height = Math.max(1, Math.round(h * dpr));
        waves = core.createWaveField(cols, rows);
        glyphField = core.createGlyphField(rippleCanvas, cols, rows, waves, {});
        // Gentle welcome swell on first mount
        try {
          glyphField.triggerTideSwell();
        } catch {}
      }
      ensureLoop();
    }

    function mountRippleIfNeeded() {
      if (destroyed || !G.__agCsRippleCore) return;
      const convArea = document.querySelector('[data-workspace-area="conversation"]') || document.querySelector('main');
      if (!convArea) return;
      const vis = getRippleVisibility(convArea);

      if (!vis.enabled) {
        if (rippleHostEl) {
          rippleHostEl.style.display = 'none';
        }
        return;
      }

      if (rippleContainer !== convArea || !rippleHostEl || !rippleHostEl.isConnected) {
        teardownRipple();
        rippleContainer = convArea;
        if (getComputedStyle(convArea).position === 'static') {
          convArea.style.position = 'relative';
        }
        rippleHostEl = document.createElement('div');
        rippleHostEl.className = RIPPLE_HOST_CLASS;
        rippleHostEl.setAttribute('aria-hidden', 'true');
        rippleHostEl.setAttribute('data-t3op-owned', '1');

        horizonCanvas = document.createElement('canvas');
        horizonCanvas.className = 't3op-horizon-canvas';
        rippleCanvas = document.createElement('canvas');
        rippleCanvas.className = 't3op-ripple-canvas';

        rippleHostEl.appendChild(horizonCanvas);
        rippleHostEl.appendChild(rippleCanvas);
        convArea.insertBefore(rippleHostEl, convArea.firstChild);

        if (typeof ResizeObserver === 'function') {
          rippleRo = new ResizeObserver(() => {
            if (!destroyed) rebuildRippleField();
          });
          rippleRo.observe(convArea);
        }
        rebuildRippleField();
      } else {
        rippleHostEl.style.display = '';
        if (!glyphField) rebuildRippleField();
      }
    }

    function teardownRipple() {
      if (rippleRo) {
        try {
          rippleRo.disconnect();
        } catch {}
        rippleRo = null;
      }
      if (glyphField) {
        try {
          glyphField.dispose();
        } catch {}
        glyphField = null;
      }
      if (horizonCtl) {
        try {
          horizonCtl.dispose();
        } catch {}
        horizonCtl = null;
      }
      waves = null;
      rippleCols = 0;
      rippleRows = 0;
      if (rippleHostEl) {
        try {
          rippleHostEl.remove();
        } catch {}
        rippleHostEl = null;
      }
      horizonCanvas = null;
      rippleCanvas = null;
      rippleContainer = null;
    }

    function buildRipplePalette(isDark, vis) {
      const cfg = configStore.get();
      const core = G.__agCsRippleCore;
      const ambient = Math.max(0, Math.min(1, Number(cfg.ambientIntensity || 100) / 100));
      const spectrum = resolveSpectrumName(cfg, isDark);
      const specCode = core?.resolveHorizonSpectrumCode ? core.resolveHorizonSpectrumCode(spectrum) : 0;
      const isWarm = spectrum === 'warm';
      const ink = isDark
        ? (isWarm ? [232, 212, 194] : [178, 196, 224])
        : (isWarm ? [92, 74, 58] : [58, 78, 114]);
      const wave = isDark
        ? (isWarm ? [240, 163, 126] : [116, 178, 255])
        : (isWarm ? [194, 89, 52] : [37, 99, 235]);
      return {
        dark: isDark,
        ink,
        wave,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        ambientIntensity: ambient,
        alphaScale: vis.alphaScale,
        prismStrength: cfg.accentTone === 'mono' ? 0.15 : 1,
        spectrumCode: specCode,
        nebulaEnabled: vis.isHome,
      };
    }

    function ensureLoop() {
      if (destroyed || rafId || typeof requestAnimationFrame !== 'function') return;
      rafId = requestAnimationFrame(onFrame);
    }

    function onFrame(now) {
      rafId = 0;
      if (destroyed) return;
      if (document.hidden) return;
      const dtSec = lastTickMs > 0 ? Math.min(0.05, Math.max(0.004, (now - lastTickMs) / 1000)) : 0.016;
      lastTickMs = now;

      let keepAlive = false;
      const cfg = configStore.get();
      const isDark = configStore.detectDarkTheme();
      const rt = getRuntimeState ? getRuntimeState() : {};
      const convArea = rippleContainer;

      if (convArea && rippleHostEl && rippleHostEl.style.display !== 'none') {
        const vis = getRippleVisibility(convArea);
        if (vis.enabled) {
          const ambient = Math.max(0, Math.min(1, Number(cfg.ambientIntensity || 100) / 100));
          const spectrum = resolveSpectrumName(cfg, isDark);
          const semantic = rt.hasError ? 'error' : rt.streaming ? 'running' : rt.waiting ? 'waiting' : 'none';

          if (horizonCtl) {
            horizonCtl.draw(now, {
              dark: isDark,
              spectrum,
              semantic,
              ambientIntensity: ambient * (vis.isHome ? 1 : vis.alphaScale * 0.85),
            });
            if (!horizonCtl.isSleeping()) keepAlive = true;
          }
          if (waves && glyphField) {
            if (waves.active()) {
              waves.advance(dtSec);
              keepAlive = true;
            }
            const pal = buildRipplePalette(isDark, vis);
            if (glyphField.needsDraw(now, false)) {
              glyphField.draw(now, pal, false);
            }
            if (glyphField.busy()) keepAlive = true;
          }
        }
      }

      if (keepAlive && !isMotionReduced()) {
        rafId = requestAnimationFrame(onFrame);
      }
    }

    function triggerSendLiftoff() {
      if (!glyphField) return;
      try {
        glyphField.triggerLiftoffBurst(0.5, 0.78);
        ensureLoop();
      } catch {}
    }

    // ── 1px GPU Prism Rim Controller ──────────────────────────────────────────
    function tagPrismBoxes() {
      const cfg = configStore.get();
      const enable = Boolean(cfg.prismRim && cfg.motionLevel !== 'off' && Number(cfg.ambientIntensity) > 0);
      const selectors = [
        '[data-slot="composer-host"]',
        '.t3op-studio-card',
        '.t3op-vial-popover',
        '[data-slot="popover-popup"]',
      ];
      const nodes = document.querySelectorAll(selectors.join(','));
      nodes.forEach((el) => {
        if (enable) {
          setAttrIfChanged(el, 'data-ag-cs-prism-box', '1');
          if (el.classList.contains('t3op-studio-card')) {
            setAttrIfChanged(el, 'data-ag-cs-prism-mirror', '1');
          }
        } else {
          el.removeAttribute('data-ag-cs-prism-box');
          el.removeAttribute('data-ag-cs-prism-mirror');
        }
      });
      if (prismRimCtl) prismRimCtl.markDirty();
    }

    function initPrismRim() {
      const mod = G.__agPrismRimCanvas;
      if (!mod || prismRimCtl) return;
      prismRimCtl = mod.createPrismRimCanvasController({
        isDestroyed: () => destroyed,
        isDarkTheme: () => configStore.detectDarkTheme(),
        motionReduced: () => isMotionReduced() || !configStore.get().prismRim,
        getMinFrameGapMs: () => 8,
        getAmbientIntensity: () => configStore.get().ambientIntensity,
        getAccentTone: () => configStore.get().accentTone,
        canMountRealCanvas: () => true,
        setAttrIfChanged,
        runGuardedMut,
        getActiveCrystalTrack: () => activeCrystalTrack,
        setCrystalPointerClient: (x, y) => {
          if (activeCrystalCtrl?.setPointerClient) activeCrystalCtrl.setPointerClient(x, y);
        },
        onPointerActivity: () => {},
        onComposerRimUpdate: (rimInfo) => {
          lastRimState = rimInfo;
          if (mascotRig && typeof mascotRig.notify === 'function') {
            try {
              mascotRig.notify('prismRim', rimInfo);
            } catch {}
          }
        },
      });
      tagPrismBoxes();
    }

    // ── Pixel Companions Stage (dual-mascot-rig.js) ───────────────────────────
    function syncMascotStage() {
      if (destroyed) return;
      const cfg = configStore.get();
      const rigMod = G.__agDualMascotRig;
      const composer = document.querySelector('[data-slot="composer-host"]');
      if (!rigMod || !composer || cfg.mascot === 'off') {
        teardownMascot();
        return;
      }

      if (mascotComposer !== composer || !mascotStageEl || !mascotStageEl.isConnected) {
        teardownMascot();
        mascotComposer = composer;
        mascotStageEl = document.createElement('div');
        mascotStageEl.className = MASCOT_STAGE_CLASS;
        mascotStageEl.setAttribute('data-t3op-owned', '1');
        composer.appendChild(mascotStageEl);
        const rt = getRuntimeState ? getRuntimeState() : {};
        mascotRig = rigMod.mountDualMascotStage(mascotStageEl, {
          camp: rt.camp || 'gemini',
          mascot: cfg.mascot,
          streaming: Boolean(rt.streaming),
          hasError: Boolean(rt.hasError),
          orchestrator: Boolean(rt.orchestrator),
          reducedMotion: isMotionReduced(),
        });
      }

      if (mascotRig) {
        const rt = getRuntimeState ? getRuntimeState() : {};
        mascotRig.setState({
          camp: rt.camp || 'gemini',
          mascot: cfg.mascot,
          streaming: Boolean(rt.streaming),
          hasError: Boolean(rt.hasError),
          orchestrator: Boolean(rt.orchestrator),
          reducedMotion: isMotionReduced(),
        });
        if (lastRimState && typeof mascotRig.notify === 'function') {
          try {
            mascotRig.notify('prismRim', lastRimState);
          } catch {}
        }
      }
    }

    function teardownMascot() {
      if (mascotRig) {
        try {
          mascotRig.dispose();
        } catch {}
        mascotRig = null;
      }
      if (mascotStageEl) {
        try {
          mascotStageEl.remove();
        } catch {}
        mascotStageEl = null;
      }
      mascotComposer = null;
    }

    // ── Smooth Caret for T3 TipTap / ContentEditable Composer ─────────────────
    function hideSmoothCaret() {
      if (caretEl) {
        caretEl.style.opacity = '0';
      }
    }

    function syncSmoothCaretNow() {
      caretRaf = 0;
      if (destroyed) return;
      const cfg = configStore.get();
      if (!cfg.smoothCaret || isMotionReduced()) {
        hideSmoothCaret();
        return;
      }
      const active = document.activeElement;
      const editor = active?.closest?.('.composer-tiptap [contenteditable="true"], [data-slot="composer-host"] [contenteditable="true"]')
        || (active?.isContentEditable && active.closest('[data-slot="composer-host"]') ? active : null);
      if (!editor) {
        hideSmoothCaret();
        return;
      }
      const host = editor.closest('[data-slot="composer-host"]') || editor.parentElement;
      if (!host) return;
      const sel = window.getSelection ? window.getSelection() : null;
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
        hideSmoothCaret();
        return;
      }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.startContainer)) {
        hideSmoothCaret();
        return;
      }
      let rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        if (rects && rects.length > 0) {
          rect = rects[0];
        } else {
          const edRect = editor.getBoundingClientRect();
          const cs = getComputedStyle(editor);
          const padL = parseFloat(cs.paddingLeft) || 8;
          const padT = parseFloat(cs.paddingTop) || 8;
          const lh = parseFloat(cs.lineHeight) || 20;
          rect = { left: edRect.left + padL, top: edRect.top + padT, height: lh };
        }
      }
      const hostRect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const snap = (v) => Math.round(v * dpr) / dpr;
      const x = snap(rect.left - hostRect.left);
      const y = snap(rect.top - hostRect.top);
      const h = Math.max(14, Math.min(30, snap(rect.height || 18)));

      if (!caretEl || caretHostEl !== host || !caretEl.isConnected) {
        if (caretEl) caretEl.remove();
        caretEl = document.createElement('div');
        caretEl.className = SMOOTH_CARET_CLASS;
        caretEl.setAttribute('data-t3op-owned', '1');
        caretEl.setAttribute('aria-hidden', 'true');
        host.appendChild(caretEl);
        caretHostEl = host;
      }
      caretEl.style.left = '0px';
      caretEl.style.top = '0px';
      caretEl.style.height = `${h}px`;
      caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      caretEl.style.opacity = '1';
      if (caretHiddenTimer) clearTimeout(caretHiddenTimer);
      caretHiddenTimer = setTimeout(() => {
        if (caretEl && document.activeElement !== editor) caretEl.style.opacity = '0';
      }, 2800);
    }

    function queueSmoothCaret() {
      if (destroyed || caretRaf || typeof requestAnimationFrame !== 'function') return;
      caretRaf = requestAnimationFrame(syncSmoothCaretNow);
    }

    // ── Unified Pointer / Lifecycle Events ────────────────────────────────────
    function onPointerMove(ev) {
      if (destroyed) return;
      const x = Number(ev.clientX);
      const y = Number(ev.clientY);
      pointerX = x;
      pointerY = y;

      if (prismRimCtl) prismRimCtl.onPointerMove(ev);

      if (waves && rippleCanvas && rippleHostEl && rippleHostEl.style.display !== 'none') {
        const rect = rippleCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          const core = G.__agCsRippleCore;
          const cellW = core?.RIPPLE?.cellWidth || 12;
          const cellH = core?.RIPPLE?.cellHeight || 20;
          const col = (x - rect.left) / cellW;
          const row = (y - rect.top) / cellH;
          const now = performance.now();
          const dt = Math.max(8, now - prevPointerAt);
          const dist = prevPointerX > -1000 ? Math.hypot(x - prevPointerX, y - prevPointerY) : 6;
          const speedNorm = Math.min(1, dist / (dt * 0.9));
          prevPointerX = x;
          prevPointerY = y;
          prevPointerAt = now;
          waves.skimmer(col, row, speedNorm);
          ensureLoop();
        }
      }
    }

    function onPointerDown(ev) {
      if (destroyed) return;
      if (waves && rippleCanvas && rippleHostEl && rippleHostEl.style.display !== 'none') {
        const rect = rippleCanvas.getBoundingClientRect();
        const x = Number(ev.clientX);
        const y = Number(ev.clientY);
        if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          const core = G.__agCsRippleCore;
          const col = (x - rect.left) / (core?.RIPPLE?.cellWidth || 12);
          const row = (y - rect.top) / (core?.RIPPLE?.cellHeight || 20);
          waves.disturb(col, row, { amplitudeScale: 1.15, radiusScale: 1.25 });
          ensureLoop();
        }
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else {
        lastTickMs = 0;
        ensureLoop();
      }
    }

    function onWindowBlur() {
      document.documentElement.setAttribute('data-ag-cs-win-blur', '1');
    }

    function onWindowFocus() {
      document.documentElement.setAttribute('data-ag-cs-win-blur', '0');
      ensureLoop();
    }

    function start() {
      initPrismRim();
      mountRippleIfNeeded();
      syncMascotStage();
      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerdown', onPointerDown, { passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);
      document.addEventListener('selectionchange', queueSmoothCaret);
      document.addEventListener('keyup', queueSmoothCaret, true);
      document.addEventListener('mouseup', queueSmoothCaret, true);
      document.addEventListener('input', queueSmoothCaret, true);
      window.addEventListener('blur', onWindowBlur);
      window.addEventListener('focus', onWindowFocus);
      ensureLoop();
    }

    function refresh() {
      if (destroyed) return;
      mountRippleIfNeeded();
      tagPrismBoxes();
      if (prismRimCtl) prismRimCtl.invalidateMetrics();
      syncMascotStage();
      if (horizonCtl) horizonCtl.invalidate();
      if (glyphField) glyphField.invalidate();
      ensureLoop();
    }

    function registerCrystalBar(trackEl, ctrl) {
      activeCrystalTrack = trackEl || null;
      activeCrystalCtrl = ctrl || null;
      if (prismRimCtl) prismRimCtl.markDirty();
    }

    function destroy() {
      destroyed = true;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (caretRaf) {
        cancelAnimationFrame(caretRaf);
        caretRaf = 0;
      }
      if (caretHiddenTimer) clearTimeout(caretHiddenTimer);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('selectionchange', queueSmoothCaret);
      document.removeEventListener('keyup', queueSmoothCaret, true);
      document.removeEventListener('mouseup', queueSmoothCaret, true);
      document.removeEventListener('input', queueSmoothCaret, true);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      teardownRipple();
      teardownMascot();
      if (prismRimCtl) {
        try {
          prismRimCtl.teardown();
        } catch {}
        prismRimCtl = null;
      }
      if (caretEl) {
        try {
          caretEl.remove();
        } catch {}
        caretEl = null;
      }
      document.querySelectorAll('[data-ag-cs-prism-box]').forEach((el) => {
        el.removeAttribute('data-ag-cs-prism-box');
        el.removeAttribute('data-ag-cs-prism-mirror');
      });
    }

    return {
      start,
      refresh,
      syncMascotStage,
      tagPrismBoxes,
      triggerSendLiftoff,
      registerCrystalBar,
      destroy,
      getDebugState: () => ({
        rippleMode: glyphField?.mode || 'none',
        horizonMode: horizonCtl?.mode || 'none',
        hasMascot: Boolean(mascotRig),
        hasPrismRim: Boolean(prismRimCtl),
        pointer: { x: pointerX, y: pointerY },
      }),
    };
  }

  const api = { createOpticsHost };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpOpticsHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
