(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  // Periodic-table element keycap badges matching Obsidian Prism visual language
  const ELEMENT_RULES = [
    { re: /neon/i, num: '10', sym: 'Ne', brand: 'gemini', bg: '#262030', border: 'rgba(167, 139, 250, 0.38)', fg: '#d9caff' },
    { re: /carbon/i, num: '6', sym: 'C', brand: 'gemini', bg: '#222630', border: 'rgba(125, 211, 252, 0.36)', fg: '#bae6fd' },
    { re: /argon/i, num: '18', sym: 'Ar', brand: 'gemini', bg: '#222933', border: 'rgba(96, 165, 250, 0.38)', fg: '#bfdbfe' },
    { re: /hydrogen/i, num: '1', sym: 'H', brand: 'gemini', bg: '#1e2b2f', border: 'rgba(52, 211, 153, 0.36)', fg: '#a7f3d0' },
    { re: /gemini.*pro|gemini-3|gemini-2\.5-pro/i, num: '31', sym: 'Ga', brand: 'gemini', bg: '#1f2536', border: 'rgba(102, 157, 246, 0.38)', fg: '#c7dfff' },
    { re: /gemini.*flash/i, num: '22', sym: 'Ti', brand: 'gemini', bg: '#1d2b34', border: 'rgba(56, 189, 248, 0.38)', fg: '#bae6fd' },
    { re: /claude.*opus/i, num: '79', sym: 'Au', brand: 'claude', bg: '#2c221d', border: 'rgba(245, 178, 128, 0.4)', fg: '#f6d2b6' },
    { re: /claude.*sonnet/i, num: '29', sym: 'Cu', brand: 'claude', bg: '#2b2021', border: 'rgba(232, 146, 118, 0.38)', fg: '#f5c7b8' },
    { re: /claude.*haiku/i, num: '3', sym: 'Li', brand: 'claude', bg: '#292226', border: 'rgba(244, 162, 140, 0.36)', fg: '#f8d4c9' },
    { re: /gpt-6\.2-sol|gpt-6\.1-sol|gpt-6-sol|gpt-5\.6-sol/i, num: '78', sym: 'Pt', brand: 'openai', bg: '#1c282b', border: 'rgba(94, 234, 212, 0.38)', fg: '#99f6e4' },
    { re: /astra|luna|terra/i, num: '47', sym: 'Ag', brand: 'openai', bg: '#1f2530', border: 'rgba(147, 197, 253, 0.36)', fg: '#dbeafe' },
    { re: /gpt-5|gpt-6|o3|o4|codex/i, num: '14', sym: 'Si', brand: 'openai', bg: '#1d2926', border: 'rgba(74, 222, 128, 0.36)', fg: '#bbf7d0' },
    { re: /gpt-4|openai/i, num: '7', sym: 'N', brand: 'openai', bg: '#1e2829', border: 'rgba(94, 234, 212, 0.34)', fg: '#ccfbf1' },
    { re: /deepseek/i, num: '27', sym: 'Co', brand: 'generic', bg: '#1e2436', border: 'rgba(99, 102, 241, 0.38)', fg: '#c7d2fe' },
  ];

  const FALLBACK_LEVELS = [
    { id: 'off', label: 'Off', zh: '关闭', chip: '', isOff: true, isAuto: false },
    { id: 'low', label: 'Low', zh: '低', chip: '低', isOff: false, isAuto: false },
    { id: 'medium', label: 'Medium', zh: '中', chip: '中', isOff: false, isAuto: false },
    { id: 'high', label: 'High', zh: '高', chip: '高', isOff: false, isAuto: false },
    { id: 'xhigh', label: 'Extra High', zh: '超高', chip: '超高', isOff: false, isAuto: false },
    { id: 'max', label: 'Max', zh: '最大', chip: '最大', isOff: false, isAuto: false },
    { id: 'auto', label: 'Auto', zh: '自动', chip: '自动', isOff: false, isAuto: true },
  ];

  function translateEffortShort(label) {
    const raw = String(label || '').trim();
    const lo = raw.toLowerCase();
    if (/^(off|none|disabled|关闭|无)$/.test(lo)) return { zh: '关闭', chip: '', isOff: true, isAuto: false };
    if (/^(minimal|极低|最低)$/.test(lo)) return { zh: '极低', chip: '极低', isOff: false, isAuto: false };
    if (/^(low|低)$/.test(lo)) return { zh: '低', chip: '低', isOff: false, isAuto: false };
    if (/^(medium|med|中|中等)$/.test(lo)) return { zh: '中', chip: '中', isOff: false, isAuto: false };
    if (/^(high|高)$/.test(lo)) return { zh: '高', chip: '高', isOff: false, isAuto: false };
    if (/^(extra\s*high|xhigh|extra|超高|极高)$/.test(lo)) return { zh: '超高', chip: '超高', isOff: false, isAuto: false };
    if (/^(max|最大|最高)$/.test(lo)) return { zh: '最大', chip: '最大', isOff: false, isAuto: false };
    if (/^(ultra|ultrathink|极致|究极)$/.test(lo)) return { zh: '极致', chip: '极致', isOff: false, isAuto: false };
    if (/^(auto|adaptive|orchestrator|自动|自适应)$/.test(lo)) return { zh: '自动', chip: '自动', isOff: false, isAuto: true };
    return { zh: raw, chip: raw.slice(0, 4), isOff: false, isAuto: false };
  }

  function resolvePeriodicBadge(modelText) {
    const raw = String(modelText || '').trim();
    if (!raw) return null;
    for (const rule of ELEMENT_RULES) {
      if (rule.re.test(raw)) return rule;
    }
    const initials = raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'Ai';
    return {
      num: '42',
      sym: initials[0].toUpperCase() + (initials[1] ? initials[1].toLowerCase() : ''),
      brand: 'generic',
      bg: '#24252e',
      border: 'rgba(148, 163, 184, 0.34)',
      fg: '#e2e8f0',
    };
  }

  function brandSvg(brand) {
    if (brand === 'claude') {
      return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e08d68" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9"/></svg>';
    }
    if (brand === 'openai') {
      return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M5.1 8l13.8 8M18.9 8L5.1 16"/></svg>';
    }
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="url(#t3opSparkG)"><defs><linearGradient id="t3opSparkG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#669df6"/><stop offset="100%" stop-color="#b68cff"/></linearGradient></defs><path d="M12 2c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10Z"/></svg>';
  }

  // Deterministic 28-starfield definitions for continuous right-to-left warp stream
  const STAR_META = Array.from({ length: 28 }, (_, i) => {
    const h = (salt) => {
      const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      yPct: 16 + h(11) * 68,
      brightness: 0.55 + 0.45 * h(61),
      size: h(37) > 0.72 ? 3 : 2,
      speedScale: 0.72 + 0.56 * h(29),
      phase: h(53),
    };
  });

  function readNativeEffortRows(popup) {
    if (!popup) return [];
    const col = popup.querySelector('[data-model-picker-effort]');
    if (!col) return [];
    // Real T3 Code rows use [data-effort-row][data-effort-level] with role="radio" aria-checked="true"|"false"
    let rows = Array.from(col.querySelectorAll('[data-effort-row]'));
    if (rows.length === 0) {
      // Demo fallback [data-effort-option]
      rows = Array.from(col.querySelectorAll('[data-effort-option]'));
    }
    return rows.map((el, idx) => {
      const label = (
        el.getAttribute('data-effort-level') ||
        el.getAttribute('data-effort-option') ||
        el.querySelector('span')?.textContent ||
        el.textContent ||
        ''
      ).trim();
      const meta = translateEffortShort(label);
      const selected =
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('data-checked') === '' ||
        el.getAttribute('data-state') === 'checked';
      return {
        idx,
        el,
        id: label.toLowerCase().replace(/\s+/g, '-'),
        label,
        zh: meta.zh,
        chip: meta.chip,
        isOff: meta.isOff,
        isAuto: meta.isAuto,
        selected,
        disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      };
    });
  }

  function createModelControls({ configStore, opticsHost, onOpenQuotas, onEffortChange }) {
    let destroyed = false;
    let levels = FALLBACK_LEVELS.map((x, idx) => ({ ...x, idx, el: null, selected: idx === 4, disabled: false }));
    let currentEffortIdx = 4;
    let sliderRaf = 0;
    let mountedBox = null;
    let mountedPopup = null;
    let effortObs = null;
    let crystalCtrl = null;
    let crystalCanvas = null;
    let trackShell = null;
    let valueEl = null;
    let labelsWrap = null;
    let ticksWrap = null;
    let starNodes = [];
    let lastCrystalStepMs = 0;
    let lastLevelsSig = '';
    const sliderState = { currentPct: 0.66, targetPct: 0.66 };

    function getCurrentEffort() {
      return levels[currentEffortIdx] || levels[0] || FALLBACK_LEVELS[2];
    }

    function computeEnergy(pct) {
      const hasOff = Boolean(levels[0]?.isOff);
      const start = hasOff && levels.length > 1 ? 1 / (levels.length - 1) : 0;
      if (pct <= start + 0.001) return 0;
      return Math.max(0, Math.min(1, (pct - start) / Math.max(0.01, 1 - start)));
    }

    function enhanceModelPickerTrigger() {
      const cfg = configStore.get();
      const triggers = document.querySelectorAll('[data-chat-provider-model-picker="true"]');
      triggers.forEach((btn) => {
        if (!cfg.periodicBadges) {
          btn.querySelectorAll('.t3op-keycap-badge, .t3op-effort-chip, .t3op-brand-glyph').forEach((n) => n.remove());
          return;
        }
        const text = (btn.getAttribute('aria-label') || btn.textContent || '').trim();
        const badgeSpec = resolvePeriodicBadge(text);
        if (!badgeSpec) return;

        let badge = btn.querySelector('.t3op-keycap-badge');
        const sig = `${badgeSpec.num}:${badgeSpec.sym}`;
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 't3op-keycap-badge';
          badge.setAttribute('data-t3op-owned', '1');
          const inner = btn.firstElementChild || btn;
          inner.insertBefore(badge, inner.firstChild);
        }
        if (badge.getAttribute('data-t3op-sig') !== sig) {
          badge.setAttribute('data-t3op-sig', sig);
          badge.style.setProperty('--t3op-keycap-bg', badgeSpec.bg);
          badge.style.setProperty('--t3op-keycap-border', badgeSpec.border);
          badge.style.setProperty('--t3op-keycap-fg', badgeSpec.fg);
          badge.innerHTML = `<span class="t3op-keycap-num">${badgeSpec.num}</span><span>${badgeSpec.sym}</span>`;
        }
      });

      // Enhance demo/custom model options
      if (cfg.periodicBadges) {
        document.querySelectorAll('[data-t3op-model-option]').forEach((item) => {
          if (item.querySelector('.t3op-keycap-badge')) return;
          const label = item.getAttribute('data-model-label') || item.textContent || '';
          const spec = resolvePeriodicBadge(label);
          if (!spec) return;
          const wrap = document.createElement('span');
          wrap.className = 't3op-brand-glyph';
          wrap.setAttribute('data-t3op-owned', '1');
          wrap.innerHTML = brandSvg(spec.brand);

          const badge = document.createElement('span');
          badge.className = 't3op-keycap-badge';
          badge.setAttribute('data-t3op-owned', '1');
          badge.style.setProperty('--t3op-keycap-bg', spec.bg);
          badge.style.setProperty('--t3op-keycap-border', spec.border);
          badge.style.setProperty('--t3op-keycap-fg', spec.fg);
          badge.innerHTML = `<span class="t3op-keycap-num">${spec.num}</span><span>${spec.sym}</span>`;

          item.insertBefore(badge, item.firstChild);
          item.insertBefore(wrap, badge);
        });
      }
    }

    function teardownEffortSlider() {
      if (sliderRaf) {
        cancelAnimationFrame(sliderRaf);
        sliderRaf = 0;
      }
      if (effortObs) {
        try {
          effortObs.disconnect();
        } catch {}
        effortObs = null;
      }
      if (crystalCtrl) {
        try {
          crystalCtrl.dispose();
        } catch {}
        crystalCtrl = null;
      }
      if (opticsHost) opticsHost.registerCrystalBar(null, null);
      if (mountedBox) {
        try {
          mountedBox.remove();
        } catch {}
        mountedBox = null;
      }
      mountedPopup = null;
      crystalCanvas = null;
      trackShell = null;
      valueEl = null;
      labelsWrap = null;
      ticksWrap = null;
      starNodes = [];
      lastLevelsSig = '';
    }

    function rebuildLevelsFromNative(popup) {
      const nativeRows = readNativeEffortRows(popup);
      if (nativeRows.length > 0) {
        levels = nativeRows;
        const checkedIdx = nativeRows.findIndex((r) => r.selected);
        if (checkedIdx >= 0) {
          currentEffortIdx = checkedIdx;
        } else {
          currentEffortIdx = Math.min(currentEffortIdx, nativeRows.length - 1);
        }
      } else {
        levels = FALLBACK_LEVELS.map((x, idx) => ({ ...x, idx, el: null, selected: idx === currentEffortIdx, disabled: false }));
      }
      const denom = Math.max(1, levels.length - 1);
      sliderState.targetPct = currentEffortIdx / denom;
      if (Math.abs(sliderState.currentPct - sliderState.targetPct) > 0.95) {
        sliderState.currentPct = sliderState.targetPct;
      }
    }

    function renderTicksAndLabels() {
      if (!mountedBox || !labelsWrap || !ticksWrap) return;
      const sig = levels.map((l) => `${l.label}:${l.disabled ? 1 : 0}`).join('|');
      if (sig === lastLevelsSig) return;
      lastLevelsSig = sig;

      const n = levels.length;
      const denom = Math.max(1, n - 1);

      ticksWrap.innerHTML = levels
        .map((_, i) => {
          const p = i / denom;
          return `<span class="t3op-ces-tick" data-idx="${i}" style="left:calc(14px + (100% - 28px) * ${p.toFixed(4)})"></span>`;
        })
        .join('');

      labelsWrap.innerHTML = levels
        .map(
          (l, i) =>
            `<button type="button" class="t3op-effort-stop-btn" data-idx="${i}" ${l.disabled ? 'disabled' : ''}>${l.zh === l.label ? l.label : l.zh}</button>`
        )
        .join('');

      labelsWrap.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          setEffortIndex(Number(b.getAttribute('data-idx')), true);
        });
      });

      if (trackShell) {
        trackShell.setAttribute('aria-valuemax', String(Math.max(0, n - 1)));
      }
    }

    function updateVisualState(bloom = false) {
      if (!mountedBox) return;
      renderTicksAndLabels();
      const eff = getCurrentEffort();
      const isCrystal = Boolean(eff.isAuto);
      const cosmicShell = mountedBox.querySelector('.t3op-effort-track-shell');
      const crystalShell = mountedBox.querySelector('.t3op-crystal-shell');
      const n = Math.max(1, levels.length);
      const denom = Math.max(1, n - 1);
      const pct = currentEffortIdx / denom;
      const energy = isCrystal ? 1 : computeEnergy(pct);
      const motOff = configStore.get().motionLevel === 'off';

      if (valueEl) {
        const text = eff.zh && eff.zh !== eff.label ? `${eff.label} · ${eff.zh}` : eff.label;
        if (valueEl.textContent !== text) valueEl.textContent = text;
        valueEl.style.color = isCrystal
          ? 'var(--t3op-fg)'
          : energy > 0.65
          ? '#c084fc'
          : energy > 0.25
          ? '#8b9bff'
          : '#60a5fa';
        if (bloom && !motOff) {
          valueEl.classList.remove('is-bloom');
          void valueEl.offsetWidth;
          valueEl.classList.add('is-bloom');
        }
      }

      if (cosmicShell) {
        cosmicShell.style.display = isCrystal ? 'none' : '';
        cosmicShell.setAttribute('aria-valuenow', String(currentEffortIdx));
        cosmicShell.setAttribute('aria-valuetext', eff.label);
        cosmicShell.setAttribute('data-energy', !motOff && energy > 0.02 ? '1' : '0');
        cosmicShell.style.setProperty('--t3op-energy', energy.toFixed(3));
        // Speed up energy sweep & drifting stars as reasoning intensity increases!
        const sweepDur = (2.85 - energy * 1.55).toFixed(2);
        cosmicShell.style.setProperty('--t3op-sweep-dur', `${sweepDur}s`);
        const starOpacity = motOff ? 0 : Math.min(1, 0.28 + energy * 0.72);
        cosmicShell.style.setProperty('--t3op-star-opacity', starOpacity.toFixed(3));

        const visibleStars = motOff ? 0 : Math.max(8, Math.round((0.35 + energy * 0.65) * starNodes.length));
        const baseDur = 3.2 - energy * 1.95; // 3.2s gentle drift -> 1.25s warp flow at Max/Ultra
        for (let i = 0; i < starNodes.length; i += 1) {
          const sn = starNodes[i];
          if (i < visibleStars) {
            sn.el.style.display = '';
            const dur = Math.max(0.75, baseDur / sn.meta.speedScale);
            sn.el.style.animationDuration = `${dur.toFixed(2)}s`;
            if (!sn.el.dataset.seeded) {
              sn.el.style.animationDelay = `${(-sn.meta.phase * dur).toFixed(2)}s`;
              sn.el.dataset.seeded = '1';
            }
          } else {
            sn.el.style.display = 'none';
          }
        }
      }

      if (crystalShell) crystalShell.style.display = isCrystal ? '' : 'none';

      // Highlight reached ticks & active stop label
      if (ticksWrap) {
        ticksWrap.querySelectorAll('.t3op-ces-tick').forEach((t, i) => {
          t.classList.toggle('is-on', i <= currentEffortIdx);
        });
      }
      if (labelsWrap) {
        labelsWrap.querySelectorAll('.t3op-effort-stop-btn').forEach((b, i) => {
          b.setAttribute('aria-pressed', i === currentEffortIdx ? 'true' : 'false');
        });
      }

      if (isCrystal && crystalCanvas && !crystalCtrl && G.__agCrystalPrismCore) {
        crystalCtrl = G.__agCrystalPrismCore.mountCrystalPrismBar(crystalCanvas, {
          reduceMotion: motOff,
          getState: () => ({
            isDark: configStore.detectDarkTheme(),
            prismStrength: configStore.get().accentTone === 'mono' ? 0.2 : 1,
            accentTone: configStore.get().accentTone,
            ambientIntensity: Number(configStore.get().ambientIntensity || 100) / 100,
          }),
        });
        if (crystalCtrl?.wake) crystalCtrl.wake();
        if (opticsHost) opticsHost.registerCrystalBar(crystalShell, crystalCtrl);
      } else if (!isCrystal && opticsHost) {
        opticsHost.registerCrystalBar(null, null);
      }

      enhanceModelPickerTrigger();
    }

    function setEffortIndex(idx, triggerNative = false) {
      const clamped = Math.max(0, Math.min(levels.length - 1, Math.round(idx)));
      const targetLevel = levels[clamped];
      if (!targetLevel || targetLevel.disabled) return;
      const changed = clamped !== currentEffortIdx;
      currentEffortIdx = clamped;
      sliderState.targetPct = clamped / Math.max(1, levels.length - 1);
      updateVisualState(changed);

      if (changed || triggerNative) {
        if (typeof onEffortChange === 'function') onEffortChange(targetLevel);
        // Directly click the real T3 Code radio button so backend selection stays 100% synced!
        if (triggerNative && targetLevel.el && targetLevel.el.isConnected) {
          const alreadyChecked = targetLevel.el.getAttribute('aria-checked') === 'true';
          if (!alreadyChecked) {
            try {
              targetLevel.el.click();
            } catch {}
          }
        }
      }
    }

    function tickSlider(now) {
      sliderRaf = 0;
      if (destroyed || !mountedBox || !mountedBox.isConnected) {
        teardownEffortSlider();
        return;
      }
      const dt = lastCrystalStepMs > 0 ? Math.min(0.05, Math.max(0.008, (now - lastCrystalStepMs) / 1000)) : 0.016;
      lastCrystalStepMs = now;

      // Fast ~70ms damped spring convergence
      const diff = sliderState.targetPct - sliderState.currentPct;
      if (Math.abs(diff) > 0.001) {
        sliderState.currentPct += diff * Math.min(1, dt * 20);
      } else {
        sliderState.currentPct = sliderState.targetPct;
      }

      if (trackShell) {
        const p = Math.max(0, Math.min(1, sliderState.currentPct));
        trackShell.style.setProperty('--t3op-fill-pos', `calc(14px + (100% - 28px) * ${p.toFixed(4)})`);
      }

      const eff = getCurrentEffort();
      if (eff.isAuto && crystalCtrl) {
        try {
          crystalCtrl.step(dt);
        } catch {}
      }

      const stillMoving = Math.abs(sliderState.targetPct - sliderState.currentPct) > 0.001;
      if (!document.hidden && (stillMoving || (eff.isAuto && configStore.get().motionLevel !== 'off'))) {
        sliderRaf = requestAnimationFrame(tickSlider);
      }
    }

    function ensureTick() {
      if (!destroyed && mountedBox && !sliderRaf && typeof requestAnimationFrame === 'function') {
        sliderRaf = requestAnimationFrame(tickSlider);
      }
    }

    function findMountHostInsidePopup(popup) {
      // In real T3 Code, PopoverPopup contains a vertical `.flex-col` wrapper whose children are:
      // [0] the 2-column picker + [data-model-picker-effort] row, [1] optional bottom Standard/Fast footer.
      // Inserting right inside that `.flex-col` places our cosmic slider cleanly full-width at the bottom
      // instead of jutting out as a narrow 3rd column on the right!
      const effortCol = popup.querySelector('[data-model-picker-effort]');
      if (effortCol) {
        const rowParent = effortCol.parentElement;
        const colParent = rowParent?.parentElement;
        if (colParent && popup.contains(colParent) && colParent !== popup) {
          return { parent: colParent, before: rowParent.nextSibling };
        }
      }
      return { parent: popup, before: null };
    }

    function mountEffortSliderOnPopups() {
      const cfg = configStore.get();
      if (!cfg.effortSlider) {
        teardownEffortSlider();
        return;
      }

      const targetPopup = document.querySelector(
        '[data-slot="popover-popup"][data-t3op-model-picker-popup="1"][data-open="true"], [data-slot="popover-popup"]:has([data-model-picker-effort])'
      );
      if (!targetPopup) {
        if (mountedBox && !mountedBox.isConnected) teardownEffortSlider();
        return;
      }
      if (mountedBox && mountedBox.isConnected && mountedPopup === targetPopup) {
        // Re-sync in case model changed while popup stayed open
        rebuildLevelsFromNative(targetPopup);
        updateVisualState(false);
        ensureTick();
        return;
      }

      teardownEffortSlider();
      mountedPopup = targetPopup;
      rebuildLevelsFromNative(targetPopup);

      const box = document.createElement('div');
      box.className = 't3op-effort-box';
      box.setAttribute('data-t3op-owned', '1');
      box.setAttribute('data-testid', 't3op-cosmic-effort-slider');
      box.innerHTML = `
        <div class="t3op-effort-head">
          <span class="t3op-effort-title">推理等级 · Reasoning Effort</span>
          <span class="t3op-effort-value"></span>
        </div>
        <div class="t3op-effort-track-shell" role="slider" tabindex="0" aria-label="推理等级" aria-valuemin="0" aria-valuemax="${Math.max(0, levels.length - 1)}">
          <div class="t3op-ces-fill"></div>
          <div class="t3op-ces-energy"><div class="t3op-ces-sweep"></div></div>
          <div class="t3op-ces-stars"></div>
          <div class="t3op-ces-ticks"></div>
          <div class="t3op-effort-thumb"></div>
        </div>
        <div class="t3op-crystal-shell" style="display:none" title="WebGL2 Cut-Crystal Auto Orchestrator (点击切回手动档位)">
          <canvas class="t3op-crystal-canvas"></canvas>
        </div>
        <div class="t3op-effort-labels"></div>
        <button type="button" class="t3op-quota-link-row" data-t3op-open-quotas="1">
          <span>查看使用额度与 5h/周 配额池</span>
          <span>›</span>
        </button>
      `;

      const { parent, before } = findMountHostInsidePopup(targetPopup);
      if (before) parent.insertBefore(box, before);
      else parent.appendChild(box);

      mountedBox = box;
      trackShell = box.querySelector('.t3op-effort-track-shell');
      crystalCanvas = box.querySelector('.t3op-crystal-canvas');
      valueEl = box.querySelector('.t3op-effort-value');
      labelsWrap = box.querySelector('.t3op-effort-labels');
      ticksWrap = box.querySelector('.t3op-ces-ticks');

      // Build GPU-accelerated drifting cosmic stardust nodes
      const starsWrap = box.querySelector('.t3op-ces-stars');
      starNodes = STAR_META.map((meta) => {
        const el = document.createElement('span');
        el.className = 't3op-ces-star';
        el.style.top = `${meta.yPct.toFixed(1)}%`;
        const dot = document.createElement('span');
        dot.className = 't3op-ces-star-dot';
        dot.style.width = `${meta.size}px`;
        dot.style.height = `${meta.size}px`;
        dot.style.opacity = meta.brightness.toFixed(2);
        el.appendChild(dot);
        starsWrap.appendChild(el);
        return { el, dot, meta };
      });

      const crystalShell = box.querySelector('.t3op-crystal-shell');

      const pickFromClientX = (clientX) => {
        const rect = trackShell.getBoundingClientRect();
        if (rect.width <= 0 || levels.length <= 1) return;
        const pct = Math.max(0, Math.min(1, (clientX - rect.left - 14) / Math.max(1, rect.width - 28)));
        const idx = Math.round(pct * (levels.length - 1));
        setEffortIndex(idx, true);
        ensureTick();
      };

      let dragging = false;
      trackShell.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        dragging = true;
        trackShell.setAttribute('data-dragging', '1');
        try {
          trackShell.setPointerCapture(ev.pointerId);
        } catch {}
        pickFromClientX(ev.clientX);
      });
      trackShell.addEventListener('pointermove', (ev) => {
        if (!dragging) return;
        pickFromClientX(ev.clientX);
      });
      const stopDrag = () => {
        dragging = false;
        trackShell.removeAttribute('data-dragging');
      };
      trackShell.addEventListener('pointerup', stopDrag);
      trackShell.addEventListener('pointercancel', stopDrag);
      trackShell.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          setEffortIndex(currentEffortIdx + 1, true);
          ensureTick();
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          setEffortIndex(currentEffortIdx - 1, true);
          ensureTick();
        }
      });

      crystalShell.addEventListener('pointermove', (ev) => {
        if (crystalCtrl?.setPointerClient) crystalCtrl.setPointerClient(ev.clientX, ev.clientY);
      });
      crystalShell.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const nonAutoIdx = Math.max(0, levels.findIndex((l) => !l.isAuto && !l.isOff));
        setEffortIndex(nonAutoIdx, true);
        ensureTick();
      });

      box.querySelector('[data-t3op-open-quotas="1"]')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (typeof onOpenQuotas === 'function') onOpenQuotas();
      });

      // Observe native T3 effort column for immediate 2-way sync!
      const nativeCol = targetPopup.querySelector('[data-model-picker-effort]');
      if (nativeCol && typeof MutationObserver === 'function') {
        effortObs = new MutationObserver(() => {
          if (destroyed || !mountedBox || !mountedPopup) return;
          const prevIdx = currentEffortIdx;
          const prevLen = levels.length;
          rebuildLevelsFromNative(mountedPopup);
          if (currentEffortIdx !== prevIdx || levels.length !== prevLen) {
            updateVisualState(true);
            ensureTick();
          }
        });
        effortObs.observe(nativeCol, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['aria-checked', 'disabled', 'data-effort-level'],
        });
      }

      sliderState.currentPct = sliderState.targetPct;
      updateVisualState(false);
      lastCrystalStepMs = 0;
      ensureTick();
    }

    function refresh() {
      if (destroyed) return;
      enhanceModelPickerTrigger();
      mountEffortSliderOnPopups();
    }

    function destroy() {
      destroyed = true;
      teardownEffortSlider();
      document.querySelectorAll('.t3op-keycap-badge, .t3op-effort-chip, .t3op-brand-glyph').forEach((n) => n.remove());
    }

    return {
      refresh,
      setEffortIndex,
      getCurrentEffort,
      destroy,
    };
  }

  const api = { ELEMENT_RULES, FALLBACK_LEVELS, translateEffortShort, resolvePeriodicBadge, createModelControls };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpModelControls = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
