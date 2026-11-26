(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const CHAT_MODE_KEY = 't3.obsidianPrism.workspaceMode.v1';

  function createWorkbenchAndSettings({ configStore, onForceThemeToggle }) {
    let destroyed = false;
    let outlineFab = null;
    let outlinePopover = null;
    let modeSwitchEl = null;
    let chatNewBtnEl = null;
    let chatModePillEl = null;
    let chatModeOnly = false;
    try {
      chatModeOnly = typeof localStorage !== 'undefined' && localStorage.getItem(CHAT_MODE_KEY) === 'chat';
    } catch {}
    let settingsPanelInline = null;
    let quickTriggerBtn = null;
    let quickDrawerEl = null;

    // ── 1. Long Codeblock & Long Assistant Message Fold ───────────────────────
    function syncFolds() {
      const cfg = configStore.get();
      document.querySelectorAll('.chat-markdown-codeblock').forEach((block) => {
        const header = block.querySelector('.chat-markdown-codeblock-header');
        if (!header) return;
        let btn = header.querySelector('.t3op-code-fold-btn');
        if (!cfg.codeFold) {
          if (btn) btn.remove();
          block.removeAttribute('data-t3op-folded');
          return;
        }
        const pre = block.querySelector('pre');
        const lines = pre ? (pre.textContent || '').split('\n').length : 0;
        if (lines < 8 && !btn) return;
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 't3op-code-fold-btn';
          btn.setAttribute('data-t3op-owned', '1');
          btn.textContent = '折叠代码';
          btn.addEventListener('click', () => {
            const folded = block.getAttribute('data-t3op-folded') === 'true';
            block.setAttribute('data-t3op-folded', folded ? 'false' : 'true');
            btn.textContent = folded ? '折叠代码' : `展开代码 (${lines}行)`;
          });
          header.appendChild(btn);
        }
      });

      document.querySelectorAll('[data-message-role="assistant"] .chat-markdown').forEach((md) => {
        const parent = md.parentElement;
        if (!parent) return;
        let btn = parent.querySelector(':scope > .t3op-msg-fold-btn');
        if (!cfg.codeFold) {
          if (btn) btn.remove();
          md.removeAttribute('data-t3op-msg-folded');
          return;
        }
        const chars = (md.textContent || '').length;
        if (chars < 520 && !btn) return;
        if (!btn) {
          btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 't3op-msg-fold-btn';
          btn.setAttribute('data-t3op-owned', '1');
          btn.style.marginTop = '8px';
          btn.textContent = '收起长回复';
          btn.addEventListener('click', () => {
            const folded = md.getAttribute('data-t3op-msg-folded') === 'true';
            md.setAttribute('data-t3op-msg-folded', folded ? 'false' : 'true');
            btn.textContent = folded ? '收起长回复' : '展开全部回复';
          });
          parent.appendChild(btn);
        }
      });
    }

    // ── 2. Floating Searchable Conversation Outline Rail ──────────────────────
    function closeOutlinePopover() {
      if (outlinePopover) {
        outlinePopover.remove();
        outlinePopover = null;
      }
    }

    function getVisibleUserTurns() {
      return Array.from(document.querySelectorAll('[data-message-role="user"]')).filter(
        (el) => el.offsetParent !== null && !el.closest('.hidden')
      );
    }

    function openOutlinePopover() {
      if (outlinePopover && outlinePopover.isConnected) {
        closeOutlinePopover();
        return;
      }
      const turns = getVisibleUserTurns();
      const pop = document.createElement('div');
      pop.className = 't3op-outline-popover';
      pop.setAttribute('data-t3op-owned', '1');
      pop.setAttribute('data-testid', 't3op-outline-popover');
      pop.innerHTML = `
        <input class="t3op-outline-search" type="search" placeholder="筛选提问大纲 (${turns.length} 轮)..." aria-label="筛选提问大纲" />
        <div class="t3op-outline-list"></div>
      `;

      const listEl = pop.querySelector('.t3op-outline-list');
      const inputEl = pop.querySelector('.t3op-outline-search');

      const renderItems = (q) => {
        const query = String(q || '').trim().toLowerCase();
        listEl.innerHTML = '';
        let shown = 0;
        turns.forEach((el, idx) => {
          const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (query && !txt.toLowerCase().includes(query)) return;
          shown += 1;
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 't3op-outline-item';
          item.innerHTML = `<span style="opacity:0.55;font-family:ui-monospace,monospace">#${idx + 1}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(txt.slice(0, 72) || '(空消息)')}</span>`;
          item.addEventListener('click', () => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            closeOutlinePopover();
          });
          listEl.appendChild(item);
        });
        if (shown === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:14px;text-align:center;font-size:12px;color:var(--t3op-fg-muted)';
          empty.textContent = '没有匹配的对话轮次';
          listEl.appendChild(empty);
        }
      };

      inputEl.addEventListener('input', () => renderItems(inputEl.value));
      renderItems('');
      document.body.appendChild(pop);
      outlinePopover = pop;
      inputEl.focus();
    }

    function syncOutlineRail() {
      const cfg = configStore.get();
      const turns = getVisibleUserTurns();
      if (!cfg.outlineRail || turns.length === 0) {
        if (outlineFab) {
          outlineFab.remove();
          outlineFab = null;
        }
        closeOutlinePopover();
        return;
      }
      if (!outlineFab || !outlineFab.isConnected) {
        outlineFab = document.createElement('button');
        outlineFab.type = 'button';
        outlineFab.className = 't3op-outline-fab';
        outlineFab.setAttribute('data-t3op-owned', '1');
        outlineFab.setAttribute('data-testid', 't3op-outline-fab');
        outlineFab.addEventListener('click', openOutlinePopover);
        document.body.appendChild(outlineFab);
      }
      outlineFab.textContent = `大纲 · ${turns.length}`;
    }

    // ── 3. Real Functional Sidebar Code | Chat Workspace Mode Switch ──────────
    function setChatMode(nextChatMode) {
      chatModeOnly = Boolean(nextChatMode);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CHAT_MODE_KEY, chatModeOnly ? 'chat' : 'code');
        }
      } catch {}
      applyChatModeWorkspace();
    }

    function applyChatModeWorkspace() {
      document.documentElement.setAttribute('data-t3-op-chat-mode', chatModeOnly ? 'chat' : 'code');

      // Update switch button pressed states
      if (modeSwitchEl) {
        modeSwitchEl.querySelectorAll('.t3op-mode-btn').forEach((b) => {
          b.setAttribute('aria-pressed', (b.getAttribute('data-mode') === 'chat') === chatModeOnly ? 'true' : 'false');
        });
      }

      // Show/hide Chat-mode "New Pure Chat" button in sidebar
      if (chatNewBtnEl) {
        chatNewBtnEl.style.display = chatModeOnly ? 'flex' : 'none';
      }

      // When entering Chat mode, actually close open terminal drawer or right code/diff panel in T3 Code!
      if (chatModeOnly) {
        const hdr = document.querySelector('[data-chat-header]');
        if (hdr) {
          hdr
            .querySelectorAll(
              'button[aria-label*="终端"], button[aria-label*="Terminal"], button[aria-label*="右侧面板"], button[aria-label*="Right panel"]'
            )
            .forEach((btn) => {
              if (btn.getAttribute('aria-pressed') === 'true' || btn.getAttribute('data-pressed') === '') {
                try {
                  btn.click();
                } catch {}
              }
            });
        }
      }

      // Sync Chat-mode status pill inside [data-chat-header] so user always sees active mode & can toggle back
      const hdr = document.querySelector('[data-chat-header]');
      if (hdr) {
        if (chatModeOnly) {
          if (!chatModePillEl || !chatModePillEl.isConnected || !hdr.contains(chatModePillEl)) {
            if (chatModePillEl) chatModePillEl.remove();
            chatModePillEl = document.createElement('button');
            chatModePillEl.type = 'button';
            chatModePillEl.className = 't3op-chatmode-pill';
            chatModePillEl.setAttribute('data-t3op-owned', '1');
            chatModePillEl.title = '当前为纯净对话模式（已隐藏终端、Diff 与工程目录），点击切回代码工作区';
            chatModePillEl.innerHTML = '<span>✦ 纯净对话模式</span><span style="opacity:0.65">· 切回代码</span>';
            chatModePillEl.addEventListener('click', () => setChatMode(false));
            hdr.appendChild(chatModePillEl);
          }
        } else if (chatModePillEl) {
          chatModePillEl.remove();
          chatModePillEl = null;
        }
      }
    }

    function syncSidebarModeSwitch() {
      const cfg = configStore.get();
      const sidebar = document.querySelector('[data-slot="sidebar-inner"]');
      if (!cfg.sidebarChatMode || !sidebar) {
        if (modeSwitchEl) {
          modeSwitchEl.remove();
          modeSwitchEl = null;
        }
        if (chatNewBtnEl) {
          chatNewBtnEl.remove();
          chatNewBtnEl = null;
        }
        if (chatModePillEl) {
          chatModePillEl.remove();
          chatModePillEl = null;
        }
        document.documentElement.removeAttribute('data-t3-op-chat-mode');
        return;
      }

      // Mount inside the top vertical flex container (above the scroll area), NOT at the bottom above macOS Dock!
      const innerCol = sidebar.querySelector(':scope > div.flex-col') || sidebar;
      const scrollViewport = innerCol.querySelector('[data-slot="scroll-area-viewport"]')?.parentElement || innerCol.querySelector('[data-slot="sidebar-content"]');

      if (!modeSwitchEl || !modeSwitchEl.isConnected || !innerCol.contains(modeSwitchEl)) {
        if (modeSwitchEl) modeSwitchEl.remove();
        modeSwitchEl = document.createElement('div');
        modeSwitchEl.className = 't3op-mode-switch';
        modeSwitchEl.setAttribute('data-t3op-owned', '1');
        modeSwitchEl.setAttribute('data-testid', 't3op-sidebar-mode-switch');
        modeSwitchEl.innerHTML = `
          <button type="button" class="t3op-mode-btn" data-mode="code" aria-pressed="${!chatModeOnly}" title="完整编码工作区（项目目录、终端、Diff 面板）">代码 Code</button>
          <button type="button" class="t3op-mode-btn" data-mode="chat" aria-pressed="${chatModeOnly}" title="纯净对话工作区（扁平会话流、隐藏工程控件、居中阅读）">对话 Chat</button>
        `;
        modeSwitchEl.querySelectorAll('.t3op-mode-btn').forEach((btn) => {
          btn.addEventListener('click', () => setChatMode(btn.getAttribute('data-mode') === 'chat'));
        });

        if (chatNewBtnEl) chatNewBtnEl.remove();
        chatNewBtnEl = document.createElement('button');
        chatNewBtnEl.type = 'button';
        chatNewBtnEl.className = 't3op-chat-new-btn';
        chatNewBtnEl.setAttribute('data-t3op-owned', '1');
        chatNewBtnEl.innerHTML = '<span>✦ 新建纯净对话</span><span style="opacity:0.6;font-size:11px">⌘N</span>';
        chatNewBtnEl.addEventListener('click', () => {
          const nativeNew = document.querySelector('button[aria-label="新建会话"], button[aria-label="New thread"], button[aria-label="New chat"]');
          if (nativeNew) {
            try {
              nativeNew.click();
            } catch {}
          }
        });

        if (scrollViewport && scrollViewport.parentElement === innerCol) {
          innerCol.insertBefore(modeSwitchEl, scrollViewport);
          innerCol.insertBefore(chatNewBtnEl, scrollViewport);
        } else {
          const anchor = innerCol.firstElementChild?.nextSibling || null;
          innerCol.insertBefore(modeSwitchEl, anchor);
          innerCol.insertBefore(chatNewBtnEl, anchor);
        }
      }
      applyChatModeWorkspace();
    }

    // ── 4. Obsidian Prism Appearance Control Center ───────────────────────────
    function buildSettingsPanelDom(titleSuffix = '') {
      const cfg = configStore.get();
      const isDark = configStore.detectDarkTheme();
      const panel = document.createElement('section');
      panel.className = 't3op-settings-panel';
      panel.setAttribute('data-t3op-owned', '1');
      panel.setAttribute('data-testid', 't3op-settings-panel');

      const pillGroup = (key, options, currentVal) =>
        `<div class="t3op-swatch-row">${options
          .map(
            (o) =>
              `<button type="button" class="t3op-pill-btn" data-cfg-key="${key}" data-cfg-val="${o.v}" aria-pressed="${String(currentVal) === String(o.v)}">${o.label}</button>`
          )
          .join('')}</div>`;

      const toggleRow = (key, label, checked) =>
        `<div class="t3op-toggle-row"><span>${label}</span><button type="button" role="switch" class="t3op-toggle-btn" data-cfg-toggle="${key}" aria-checked="${Boolean(checked)}" aria-label="${label}"></button></div>`;

      panel.innerHTML = `
        <div class="t3op-settings-head">
          <div class="t3op-settings-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z" stroke="var(--t3op-accent,#669df6)" stroke-width="1.8"/></svg>
            <span>T3 Prism Optics 外观与光学控制中心${titleSuffix}</span>
          </div>
          <div class="t3op-settings-presets">
            <button type="button" class="t3op-pill-btn" data-preset="full">满血光学</button>
            <button type="button" class="t3op-pill-btn" data-preset="zen">专注极简</button>
            ${typeof onForceThemeToggle === 'function' ? `<button type="button" class="t3op-pill-btn" data-toggle-scheme="1">${isDark ? '切换浅色昼景' : '切换深空暗夜'}</button>` : ''}
            <button type="button" class="t3op-pill-btn" data-reset="1">恢复默认</button>
          </div>
        </div>
        <div class="t3op-settings-grid">
          <div class="t3op-setting-card">
            <div class="t3op-setting-card-title">深色 / 浅色材质色板</div>
            ${pillGroup('palette', [{ v: 'obsidian', label: '深空黑曜' }, { v: 'warm', label: '暖炭玄岩' }, { v: 'host', label: '跟随宿主' }], cfg.palette)}
            <div class="t3op-setting-card-title" style="margin-top:4px">浅色昼景预设</div>
            ${pillGroup('lightPreset', [{ v: 'crystal', label: '白昼冷晶' }, { v: 'alabaster', label: '暖白画册' }], cfg.lightPreset)}
          </div>
          <div class="t3op-setting-card">
            <div class="t3op-setting-card-title">工业级强调色 Accent Tone</div>
            ${pillGroup('accentTone', [{ v: 'follow', label: '跟随棱镜' }, { v: 'cobalt', label: '钴蓝' }, { v: 'iris', label: '鸢尾紫' }, { v: 'amber', label: '琥珀' }, { v: 'mono', label: '银钛' }], cfg.accentTone)}
            <div class="t3op-setting-card-title" style="margin-top:4px">几何圆角</div>
            ${pillGroup('cornerStyle', [{ v: 'sharp', label: '锐利' }, { v: 'balanced', label: '均衡' }, { v: 'soft', label: '柔和' }], cfg.cornerStyle)}
          </div>
          <div class="t3op-setting-card">
            <div class="t3op-setting-card-title">动效挡位与氛围强度</div>
            ${pillGroup('motionLevel', [{ v: 'ultra', label: '极速满血' }, { v: 'standard', label: '标准' }, { v: 'subtle', label: '轻量' }, { v: 'off', label: '关闭' }], cfg.motionLevel)}
            ${pillGroup('ambientIntensity', [{ v: '0', label: '0%' }, { v: '35', label: '35%' }, { v: '70', label: '70%' }, { v: '100', label: '100%' }], cfg.ambientIntensity)}
          </div>
          <div class="t3op-setting-card">
            <div class="t3op-setting-card-title">输入框顶缘像素伙伴</div>
            ${pillGroup('mascot', [{ v: 'crab', label: '双宠' }, { v: 'minis', label: '叠叠乐' }, { v: 'quad', label: '四宠' }, { v: 'quad-minis', label: '四宠+迷你' }, { v: 'off', label: '关闭' }], cfg.mascot)}
            <div class="t3op-setting-card-title" style="margin-top:4px">对话背景波纹</div>
            ${pillGroup('convRipple', [{ v: 'off', label: '关闭' }, { v: 'subtle', label: '微光' }, { v: 'medium', label: '标准' }, { v: 'full', label: '满屏' }], cfg.convRipple)}
          </div>
          <div class="t3op-setting-card">
            <div class="t3op-setting-card-title">光学引擎与交互开关</div>
            ${toggleRow('homeRipple', '首页 ASCII 字符波纹与极光', cfg.homeRipple)}
            ${toggleRow('prismRim', '1px GPU 指针棱镜光边', cfg.prismRim)}
            ${toggleRow('streamInk', '五级水墨零重排流式渐显', cfg.streamInk)}
            ${toggleRow('smoothCaret', '输入框丝滑像素光标', cfg.smoothCaret)}
          </div>
          <div class="t3op-setting-card">
            <div class="t3op-setting-card-title">模型控件、遥测与工作台</div>
            ${toggleRow('effortSlider', '宇宙星空推理滑块 & 水晶条', cfg.effortSlider)}
            ${toggleRow('periodicBadges', '元素周期表键帽徽章', cfg.periodicBadges)}
            ${toggleRow('vialHud', '512K 3D 玻璃刻度大试管', cfg.vialHud)}
            ${toggleRow('studioHome', 'Studio 首页三视图半年看板', cfg.studioHome)}
            ${toggleRow('codeFold', '代码块与长回复折叠', cfg.codeFold)}
            ${toggleRow('outlineRail', '右侧对话提问大纲浮窗', cfg.outlineRail)}
            ${toggleRow('sidebarChatMode', '侧栏 代码 | 对话 工作区切换', cfg.sidebarChatMode)}
          </div>
        </div>
        <div class="t3op-settings-credit">
          <span><strong>T3 Prism Optics</strong> v1.1.0 · GPL-3.0-only · Independent T3 Code port</span>
          <span>Optical engines &amp; credits: <a href="https://github.com/RMvdesi/obsidian-prism" target="_blank" rel="noreferrer">Obsidian Prism by RMvdesi</a> &amp; upstream MIT contributors</span>
        </div>
      `;

      panel.querySelectorAll('[data-cfg-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-cfg-key');
          const v = btn.getAttribute('data-cfg-val');
          configStore.update({ [k]: v });
        });
      });

      panel.querySelectorAll('[data-cfg-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-cfg-toggle');
          const cur = Boolean(configStore.get()[k]);
          configStore.update({ [k]: !cur });
        });
      });

      panel.querySelector('[data-preset="full"]')?.addEventListener('click', () => {
        configStore.update({
          motionLevel: 'ultra',
          ambientIntensity: '100',
          homeRipple: true,
          convRipple: 'subtle',
          prismRim: true,
          streamInk: true,
          effortSlider: true,
          periodicBadges: true,
          vialHud: true,
          studioHome: true,
          mascot: 'minis',
        });
      });
      panel.querySelector('[data-preset="zen"]')?.addEventListener('click', () => {
        configStore.update({
          motionLevel: 'subtle',
          ambientIntensity: '35',
          homeRipple: false,
          convRipple: 'off',
          prismRim: false,
          mascot: 'off',
        });
      });
      panel.querySelector('[data-reset="1"]')?.addEventListener('click', () => {
        configStore.reset();
      });
      panel.querySelector('[data-toggle-scheme="1"]')?.addEventListener('click', () => {
        if (typeof onForceThemeToggle === 'function') onForceThemeToggle();
      });

      return panel;
    }

    function syncSettingsPanels() {
      const settingsScroll = document.querySelector('[data-settings-page-scroll]');
      if (settingsScroll) {
        if (settingsPanelInline && settingsPanelInline.isConnected) settingsPanelInline.remove();
        settingsPanelInline = buildSettingsPanelDom('');
        settingsScroll.appendChild(settingsPanelInline);
      } else if (settingsPanelInline) {
        settingsPanelInline.remove();
        settingsPanelInline = null;
      }

      if (quickDrawerEl && quickDrawerEl.isConnected) {
        quickDrawerEl.innerHTML = '';
        quickDrawerEl.appendChild(buildSettingsPanelDom(' · 快捷抽屉'));
      }
    }

    function openQuickDrawer() {
      if (quickDrawerEl && quickDrawerEl.isConnected) {
        closeQuickDrawer();
        return;
      }
      quickDrawerEl = document.createElement('div');
      quickDrawerEl.className = 't3op-quick-drawer';
      quickDrawerEl.setAttribute('data-t3op-owned', '1');
      quickDrawerEl.setAttribute('data-testid', 't3op-quick-drawer');
      quickDrawerEl.appendChild(buildSettingsPanelDom(' · 快捷抽屉'));
      document.body.appendChild(quickDrawerEl);
    }

    function closeQuickDrawer() {
      if (quickDrawerEl) {
        quickDrawerEl.remove();
        quickDrawerEl = null;
      }
    }

    function ensureQuickTrigger() {
      if (quickTriggerBtn && quickTriggerBtn.isConnected) return;
      quickTriggerBtn = document.createElement('button');
      quickTriggerBtn.type = 'button';
      quickTriggerBtn.className = 't3op-quick-trigger';
      quickTriggerBtn.setAttribute('data-t3op-owned', '1');
      quickTriggerBtn.setAttribute('data-testid', 't3op-quick-trigger');
      quickTriggerBtn.title = 'T3 Prism Optics 外观与光学控制中心';
      quickTriggerBtn.setAttribute('aria-label', '打开 T3 Prism Optics 控制中心');
      quickTriggerBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L20.5 7V17L12 22L3.5 17V7L12 2Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 2V22M3.5 7L12 12L20.5 7" stroke="var(--t3op-accent,#669df6)" stroke-width="1.4"/></svg>';
      quickTriggerBtn.addEventListener('click', openQuickDrawer);
      document.body.appendChild(quickTriggerBtn);
    }

    function refresh() {
      if (destroyed) return;
      syncFolds();
      syncOutlineRail();
      syncSidebarModeSwitch();
      ensureQuickTrigger();
      syncSettingsPanels();
    }

    function destroy() {
      destroyed = true;
      closeOutlinePopover();
      closeQuickDrawer();
      if (outlineFab) {
        outlineFab.remove();
        outlineFab = null;
      }
      if (modeSwitchEl) {
        modeSwitchEl.remove();
        modeSwitchEl = null;
      }
      if (chatNewBtnEl) {
        chatNewBtnEl.remove();
        chatNewBtnEl = null;
      }
      if (chatModePillEl) {
        chatModePillEl.remove();
        chatModePillEl = null;
      }
      if (settingsPanelInline) {
        settingsPanelInline.remove();
        settingsPanelInline = null;
      }
      if (quickTriggerBtn) {
        quickTriggerBtn.remove();
        quickTriggerBtn = null;
      }
      document.querySelectorAll('.t3op-code-fold-btn, .t3op-msg-fold-btn').forEach((n) => n.remove());
      document.querySelectorAll('[data-t3op-folded]').forEach((n) => n.removeAttribute('data-t3op-folded'));
      document.querySelectorAll('[data-t3op-msg-folded]').forEach((n) => n.removeAttribute('data-t3op-msg-folded'));
      document.documentElement.removeAttribute('data-t3-op-chat-mode');
    }

    return {
      refresh,
      setChatMode,
      openQuickDrawer,
      closeQuickDrawer,
      openOutlinePopover,
      closeOutlinePopover,
      destroy,
    };
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const api = { createWorkbenchAndSettings };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpWorkbench = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
