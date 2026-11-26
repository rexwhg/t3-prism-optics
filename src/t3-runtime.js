(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const STYLE_ID = 't3-obsidian-prism-css';
  const VERSION = '1.0.0';

  function mountT3ObsidianPrism({ cssText = '', config = {}, telemetry: initialTelemetry = null, hash = '' } = {}) {
    // Idempotent hot-reload: tear down previous instance cleanly first
    if (G.__t3ObsidianPrism && typeof G.__t3ObsidianPrism.destroy === 'function') {
      try {
        G.__t3ObsidianPrism.destroy();
      } catch {}
    }

    if (initialTelemetry && typeof initialTelemetry === 'object') {
      G.__t3OpTelemetry = initialTelemetry;
    }

    const cfgMod = G.__t3OpConfig;
    const inkMod = G.__t3OpStreamInk;
    const opticsMod = G.__t3OpOpticsHost;
    const modelMod = G.__t3OpModelControls;
    const telemetryMod = G.__t3OpTelemetryStudio;
    const workbenchMod = G.__t3OpWorkbench;

    if (!cfgMod) throw new Error('t3-obsidian-prism: __t3OpConfig not loaded');

    // Inject stylesheet
    let styleEl = document.getElementById(STYLE_ID);
    if (cssText) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.setAttribute('data-t3op-owned', '1');
        (document.head || document.documentElement).appendChild(styleEl);
      }
      styleEl.textContent = cssText;
    }

    const configStore = cfgMod.createConfigStore(config);
    configStore.applyRootAttrs();

    const runtimeState = {
      streaming: false,
      hasError: false,
      waiting: false,
      orchestrator: false,
      camp: 'gemini',
    };

    function detectRuntimeStateFromDom() {
      const streamingEl = document.querySelector('.chat-markdown[data-streaming], [data-t3op-streaming="1"]');
      runtimeState.streaming = Boolean(streamingEl);
      const picker = document.querySelector('[data-chat-provider-model-picker="true"]');
      const txt = (picker?.getAttribute('aria-label') || picker?.textContent || '').toLowerCase();
      if (/claude|opus|sonnet|haiku/.test(txt)) runtimeState.camp = 'claude';
      else if (/gpt|codex|o3|o4/.test(txt)) runtimeState.camp = 'codex';
      else runtimeState.camp = 'gemini';
    }

    const streamInk = inkMod.createStreamInkController({
      isEnabled: () => Boolean(configStore.get().streamInk),
      isReducedMotion: () => configStore.get().motionLevel === 'off',
    });

    const opticsHost = opticsMod.createOpticsHost({
      configStore,
      getRuntimeState: () => {
        detectRuntimeStateFromDom();
        return runtimeState;
      },
    });

    let telemetry = null;
    let workbench = null;
    let modelControls = null;

    const onForceThemeToggle = () => {
      const html = document.documentElement;
      const isDark = configStore.detectDarkTheme();
      html.classList.toggle('dark', !isDark);
      html.classList.toggle('light', isDark);
      html.setAttribute('data-color-scheme', isDark ? 'light' : 'dark');
      configStore.applyRootAttrs();
      refreshAll();
    };

    workbench = workbenchMod.createWorkbenchAndSettings({
      configStore,
      onForceThemeToggle,
    });

    telemetry = telemetryMod.createTelemetryStudio({
      configStore,
      opticsHost,
      getRuntimeState: () => {
        detectRuntimeStateFromDom();
        return runtimeState;
      },
      onOpenSettings: () => workbench.openQuickDrawer(),
    });

    modelControls = modelMod.createModelControls({
      configStore,
      opticsHost,
      onOpenQuotas: () => {
        const trigger = document.querySelector('[data-testid="t3op-vial-trigger"]');
        telemetry.openVialPopover(trigger);
      },
      onEffortChange: (eff) => {
        runtimeState.orchestrator = Boolean(eff?.crystal);
        opticsHost.syncMascotStage();
      },
    });

    let refreshTimer = 0;
    let destroyed = false;

    function refreshAll() {
      if (destroyed) return;
      configStore.applyRootAttrs();
      detectRuntimeStateFromDom();
      streamInk.refresh();
      opticsHost.refresh();
      modelControls.refresh();
      telemetry.refresh();
      workbench.refresh();
    }

    function scheduleRefresh() {
      if (destroyed || refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = 0;
        refreshAll();
      }, 60);
    }

    const unsubCfg = configStore.subscribe(() => {
      refreshAll();
    });

    // Watch T3 SPA route transitions, popover openings, theme class switches, and streaming changes
    const domObserver = new MutationObserver((records) => {
      if (destroyed) return;
      for (const rec of records) {
        if (rec.target === document.documentElement && rec.type === 'attributes') {
          if (rec.attributeName === 'class' || rec.attributeName === 'data-color-scheme') {
            scheduleRefresh();
            return;
          }
          continue;
        }
        if (rec.target?.closest?.('[data-t3op-owned="1"], .ag-cs-prism-rim-cv')) continue;
        scheduleRefresh();
        return;
      }
    });

    const onFormSubmit = (ev) => {
      if (ev.target?.matches?.('[data-chat-composer-form="true"]')) {
        opticsHost.triggerSendLiftoff();
      }
    };

    streamInk.start();
    opticsHost.start();
    refreshAll();

    domObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-color-scheme'],
    });
    if (document.body) {
      domObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-streaming', 'data-active', 'aria-current', 'data-open'],
      });
    }
    document.addEventListener('submit', onFormSubmit, true);

    const instance = {
      version: VERSION,
      hash,
      getConfig: () => configStore.get(),
      reconfigure(patch, opts) {
        return configStore.update(patch, opts);
      },
      refresh: refreshAll,
      triggerSendLiftoff: () => opticsHost.triggerSendLiftoff(),
      openVial: () => telemetry.openVialPopover(document.querySelector('[data-testid="t3op-vial-trigger"]')),
      openStudioModal: () => telemetry.openStudioModal(),
      updateTelemetry: (nextData) => telemetry.setTelemetryData(nextData),
      openSettingsDrawer: () => workbench.openQuickDrawer(),
      setChatMode: (flag) => workbench.setChatMode(flag),
      setEffortIndex: (idx) => modelControls.setEffortIndex(idx, false),
      getDebugState: () => ({
        version: VERSION,
        hash,
        config: configStore.get(),
        optics: opticsHost.getDebugState(),
        effort: modelControls.getCurrentEffort(),
        streamInkActive: streamInk.getActiveCount(),
        isDark: configStore.detectDarkTheme(),
      }),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = 0;
        }
        unsubCfg();
        domObserver.disconnect();
        document.removeEventListener('submit', onFormSubmit, true);
        streamInk.destroy();
        opticsHost.destroy();
        modelControls.destroy();
        telemetry.destroy();
        workbench.destroy();
        configStore.clearRootAttrs();
        document.querySelectorAll('[data-t3op-owned="1"]').forEach((n) => n.remove());
        document.getElementById(STYLE_ID)?.remove();
        if (G.__t3ObsidianPrism === instance) {
          try {
            delete G.__t3ObsidianPrism;
          } catch {}
        }
      },
    };

    G.__t3ObsidianPrism = instance;
    return instance;
  }

  const api = { STYLE_ID, VERSION, mountT3ObsidianPrism };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
