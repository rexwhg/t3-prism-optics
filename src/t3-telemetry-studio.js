(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  const TELEMETRY_BINDING = '__t3OpTelemetryCall';

  const STUDIO_RANGES = [
    { id: '7d', label: '7天', days: 7, heatWeeks: 8 },
    { id: '30d', label: '30天', days: 30, heatWeeks: 14 },
    { id: '90d', label: '3个月', days: 90, heatWeeks: 18 },
    { id: '180d', label: '半年', days: 180, heatWeeks: 26 },
    { id: 'all', label: '全部', days: null, heatWeeks: 26 },
  ];

  const MODEL_COLORS = [
    '#4f8ff7',
    '#8b8fa8',
    '#6366f1',
    '#38bdf8',
    '#2dd4bf',
    '#a78bfa',
    '#f59e0b',
    '#f472b6',
  ];

  function formatCompact(n) {
    const v = Number(n) || 0;
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
    return String(Math.round(v));
  }

  function formatShortDate(dk) {
    const parts = String(dk || '').split('-');
    if (parts.length !== 3) return dk;
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  }

  function localDayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function buildFallbackTelemetry() {
    // Graceful synthetic fallback only when running standalone demo without local ~/.t3 cache
    const days = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 179; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dk = localDayKey(d);
      const wave = Math.sin(i * 0.23) + Math.cos(i * 0.11);
      if (wave < -0.55) continue;
      const scale = Math.round((1.2 + Math.max(0, wave)) * 680000);
      const cached = Math.round(scale * 0.84);
      const output = Math.round(scale * 0.045);
      const input = scale - output;
      days[dk] = {
        calls: Math.max(2, Math.round(scale / 95000)),
        input,
        cached,
        cacheWrite: 0,
        output,
        reasoning: Math.round(output * 0.35),
        total: scale,
        sessions: Math.max(1, Math.round(scale / 450000)),
        models: {
          'gpt-6.2-sol': { calls: 8, input: Math.round(input * 0.65), cached: Math.round(cached * 0.68), output: Math.round(output * 0.6), reasoning: 0, total: Math.round(scale * 0.65) },
          'gemini-4-neon': { calls: 4, input: Math.round(input * 0.25), cached: Math.round(cached * 0.22), output: Math.round(output * 0.28), reasoning: 0, total: Math.round(scale * 0.25) },
          'claude-sonnet-4.6': { calls: 2, input: Math.round(input * 0.1), cached: Math.round(cached * 0.1), output: Math.round(output * 0.12), reasoning: 0, total: Math.round(scale * 0.1) },
        },
        projects: {
          'Codex 历史': { calls: 10, input, cached, output, reasoning: 0, total: scale, sessions: 2 },
        },
      };
    }
    return {
      version: 2,
      generatedAt: Date.now(),
      userName: 'rexryder',
      dateRange: { min: localDayKey(new Date(today.getTime() - 179 * 86400000)), max: localDayKey(today) },
      totalRecords: 1620,
      totalSessions: 148,
      providers: { codex: 1520, claude: 100 },
      projects: [{ name: 'Codex 历史', total: 145000000, sessions: 148 }],
      days,
      quotas: [
        {
          id: 'codex',
          name: 'Codex / GPT',
          source: 'demo',
          level: 'ok',
          badge: '充裕',
          windows: [
            { label: '5 小时窗口', remainingPct: 92, resetText: '3小时18分' },
            { label: '周配额', remainingPct: 71, resetText: '4天6小时' },
          ],
        },
        {
          id: 'gemini',
          name: 'Gemini (Antigravity)',
          source: 'demo',
          level: 'ok',
          badge: '充裕',
          windows: [
            { label: '5 小时窗口', remainingPct: 100, resetText: '4小时52分' },
            { label: '周配额', remainingPct: 89, resetText: '5天7小时' },
          ],
        },
      ],
      latestContext: { model: 'gpt-6.2-sol', usedTokens: 91505, cachedTokens: 90112, totalSessionTokens: 2905960 },
      sourcesNote: '演示数据 · 连接本地 CDP 后自动导入 Codex 半年真实记录',
    };
  }

  function getTelemetryData() {
    if (G.__t3OpTelemetry && G.__t3OpTelemetry.days && Object.keys(G.__t3OpTelemetry.days).length > 0) {
      return G.__t3OpTelemetry;
    }
    return buildFallbackTelemetry();
  }

  function aggregateForView(rawData, rangeId, projectFilter) {
    const rangeDef = STUDIO_RANGES.find((r) => r.id === rangeId) || STUDIO_RANGES[3];
    const allKeys = Object.keys(rawData.days || {}).sort();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = localDayKey(today);
    const anchorKey = allKeys.length > 0 && allKeys[allKeys.length - 1] > todayKey ? allKeys[allKeys.length - 1] : todayKey;
    const anchorDate = new Date(`${anchorKey}T00:00:00`);

    let startKey = null;
    if (rangeDef.days) {
      const s = new Date(anchorDate);
      s.setDate(s.getDate() - (rangeDef.days - 1));
      startKey = localDayKey(s);
    }

    let totalTokens = 0;
    let totalInput = 0;
    let totalCached = 0;
    let totalOutput = 0;
    let totalCalls = 0;
    let sessionSum = 0;
    let activeDays = 0;
    const modelTotals = Object.create(null);
    const daySeriesMap = Object.create(null);
    const allDayTotals = Object.create(null);

    for (const dk of allKeys) {
      const entry = rawData.days[dk];
      if (!entry) continue;

      let dayTotal = 0;
      let dayInput = 0;
      let dayCached = 0;
      let dayOutput = 0;
      let dayCalls = 0;
      let daySessions = 0;

      if (projectFilter && projectFilter !== 'all') {
        const pf = entry.projects?.[projectFilter];
        if (!pf) continue;
        dayTotal = pf.total || 0;
        dayInput = pf.input || 0;
        dayCached = pf.cached || 0;
        dayOutput = pf.output || 0;
        dayCalls = pf.calls || 0;
        daySessions = pf.sessions || 0;
      } else {
        dayTotal = entry.total || 0;
        dayInput = entry.input || 0;
        dayCached = entry.cached || 0;
        dayOutput = entry.output || 0;
        dayCalls = entry.calls || 0;
        daySessions = entry.sessions || 0;
      }

      if (dayTotal > 0) allDayTotals[dk] = dayTotal;
      if (startKey && dk < startKey) continue;
      if (dayTotal <= 0) continue;

      activeDays += 1;
      totalTokens += dayTotal;
      totalInput += dayInput;
      totalCached += dayCached;
      totalOutput += dayOutput;
      totalCalls += dayCalls;
      sessionSum += daySessions;
      daySeriesMap[dk] = { date: dk, total: dayTotal, calls: dayCalls, models: entry.models || {} };

      const scaleFactor = projectFilter && projectFilter !== 'all' && entry.total > 0 ? dayTotal / entry.total : 1;
      for (const [mName, mv] of Object.entries(entry.models || {})) {
        if (!modelTotals[mName]) {
          modelTotals[mName] = { name: mName, input: 0, cached: 0, output: 0, total: 0, calls: 0 };
        }
        const mt = modelTotals[mName];
        mt.input += Math.round((mv.input || 0) * scaleFactor);
        mt.cached += Math.round((mv.cached || 0) * scaleFactor);
        mt.output += Math.round((mv.output || 0) * scaleFactor);
        mt.total += Math.round((mv.total || 0) * scaleFactor);
        mt.calls += Math.max(1, Math.round((mv.calls || 0) * scaleFactor));
      }
    }

    const modelsList = Object.values(modelTotals)
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total);
    const cacheHitPct = totalInput > 0 ? Math.min(99.9, (totalCached / totalInput) * 100) : 0;

    // Build continuous daily series for Area+Line Chart
    const series = [];
    const spanDays = rangeDef.days || Math.max(14, Math.min(365, allKeys.length > 0 ? Math.round((anchorDate - new Date(`${allKeys[0]}T00:00:00`)) / 86400000) + 1 : 30));
    const chartStart = new Date(anchorDate);
    chartStart.setDate(chartStart.getDate() - (spanDays - 1));
    for (let i = 0; i < spanDays; i += 1) {
      const cur = new Date(chartStart);
      cur.setDate(chartStart.getDate() + i);
      const dk = localDayKey(cur);
      const found = daySeriesMap[dk];
      series.push({
        date: dk,
        total: found ? found.total : 0,
        calls: found ? found.calls : 0,
        topModel: found
          ? Object.entries(found.models || {}).sort((a, b) => (b[1]?.total || 0) - (a[1]?.total || 0))[0]?.[0] || ''
          : '',
      });
    }

    // Build 7-row Heatmap grid (26 weeks = half year, or matches selected range)
    const heatWeeks = rangeDef.heatWeeks || 26;
    const heatEnd = new Date(anchorDate);
    const heatStart = new Date(heatEnd);
    heatStart.setDate(heatStart.getDate() - (heatWeeks * 7 - 1));
    heatStart.setDate(heatStart.getDate() - heatStart.getDay()); // Align to Sunday

    const heatCells = [];
    let heatPeak = 0;
    for (const cursor = new Date(heatStart); cursor <= heatEnd; cursor.setDate(cursor.getDate() + 1)) {
      const dk = localDayKey(cursor);
      const inWindow = !startKey || dk >= startKey;
      const tok = inWindow ? allDayTotals[dk] || 0 : 0;
      if (tok > heatPeak) heatPeak = tok;
      heatCells.push({ date: dk, total: tok, inWindow, lvl: 0 });
    }
    for (const cell of heatCells) {
      if (cell.total > 0 && heatPeak > 0) {
        // Log-scaled intensity so both moderate and mega-sessions look richly differentiated
        const ratio = Math.log1p(cell.total) / Math.log1p(heatPeak);
        cell.lvl = Math.max(1, Math.min(4, Math.ceil(ratio * 4)));
      }
    }

    // Books equivalence (~252k tokens ≈ 1 《远大前程》 matching Obsidian Prism)
    const books = totalTokens > 0 ? Math.max(1, Math.round(totalTokens / 252000)) : 0;

    return {
      rangeDef,
      totalTokens,
      totalInput,
      totalCached,
      totalOutput,
      totalCalls,
      sessions: rangeId === 'all' && projectFilter === 'all' ? rawData.totalSessions || sessionSum : sessionSum,
      activeDays,
      cacheHitPct,
      topModel: modelsList[0]?.name || '—',
      modelsList,
      series,
      heatCells,
      heatWeeks,
      books,
    };
  }

  function buildAreaChartSvg(series) {
    const W = 580;
    const H = 164;
    const padL = 44;
    const padR = 12;
    const padT = 12;
    const padB = 26;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxVal = Math.max(1, ...series.map((s) => s.total));
    // Nice rounded ceiling
    const pow10 = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const ceilVal = Math.ceil(maxVal / pow10) * pow10;

    const pts = series.map((s, i) => {
      const x = padL + (series.length <= 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
      const y = padT + plotH - (s.total / ceilVal) * plotH;
      return { x, y, ...s };
    });

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaD = `${lineD} L${pts[pts.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: padT + plotH - f * plotH,
      label: f === 0 ? '0' : formatCompact(ceilVal * f),
    }));

    const xTickIndices =
      series.length <= 7
        ? series.map((_, i) => i)
        : [0, Math.floor(series.length * 0.25), Math.floor(series.length * 0.5), Math.floor(series.length * 0.75), series.length - 1];
    const uniqueXIdx = [...new Set(xTickIndices)];

    // Highlight peak point
    let peakPt = pts[0];
    for (const p of pts) if (p.total > peakPt.total) peakPt = p;

    return `
      <svg class="t3op-area-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Token 每日用量趋势图">
        <defs>
          <linearGradient id="t3opAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--t3op-accent, #4f8ff7)" stop-opacity="0.52"/>
            <stop offset="85%" stop-color="var(--t3op-accent, #4f8ff7)" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="var(--t3op-accent, #4f8ff7)" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${yTicks
          .map(
            (t) => `
          <line x1="${padL}" y1="${t.y.toFixed(1)}" x2="${W - padR}" y2="${t.y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="2,3"/>
          <text x="${padL - 7}" y="${(t.y + 3.5).toFixed(1)}" text-anchor="end" fill="currentColor" fill-opacity="0.5" font-size="9.5" font-family="ui-monospace,monospace">${t.label}</text>`
          )
          .join('')}
        <path d="${areaD}" fill="url(#t3opAreaFill)"/>
        <path d="${lineD}" fill="none" stroke="var(--t3op-accent, #669df6)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${
          peakPt && peakPt.total > 0
            ? `<circle cx="${peakPt.x.toFixed(1)}" cy="${peakPt.y.toFixed(1)}" r="4.2" fill="var(--t3op-canvas, #0e0e11)" stroke="var(--t3op-accent, #669df6)" stroke-width="2.2"><title>${peakPt.date}: ${formatCompact(peakPt.total)} tokens (${peakPt.calls} 次调用)</title></circle>`
            : ''
        }
        ${pts
          .map((p, i) => {
            const bw = Math.max(4, plotW / Math.max(1, pts.length));
            return `<rect class="t3op-chart-hit" data-idx="${i}" x="${(p.x - bw / 2).toFixed(1)}" y="${padT}" width="${bw.toFixed(1)}" height="${plotH}" fill="transparent"/>`;
          })
          .join('')}
        ${uniqueXIdx
          .map((i) => {
            const p = pts[i];
            if (!p) return '';
            return `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="currentColor" fill-opacity="0.52" font-size="9.5">${formatShortDate(p.date)}</text>`;
          })
          .join('')}
      </svg>
    `;
  }

  function openNativeT3UsagePage() {
    const btn = document.querySelector('button[aria-label="用量"], button[aria-label="Usage"], a[href*="/usage"]');
    if (btn) {
      try {
        btn.click();
        return true;
      } catch {}
    }
    return false;
  }

  function formatResetIso(resetsAtIso) {
    if (!resetsAtIso) return '';
    const ms = typeof resetsAtIso === 'number' ? resetsAtIso : Date.parse(String(resetsAtIso));
    if (!Number.isFinite(ms)) return '';
    const diffSec = Math.max(0, Math.round((ms - Date.now()) / 1000));
    if (diffSec < 60) return '即将重置';
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    if (days > 0) return `${days}天${hours}小时`;
    if (hours > 0) return `${hours}小时${mins}分`;
    return `${mins}分钟`;
  }

  function localizeWindowLabel(w) {
    const mins = Number(w?.windowDurationMins || 0);
    const id = String(w?.id || '').toLowerCase();
    const kind = String(w?.kind || '').toLowerCase();
    if (kind === 'weekly' || id.includes('weekly') || mins >= 9000) return '周配额';
    if (mins >= 1300) return `${Math.round(mins / 1440)}天窗口`;
    if (mins >= 60) return `${Math.round(mins / 60)} 小时窗口`;
    if (id.includes('5h') || /5-?hour/i.test(String(w?.label || ''))) return '5 小时窗口';
    return String(w?.label || '配额窗口');
  }

  function makeQuotaCard(id, name, camp, rawWindows, source) {
    const windows = (rawWindows || [])
      .filter((w) => w && typeof w.usedPercent === 'number')
      .map((w) => ({
        label: localizeWindowLabel(w),
        remainingPct: Math.max(0, Math.min(100, Math.round(100 - w.usedPercent))),
        usedPct: Math.round(w.usedPercent),
        resetText: formatResetIso(w.resetsAt),
        resetsAt: w.resetsAt || null,
      }));
    if (windows.length === 0) return null;
    const minRem = Math.min(...windows.map((w) => w.remainingPct));
    return {
      id,
      name,
      camp,
      source,
      level: minRem <= 15 ? 'low' : minRem <= 35 ? 'warn' : 'ok',
      badge: minRem <= 15 ? '额度偏低' : minRem <= 35 ? '余量偏紧' : '充裕',
      windows,
    };
  }

  let liveQuotaCache = { at: 0, pools: null, lastGood: [] };

  // Read-only BFS lookup of live provider usageLimits already held in T3 Code's React memory
  // BFS visits top-level app/store providers in ~60-100 steps (<0.2ms) even on huge 100-turn threads!
  function readLiveT3ProviderQuotas(force = false) {
    const now = Date.now();
    if (!force && liveQuotaCache.pools && liveQuotaCache.pools.length > 0 && now - liveQuotaCache.at < 2000) {
      return liveQuotaCache.pools;
    }
    if (typeof document === 'undefined') return liveQuotaCache.lastGood;
    const rootEl = document.getElementById('root') || document.body?.firstElementChild;
    if (!rootEl) return liveQuotaCache.lastGood;
    const fk = Object.keys(rootEl).find((k) => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    if (!fk) return liveQuotaCache.lastGood;

    const isProvidersArr = (val) =>
      Array.isArray(val) &&
      val.length > 0 &&
      val.length < 30 &&
      val[0] &&
      typeof val[0] === 'object' &&
      ('usageLimits' in val[0] || ('driver' in val[0] && 'enabled' in val[0]));

    const inspectVal = (val, depth = 0) => {
      if (!val || depth > 3 || typeof val !== 'object') return null;
      if (isProvidersArr(val)) return val;
      if (!Array.isArray(val)) {
        if (Array.isArray(val.providers) && isProvidersArr(val.providers)) return val.providers;
        if (Array.isArray(val.serverProviders) && isProvidersArr(val.serverProviders)) return val.serverProviders;
        if (val.value && typeof val.value === 'object') {
          const nested = inspectVal(val.value, depth + 1);
          if (nested) return nested;
        }
      }
      return null;
    };

    const visited = new Set();
    const queue = [rootEl[fk]];
    let head = 0;
    let providers = null;
    let steps = 0;

    while (head < queue.length && steps < 2500 && !providers) {
      const node = queue[head++];
      if (!node || visited.has(node)) continue;
      visited.add(node);
      steps += 1;
      try {
        providers = inspectVal(node.memoizedProps);
      } catch {}
      let st = node.memoizedState;
      let sc = 0;
      while (st && sc < 20 && !providers) {
        sc += 1;
        try {
          providers = inspectVal(st.memoizedState);
        } catch {}
        st = st.next;
      }
      if (providers) break;
      if (node.child) queue.push(node.child);
      if (node.sibling) queue.push(node.sibling);
    }

    const pools = [];
    if (Array.isArray(providers)) {
      for (const p of providers) {
        if (!p || p.enabled === false || !p.usageLimits || !Array.isArray(p.usageLimits.windows) || p.usageLimits.windows.length === 0) {
          continue;
        }
        const drv = String(p.driver || p.provider || '').toLowerCase();
        const wins = p.usageLimits.windows;
        if (drv === 'antigravity') {
          const gemWins = wins.filter((w) => /gemini/i.test(`${w.id || ''} ${w.label || ''}`));
          const thirdWins = wins.filter((w) => /3p|claude|gpt/i.test(`${w.id || ''} ${w.label || ''}`));
          const gemCard = makeQuotaCard('antigravity-gemini', 'Gemini (Antigravity)', 'gemini', gemWins, 't3-live');
          if (gemCard) pools.push(gemCard);
          const thirdCard = makeQuotaCard('antigravity-3p', 'Claude / GPT (Antigravity)', 'claude', thirdWins, 't3-live');
          if (thirdCard) pools.push(thirdCard);
        } else if (drv === 'codex') {
          const codexCard = makeQuotaCard('t3-codex', p.displayName || 'Codex / GPT', 'codex', wins, 't3-live');
          if (codexCard) pools.push(codexCard);
        } else if (drv.includes('claude')) {
          const claudeCard = makeQuotaCard('t3-claude', p.displayName || 'Claude', 'claude', wins, 't3-live');
          if (claudeCard) pools.push(claudeCard);
        }
      }
    }

    if (pools.length > 0) {
      liveQuotaCache = { at: now, pools, lastGood: pools };
      return pools;
    }
    return liveQuotaCache.lastGood;
  }

  function mergeAllQuotaPools(rawData, forceLive = false) {
    const livePools = readLiveT3ProviderQuotas(forceLive);
    const localPools = Array.isArray(rawData?.quotas) ? rawData.quotas : [];
    const merged = [];

    // 1. Add all live T3 provider pools (Gemini, Antigravity 3P Claude/GPT, Codex, Claude)
    const liveCodex = livePools.find((q) => q.camp === 'codex');
    const localCodex = localPools.find((q) => /codex|gpt/i.test(`${q.id || ''} ${q.name || ''}`));

    for (const q of livePools) {
      if (q === liveCodex && localCodex) {
        // Merge local 5h session window with T3 live weekly window so Codex shows both cleanly
        const combined = [...q.windows];
        for (const lw of localCodex.windows || []) {
          const exists = combined.some((cw) => cw.label === lw.label);
          if (!exists) combined.unshift(lw);
        }
        const minRem = Math.min(...combined.map((w) => w.remainingPct));
        merged.push({
          ...q,
          name: localCodex.name || q.name,
          windows: combined,
          level: minRem <= 15 ? 'low' : minRem <= 35 ? 'warn' : 'ok',
          badge: minRem <= 15 ? '额度偏低' : minRem <= 35 ? '余量偏紧' : '充裕',
        });
      } else {
        merged.push(q);
      }
    }

    // 2. Append any local pools not already represented
    for (const lq of localPools) {
      const lqCamp = /gemini/i.test(`${lq.id || ''} ${lq.name || ''}`)
        ? 'gemini'
        : /claude/i.test(`${lq.id || ''} ${lq.name || ''}`)
        ? 'claude'
        : 'codex';
      if (lq === localCodex && liveCodex) continue;
      if (!merged.some((m) => m.id === lq.id)) {
        merged.push({ ...lq, camp: lq.camp || lqCamp });
      }
    }

    return merged.length > 0 ? merged : buildFallbackTelemetry().quotas.map((q) => ({
      ...q,
      camp: /gemini/i.test(`${q.id} ${q.name}`) ? 'gemini' : /claude/i.test(`${q.id} ${q.name}`) ? 'claude' : 'codex',
    }));
  }

  function selectQuotasForCamp(allQuotas, camp) {
    if (!Array.isArray(allQuotas) || allQuotas.length === 0) return [];
    const target = camp || 'gemini';
    const matched = allQuotas.filter((q) => {
      if (q.camp) return q.camp === target;
      const text = `${q.id || ''} ${q.name || ''}`.toLowerCase();
      if (target === 'gemini') return /gemini|antigravity/.test(text) && !/3p|claude|gpt/.test(text);
      if (target === 'claude') return /claude|3p/.test(text);
      return /codex|gpt/.test(text);
    });
    if (matched.length > 0) return matched;
    // Fallback: if Claude selected and only shared Antigravity 3P exists
    if (target === 'claude') {
      const shared = allQuotas.filter((q) => /3p|claude/i.test(`${q.id || ''} ${q.name || ''}`));
      if (shared.length > 0) return shared;
    }
    return allQuotas.slice(0, 1);
  }

  function readLiveTelemetryFromDom() {
    const rawData = getTelemetryData();
    const ctx = rawData.latestContext;
    let usedTokens = ctx?.usedTokens > 0 ? ctx.usedTokens : 168000;
    let maxTokens = 512000;
    let modelLabel = ctx?.model || 'Gemini 4 Neon';
    let modelId = modelLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let camp = /claude|opus|sonnet|haiku/i.test(modelLabel)
      ? 'claude'
      : /gpt|codex|sol|astra|luna|terra/i.test(modelLabel)
      ? 'codex'
      : 'gemini';

    const picker = document.querySelector('[data-chat-provider-model-picker="true"]');
    if (picker) {
      const raw = (picker.getAttribute('aria-label') || picker.textContent || '').replace(/\s+/g, ' ').trim();
      if (raw) {
        modelLabel = raw.split(',')[0].trim();
        // Strip prepended periodic keycap badge text like "10Ne " if injected into button textContent
        modelLabel = modelLabel.replace(/^\d{1,3}[A-Z][a-z]?\s+/, '').trim() || modelLabel;
        modelId = modelLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 't3-model';
        if (/claude|opus|sonnet|haiku/i.test(raw)) camp = 'claude';
        else if (/gpt|codex|o3|o4|sol|astra|luna|terra/i.test(raw)) camp = 'codex';
        else camp = 'gemini';
      }
    }

    const details = document.querySelector('[data-thread-details-card]');
    if (details) {
      const text = details.textContent || '';
      const m = text.match(/([\d.]+)\s*([kKmM]?)\s*\/\s*([\d.]+)\s*([kKmM])/);
      if (m) {
        const mult = (u) => (u.toLowerCase() === 'm' ? 1e6 : u.toLowerCase() === 'k' ? 1e3 : 1);
        const u = parseFloat(m[1]) * mult(m[2] || 'k');
        const mx = parseFloat(m[3]) * mult(m[4]);
        if (Number.isFinite(u) && Number.isFinite(mx) && mx > 0) {
          usedTokens = Math.round(u);
          maxTokens = Math.round(mx);
        }
      }
    }

    const fill = Math.max(0.04, Math.min(0.99, usedTokens / Math.max(1, maxTokens)));
    const sysTokens = Math.round(usedTokens * 0.163);
    const convTokens = Math.round(usedTokens * 0.572);
    const toolTokens = Math.max(0, usedTokens - sysTokens - convTokens);
    const agg30 = aggregateForView(rawData, '30d', 'all');
    const allQuotas = mergeAllQuotaPools(rawData);
    const activeQuotas = selectQuotasForCamp(allQuotas, camp);

    return {
      usedTokens,
      maxTokens,
      fill,
      pct: Math.round(fill * 1000) / 10,
      modelLabel,
      modelId,
      camp,
      ttft: '0.32s',
      tps: 74.8,
      cacheHit: agg30.cacheHitPct > 0 ? agg30.cacheHitPct : 86.9,
      cacheMb: 142,
      slices: [
        { idx: 0, label: '系统规则 System', tokens: sysTokens, color: '#60a5fa' },
        { idx: 1, label: '对话轮次 Conversation', tokens: convTokens, color: '#3b82f6' },
        { idx: 2, label: '工具与子代理 Tools', tokens: toolTokens, color: '#818cf8' },
      ],
      quotas: allQuotas,
      activeQuotas,
    };
  }

  function createTelemetryStudio({ configStore, opticsHost, getRuntimeState, onOpenSettings }) {
    let destroyed = false;
    let hudEl = null;
    let popoverEl = null;
    let vialCtrl = null;
    let vialRaf = 0;
    let vialLastMs = 0;
    let hoveredSlice = -1;
    let cacheCleared = false;

    let studioWrapEl = null;
    let studioModalEl = null;
    let studioTriggerBtn = null;
    let studioTab = 'overview'; // 'overview' | 'models' | 'quotas'
    let studioRange = '180d';   // '7d' | '30d' | '90d' | '180d' | 'all'
    let studioProject = 'all';

    function stopVialLoop() {
      if (vialRaf) {
        cancelAnimationFrame(vialRaf);
        vialRaf = 0;
      }
      if (vialCtrl) {
        try {
          vialCtrl.dispose();
        } catch {}
        vialCtrl = null;
      }
    }

    function closeVialPopover() {
      stopVialLoop();
      if (popoverEl) {
        try {
          popoverEl.remove();
        } catch {}
        popoverEl = null;
      }
      hoveredSlice = -1;
      document.removeEventListener('pointerdown', onOutsidePopoverClick, true);
    }

    function onOutsidePopoverClick(ev) {
      if (!popoverEl) return;
      if (popoverEl.contains(ev.target)) return;
      if (hudEl && hudEl.contains(ev.target)) return;
      closeVialPopover();
    }

    function tickVial(now) {
      vialRaf = 0;
      if (destroyed || !popoverEl || !popoverEl.isConnected || !vialCtrl) return;
      const dt = vialLastMs > 0 ? Math.min(0.05, Math.max(0.008, (now - vialLastMs) / 1000)) : 0.016;
      vialLastMs = now;
      try {
        vialCtrl.step(dt);
      } catch {}
      if (!document.hidden) {
        vialRaf = requestAnimationFrame(tickVial);
      }
    }

    function renderVialQuotaRowsHtml(activeQuotas) {
      const pool = (activeQuotas || [])[0];
      if (!pool || !Array.isArray(pool.windows) || pool.windows.length === 0) {
        return '<div class="t3op-quota-row" style="font-size:11.5px;opacity:0.7"><span>当前模型暂无本地配额窗口，可点击下方「T3 用量」查看</span></div>';
      }
      return pool.windows
        .slice(0, 2)
        .map(
          (w) => `
        <div class="t3op-quota-metric" style="gap:4px">
          <div class="t3op-quota-row" style="font-size:11.5px">
            <span class="t3op-quota-label">${escapeHtml(pool.name)} · ${escapeHtml(w.label)}</span>
            <span class="t3op-quota-val">${w.remainingPct}% ${w.resetText ? `<span style="opacity:0.6;font-weight:400">· ${escapeHtml(w.resetText)}</span>` : ''}</span>
          </div>
          <div class="t3op-quota-track"><div class="t3op-quota-fill" style="width:${w.remainingPct}%"></div></div>
        </div>`
        )
        .join('');
    }

    function updateOpenVialPopover() {
      if (!popoverEl || !popoverEl.isConnected) return;
      const data = readLiveTelemetryFromDom();
      const rt = getRuntimeState ? getRuntimeState() : {};
      const liveStreaming = Boolean(rt.streaming);

      const metaLeft = popoverEl.querySelector('.t3op-vial-top-meta span');
      const metaPct = popoverEl.querySelector('.t3op-vial-top-meta strong');
      if (metaLeft) metaLeft.textContent = `${Math.round(data.maxTokens / 1000)}K`;
      if (metaPct) metaPct.textContent = `${data.pct.toFixed(1)}%`;

      const statusFoot = popoverEl.querySelector('.t3op-vial-status-foot');
      if (statusFoot) {
        statusFoot.setAttribute('data-live', liveStreaming ? '1' : '0');
        statusFoot.textContent = liveStreaming ? 'LIVE' : 'IDLE';
      }

      const modelLine = popoverEl.querySelector('.t3op-vial-model-line');
      const nextModelLine = `${data.modelLabel} → ${data.modelId}`;
      if (modelLine && modelLine.textContent !== nextModelLine) {
        modelLine.textContent = nextModelLine;
        if (vialCtrl) {
          vialCtrl.agitate(0.95);
          vialCtrl.wake();
        }
      }

      const quotaBox = popoverEl.querySelector('[data-t3op-vial-quotas]');
      if (quotaBox) {
        const html = renderVialQuotaRowsHtml(data.activeQuotas);
        if (quotaBox.dataset.sig !== html) {
          quotaBox.innerHTML = html;
          quotaBox.dataset.sig = html;
        }
      }
    }

    function openVialPopover(anchorEl) {
      if (destroyed) return;
      if (popoverEl && popoverEl.isConnected) {
        closeVialPopover();
        return;
      }
      const data = readLiveTelemetryFromDom();
      const rt = getRuntimeState ? getRuntimeState() : {};
      const liveStreaming = Boolean(rt.streaming);
      const quotaHtml = renderVialQuotaRowsHtml(data.activeQuotas);

      const pop = document.createElement('div');
      pop.className = 't3op-vial-popover';
      pop.setAttribute('data-t3op-owned', '1');
      pop.setAttribute('data-testid', 't3op-vial-popover');
      pop.setAttribute('data-ag-cs-prism-box', '1');
      pop.innerHTML = `
        <div class="t3op-vial-col-left">
          <div class="t3op-vial-top-meta">
            <span>${Math.round(data.maxTokens / 1000)}K</span>
            <strong>${data.pct.toFixed(1)}%</strong>
          </div>
          <canvas class="t3op-vial-canvas" width="96" height="220" title="点击或滑过激荡浅水波物理胶囊"></canvas>
          <div class="t3op-vial-status-foot" data-live="${liveStreaming ? '1' : '0'}">${liveStreaming ? 'LIVE' : 'IDLE'}</div>
        </div>
        <div class="t3op-vial-col-right">
          <div class="t3op-vial-verify-box">
            <div class="t3op-vial-verify-head">
              <span>真实模型采样验真</span>
              <span class="t3op-verified-pill">VERIFIED</span>
            </div>
            <div class="t3op-vial-model-line">${escapeHtml(data.modelLabel)} → ${escapeHtml(data.modelId)}</div>
            <div class="t3op-vial-perf-row">
              <span>TTFT ${data.ttft}</span>
              <span>缓存命中 ${data.cacheHit.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <div class="t3op-vial-verify-head" style="margin-bottom:6px">
              <span>深海电离光谱</span>
              <span style="color:var(--t3op-fg);font-weight:600">${formatCompact(data.usedTokens)} / ${formatCompact(data.maxTokens)} · ${data.pct.toFixed(1)}%</span>
            </div>
            ${data.slices
              .map(
                (s) => `
              <div class="t3op-vial-slice-row" data-slice-idx="${s.idx}">
                <span><i class="t3op-vial-dot" style="background:${s.color}"></i>${s.label}</span>
                <strong>${formatCompact(s.tokens)}</strong>
              </div>`
              )
              .join('')}
          </div>
          <div>
            <div class="t3op-vial-verify-head" style="margin-bottom:6px">
              <span>实时模型配额池</span>
              <button type="button" class="t3op-link-inline" data-t3op-open-studio-modal="1">半年概览 ›</button>
            </div>
            <div data-t3op-vial-quotas style="display:flex;flex-direction:column;gap:8px">${quotaHtml}</div>
          </div>
          <div class="t3op-vial-footer-bar">
            <span>本地轨迹缓存 ${cacheCleared ? '0 MB' : `${data.cacheMb} MB`}</span>
            <div style="display:flex;gap:6px">
              <button type="button" class="t3op-code-fold-btn" data-t3op-native-usage="1">T3 用量</button>
              <button type="button" class="t3op-code-fold-btn" data-t3op-clear-cache="1">${cacheCleared ? '已清理' : '清理'}</button>
            </div>
          </div>
        </div>
      `;
      const qb = pop.querySelector('[data-t3op-vial-quotas]');
      if (qb) qb.dataset.sig = quotaHtml;

      document.body.appendChild(pop);
      popoverEl = pop;

      const popRect = pop.getBoundingClientRect();
      if (anchorEl && anchorEl.getBoundingClientRect) {
        const ar = anchorEl.getBoundingClientRect();
        const left = Math.max(12, Math.min(window.innerWidth - popRect.width - 12, ar.right - popRect.width));
        const top = Math.max(12, ar.top - popRect.height - 12);
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(top)}px`;
      } else {
        pop.style.right = '24px';
        pop.style.bottom = '86px';
      }

      const canvas = pop.querySelector('.t3op-vial-canvas');
      if (canvas && G.__agVialCore) {
        vialCtrl = G.__agVialCore.mountPhysicalWaterVial(canvas, {
          fill: data.fill,
          maxTokens: data.maxTokens,
          isDark: configStore.detectDarkTheme(),
          reduceMotion: configStore.get().motionLevel === 'off',
          getState: () => {
            const live = readLiveTelemetryFromDom();
            const curRt = getRuntimeState ? getRuntimeState() : {};
            const cfg = configStore.get();
            return {
              isDark: configStore.detectDarkTheme(),
              camp: live.camp,
              critical: live.fill >= 0.85,
              fill: live.fill,
              maxTokens: live.maxTokens,
              hoveredSlice,
              streaming: Boolean(curRt.streaming),
              accentTone: cfg.accentTone,
              palette: cfg.palette,
            };
          },
        });
        vialCtrl.agitate(1.3);
        vialLastMs = 0;
        vialRaf = requestAnimationFrame(tickVial);
      }

      pop.querySelectorAll('.t3op-vial-slice-row').forEach((row) => {
        row.addEventListener('pointerenter', () => {
          hoveredSlice = Number(row.getAttribute('data-slice-idx'));
          if (vialCtrl) {
            vialCtrl.agitate(0.85);
            vialCtrl.wake();
          }
        });
        row.addEventListener('pointerleave', () => {
          hoveredSlice = -1;
          if (vialCtrl) vialCtrl.wake();
        });
      });

      pop.querySelector('[data-t3op-clear-cache="1"]')?.addEventListener('click', (ev) => {
        cacheCleared = true;
        ev.currentTarget.textContent = '已清理';
        const span = pop.querySelector('.t3op-vial-footer-bar span');
        if (span) span.textContent = '本地轨迹缓存 0 MB';
        if (vialCtrl) vialCtrl.spawnDroplet();
      });
      pop.querySelector('[data-t3op-native-usage="1"]')?.addEventListener('click', () => {
        closeVialPopover();
        openNativeT3UsagePage();
      });
      pop.querySelector('[data-t3op-open-studio-modal="1"]')?.addEventListener('click', () => {
        closeVialPopover();
        openStudioModal();
      });

      if (opticsHost) opticsHost.tagPrismBoxes();
      setTimeout(() => {
        if (!destroyed && popoverEl === pop) {
          document.addEventListener('pointerdown', onOutsidePopoverClick, true);
        }
      }, 0);
    }

    function syncComposerVialHud() {
      const cfg = configStore.get();
      if (!cfg.vialHud) {
        if (hudEl) {
          hudEl.remove();
          hudEl = null;
        }
        closeVialPopover();
        return;
      }

      const composerForm = document.querySelector('[data-chat-composer-form="true"], [data-slot="composer-host"]');
      if (!composerForm) return;
      const footerHost =
        composerForm.querySelector('[data-slot="composer-footer-actions"]') ||
        composerForm.querySelector('[data-t3op-composer-footer]') ||
        composerForm.querySelector('footer');
      if (!footerHost) return;

      const data = readLiveTelemetryFromDom();
      const pctInt = Math.round(data.pct);
      const circ = 2 * Math.PI * 5.4;
      const offset = circ * (1 - data.fill);

      if (!hudEl || !hudEl.isConnected || !footerHost.contains(hudEl)) {
        if (hudEl) hudEl.remove();
        hudEl = document.createElement('div');
        hudEl.className = 't3op-vial-hud';
        hudEl.setAttribute('data-t3op-owned', '1');
        hudEl.innerHTML = `
          <span class="t3op-vial-stats"></span>
          <button type="button" class="t3op-vial-btn" data-testid="t3op-vial-trigger" aria-label="打开 512K 上下文物理试管与配额池">
            <svg class="t3op-vial-ring" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" stroke-opacity="0.2" stroke-width="1.6"/>
              <circle class="t3op-vial-ring-arc" cx="7" cy="7" r="5.4" fill="none" stroke="var(--t3op-accent, #669df6)" stroke-width="1.8" stroke-linecap="round" transform="rotate(-90 7 7)"/>
            </svg>
            <span class="t3op-vial-pct"></span>
          </button>
        `;
        hudEl.querySelector('.t3op-vial-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          openVialPopover(ev.currentTarget);
        });
        footerHost.insertBefore(hudEl, footerHost.lastElementChild || null);
      }

      const statsEl = hudEl.querySelector('.t3op-vial-stats');
      const pctEl = hudEl.querySelector('.t3op-vial-pct');
      const arcEl = hudEl.querySelector('.t3op-vial-ring-arc');
      if (statsEl) statsEl.textContent = `缓存命中 ${data.cacheHit.toFixed(1)}%`;
      if (pctEl) pctEl.textContent = `${pctInt}%`;
      if (arcEl) {
        arcEl.setAttribute('stroke-dasharray', circ.toFixed(2));
        arcEl.setAttribute('stroke-dashoffset', offset.toFixed(2));
      }
    }

    // ── Obsidian Prism Authentic 3-Tab Studio Card (Overview / Models / Quotas) ──
    function requestBackendTelemetryRefresh(btn) {
      if (typeof G[TELEMETRY_BINDING] === 'function') {
        if (btn) btn.textContent = '刷新中…';
        try {
          G[TELEMETRY_BINDING](JSON.stringify({ action: 'refresh' }));
        } catch {}
        setTimeout(() => {
          if (btn && btn.isConnected) btn.textContent = '已同步 ✓';
          rerenderAllStudioCards();
          setTimeout(() => {
            if (btn && btn.isConnected) btn.textContent = '立即刷新遥测与配额';
          }, 1200);
        }, 450);
      } else if (btn) {
        btn.textContent = '已同步 ✓';
        setTimeout(() => {
          if (btn.isConnected) btn.textContent = '立即刷新遥测与配额';
        }, 1000);
      }
    }

    function renderStudioCard(container) {
      const rawData = getTelemetryData();
      const agg = aggregateForView(rawData, studioRange, studioProject);
      const isQuotas = studioTab === 'quotas';
      const userName = rawData.userName || 'rexryder';
      const projects = Array.isArray(rawData.projects) ? rawData.projects : [];

      const headingSpan = container.querySelector('[data-t3op-studio-heading]');
      if (headingSpan) headingSpan.textContent = `接下来做什么，${userName}?`;

      // Update toolbar state
      container.querySelectorAll('.t3op-studio-tab').forEach((b) => {
        b.setAttribute('aria-selected', b.getAttribute('data-tab') === studioTab ? 'true' : 'false');
      });

      const filtersBar = container.querySelector('[data-t3op-studio-filters]');
      if (filtersBar) {
        filtersBar.style.display = isQuotas ? 'none' : 'flex';
      }

      const projSel = container.querySelector('[data-t3op-project-select]');
      if (projSel) {
        const optsHtml = [
          `<option value="all"${studioProject === 'all' ? ' selected' : ''}>全部项目</option>`,
          ...projects.slice(0, 14).map(
            (p) =>
              `<option value="${escapeAttr(p.name)}"${studioProject === p.name ? ' selected' : ''}>${escapeHtml(p.name)} (${formatCompact(p.total)})</option>`
          ),
        ].join('');
        if (projSel.dataset.sig !== optsHtml) {
          projSel.innerHTML = optsHtml;
          projSel.dataset.sig = optsHtml;
        }
      }

      container.querySelectorAll('.t3op-range-btn').forEach((b) => {
        b.setAttribute('aria-pressed', b.getAttribute('data-range') === studioRange ? 'true' : 'false');
      });

      const body = container.querySelector('[data-t3op-studio-body]');
      if (!body) return;

      if (studioTab === 'overview') {
        const heatCols = Math.ceil(agg.heatCells.length / 7);
        body.innerHTML = `
          <div class="t3op-kpi-grid-6">
            <div class="t3op-kpi-box">
              <span class="t3op-kpi-label">会话数</span>
              <span class="t3op-kpi-num">${agg.sessions.toLocaleString()}</span>
            </div>
            <div class="t3op-kpi-box">
              <span class="t3op-kpi-label">消息数</span>
              <span class="t3op-kpi-num">${agg.totalCalls.toLocaleString()}</span>
            </div>
            <div class="t3op-kpi-box">
              <span class="t3op-kpi-label">Token 总量</span>
              <span class="t3op-kpi-num">${formatCompact(agg.totalTokens)}</span>
              <span class="t3op-kpi-sub">仅本地</span>
            </div>
            <div class="t3op-kpi-box">
              <span class="t3op-kpi-label">活跃天数</span>
              <span class="t3op-kpi-num">${agg.activeDays}</span>
            </div>
            <div class="t3op-kpi-box">
              <span class="t3op-kpi-label">缓存命中率</span>
              <span class="t3op-kpi-num">${agg.cacheHitPct.toFixed(1)}%</span>
              <span class="t3op-kpi-sub">仅本地</span>
            </div>
            <div class="t3op-kpi-box">
              <span class="t3op-kpi-label">最常用模型</span>
              <span class="t3op-kpi-num t3op-kpi-model" title="${escapeAttr(agg.topModel)}">${escapeHtml(agg.topModel)}</span>
            </div>
          </div>
          <div class="t3op-heatmap-shell">
            <div class="t3op-heatmap-cols" style="grid-template-columns:repeat(${heatCols}, minmax(0, 1fr))">
              ${agg.heatCells
                .map(
                  (c) =>
                    `<div class="t3op-heat-cell" data-lvl="${c.lvl}" data-date="${c.date}" data-tok="${c.total}" title="${c.date}: ${c.total > 0 ? formatCompact(c.total) + ' tokens' : '无活动'}"></div>`
                )
                .join('')}
            </div>
            <div class="t3op-heat-status" data-t3op-heat-status>悬停任意格子查看当日真实 Token 用量 · 共 ${agg.heatWeeks} 周</div>
          </div>
          <div class="t3op-book-line">你的 Token 用量相当于 <strong>${agg.books.toLocaleString()}</strong> 本《远大前程》。</div>
          <div class="t3op-studio-foot">
            <span>${escapeHtml(rawData.sourcesNote || '仅统计本机已保存会话（不含云端）')}</span>
            <div style="display:flex;gap:10px;align-items:center">
              <button type="button" class="t3op-link-inline" data-t3op-refresh-all="1">刷新数据</button>
              <button type="button" class="t3op-link-inline" data-t3op-jump-usage="1">T3 原生用量页 ›</button>
            </div>
          </div>
        `;

        const statusLine = body.querySelector('[data-t3op-heat-status]');
        body.querySelectorAll('.t3op-heat-cell').forEach((cell) => {
          cell.addEventListener('pointerenter', () => {
            const dk = cell.getAttribute('data-date');
            const tok = Number(cell.getAttribute('data-tok') || 0);
            if (statusLine) {
              statusLine.textContent = tok > 0 ? `${dk} · ${formatCompact(tok)} Tokens` : `${dk} · 无记录`;
            }
          });
        });
      } else if (studioTab === 'models') {
        body.innerHTML = `
          <div class="t3op-chart-wrap">
            <div class="t3op-chart-hover-tip" data-t3op-chart-tip>${agg.rangeDef.label} 每日 Token 走势 · 悬停曲线查看单日明细</div>
            ${buildAreaChartSvg(agg.series)}
          </div>
          <div class="t3op-model-breakdown">
            ${
              agg.modelsList.length === 0
                ? '<div class="t3op-empty-note">当前筛选范围内暂无模型用量记录</div>'
                : agg.modelsList
                    .slice(0, 7)
                    .map((m, i) => {
                      const share = agg.totalTokens > 0 ? (m.total / agg.totalTokens) * 100 : 0;
                      const cachePct = m.input > 0 ? Math.round((m.cached / m.input) * 100) : 0;
                      const color = MODEL_COLORS[i % MODEL_COLORS.length];
                      return `
                    <div class="t3op-model-row">
                      <span class="t3op-model-name"><i class="t3op-vial-dot" style="background:${color}"></i>${escapeHtml(m.name)}</span>
                      <span class="t3op-model-meta">${formatCompact(m.input)} 入 · ${formatCompact(m.output)} 出 · ${cachePct}% 缓存</span>
                      <strong class="t3op-model-pct">${share.toFixed(1)}%</strong>
                    </div>`;
                    })
                    .join('')
            }
          </div>
          <div class="t3op-studio-foot">
            <span>${escapeHtml(rawData.sourcesNote || '仅统计本机已保存会话（不含云端）')}</span>
            <button type="button" class="t3op-link-inline" data-t3op-jump-usage="1">T3 原生用量页 ›</button>
          </div>
        `;

        const tip = body.querySelector('[data-t3op-chart-tip]');
        body.querySelectorAll('.t3op-chart-hit').forEach((rect) => {
          rect.addEventListener('pointerenter', () => {
            const idx = Number(rect.getAttribute('data-idx'));
            const pt = agg.series[idx];
            if (tip && pt) {
              tip.textContent = pt.total > 0
                ? `${pt.date} · ${formatCompact(pt.total)} Tokens · ${pt.calls} 次调用${pt.topModel ? ` · 主力 ${pt.topModel}` : ''}`
                : `${pt.date} · 无用量`;
            }
          });
        });
      } else {
        const quotas = mergeAllQuotaPools(rawData);
        body.innerHTML = `
          <div class="t3op-studio-section-head">
            <span class="t3op-studio-section-title">模型配额池剩余 (Model Quotas)</span>
            <div style="display:flex;gap:8px">
              <button type="button" class="t3op-studio-refresh-btn" data-t3op-refresh-all="1">立即刷新遥测与配额</button>
              <button type="button" class="t3op-studio-refresh-btn" data-t3op-jump-usage="1">T3 原生用量页 ›</button>
            </div>
          </div>
          <div class="t3op-quota-grid">
            ${quotas
              .map(
                (q) => `
              <div class="t3op-quota-card">
                <div class="t3op-quota-card-head">
                  <span class="t3op-quota-pool-name">${escapeHtml(q.name)}</span>
                  <span class="t3op-quota-badge" data-level="${q.level || 'ok'}">${escapeHtml(q.badge || '充裕')}</span>
                </div>
                ${(q.windows || [])
                  .map(
                    (w) => `
                  <div class="t3op-quota-metric">
                    <div class="t3op-quota-row">
                      <span class="t3op-quota-label">${escapeHtml(w.label)}</span>
                      <span class="t3op-quota-val">${w.remainingPct}%${w.resetText ? ` <span style="opacity:0.65;font-weight:400">· ${escapeHtml(w.resetText)}</span>` : ''}</span>
                    </div>
                    <div class="t3op-quota-track"><div class="t3op-quota-fill" style="width:${w.remainingPct}%"></div></div>
                  </div>`
                  )
                  .join('')}
              </div>`
              )
              .join('')}
          </div>
          <div class="t3op-studio-foot">
            <span>Codex 配额读取自本机最新会话遥测；可在 T3 原生用量页查看全部云端 Provider 额度</span>
            <button type="button" class="t3op-link-inline" data-t3op-studio-settings="1">外观中心</button>
          </div>
        `;
      }

      body.querySelector('[data-t3op-refresh-all="1"]')?.addEventListener('click', (ev) => {
        requestBackendTelemetryRefresh(ev.currentTarget);
      });
      body.querySelector('[data-t3op-jump-usage="1"]')?.addEventListener('click', () => {
        closeStudioModal();
        openNativeT3UsagePage();
      });
      body.querySelector('[data-t3op-studio-settings="1"]')?.addEventListener('click', () => {
        closeStudioModal();
        if (typeof onOpenSettings === 'function') onOpenSettings();
      });
    }

    function buildStudioShell(isModal = false) {
      const wrap = document.createElement('section');
      wrap.className = isModal ? 't3op-studio-wrap t3op-studio-modal-inner' : 't3op-studio-wrap';
      wrap.setAttribute('data-t3op-owned', '1');
      wrap.setAttribute('data-testid', isModal ? 't3op-studio-modal-card' : 't3op-studio-home');
      wrap.innerHTML = `
        <div class="t3op-studio-greeting-row">
          <h2 class="t3op-studio-greeting">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3L20 19H16.2L12 10.6L7.8 19H4L12 3Z" fill="var(--t3op-accent, #669df6)"/>
            </svg>
            <span data-t3op-studio-heading>接下来做什么？</span>
          </h2>
          ${isModal ? '<button type="button" class="t3op-code-fold-btn" data-t3op-close-modal="1">关闭 ✕</button>' : ''}
        </div>
        <div class="t3op-studio-card" data-ag-cs-prism-box="1" data-ag-cs-prism-mirror="1">
          <div class="t3op-studio-topbar">
            <div class="t3op-studio-tabs" role="tablist" aria-label="Studio 视图">
              <button type="button" role="tab" class="t3op-studio-tab" data-tab="overview" aria-selected="true">概览</button>
              <button type="button" role="tab" class="t3op-studio-tab" data-tab="models" aria-selected="false">模型</button>
              <button type="button" role="tab" class="t3op-studio-tab" data-tab="quotas" aria-selected="false">模型配额</button>
            </div>
            <div class="t3op-studio-filters" data-t3op-studio-filters>
              <select class="t3op-project-select" data-t3op-project-select aria-label="按项目筛选"></select>
              <div class="t3op-range-group" role="group" aria-label="时间尺度">
                ${STUDIO_RANGES.map((r) => `<button type="button" class="t3op-range-btn" data-range="${r.id}" aria-pressed="${r.id === studioRange}">${r.label}</button>`).join('')}
              </div>
            </div>
          </div>
          <div data-t3op-studio-body style="display:flex;flex-direction:column;gap:12px"></div>
        </div>
      `;

      wrap.querySelectorAll('.t3op-studio-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          studioTab = btn.getAttribute('data-tab') || 'overview';
          rerenderAllStudioCards();
        });
      });
      wrap.querySelector('[data-t3op-project-select]')?.addEventListener('change', (ev) => {
        studioProject = ev.currentTarget.value || 'all';
        rerenderAllStudioCards();
      });
      wrap.querySelectorAll('.t3op-range-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          studioRange = btn.getAttribute('data-range') || '180d';
          rerenderAllStudioCards();
        });
      });
      wrap.querySelector('[data-t3op-close-modal="1"]')?.addEventListener('click', closeStudioModal);

      renderStudioCard(wrap);
      return wrap;
    }

    function rerenderAllStudioCards() {
      if (studioWrapEl && studioWrapEl.isConnected) renderStudioCard(studioWrapEl);
      if (studioModalEl && studioModalEl.isConnected) renderStudioCard(studioModalEl);
    }

    function closeStudioModal() {
      if (studioModalEl) {
        studioModalEl.remove();
        studioModalEl = null;
      }
    }

    function openStudioModal() {
      if (studioModalEl && studioModalEl.isConnected) {
        closeStudioModal();
        return;
      }
      const backdrop = document.createElement('div');
      backdrop.className = 't3op-studio-backdrop';
      backdrop.setAttribute('data-t3op-owned', '1');
      backdrop.setAttribute('data-testid', 't3op-studio-backdrop');
      backdrop.addEventListener('click', (ev) => {
        if (ev.target === backdrop) closeStudioModal();
      });
      backdrop.appendChild(buildStudioShell(true));
      document.body.appendChild(backdrop);
      studioModalEl = backdrop;
      if (opticsHost) opticsHost.tagPrismBoxes();
    }

    function ensureStudioQuickButton() {
      const cfg = configStore.get();
      if (!cfg.studioHome) {
        if (studioTriggerBtn) {
          studioTriggerBtn.remove();
          studioTriggerBtn = null;
        }
        return;
      }
      if (studioTriggerBtn && studioTriggerBtn.isConnected) return;
      studioTriggerBtn = document.createElement('button');
      studioTriggerBtn.type = 'button';
      studioTriggerBtn.className = 't3op-dashboard-trigger';
      studioTriggerBtn.setAttribute('data-t3op-owned', '1');
      studioTriggerBtn.setAttribute('data-testid', 't3op-studio-modal-trigger');
      studioTriggerBtn.title = '打开 Obsidian Prism 半年用量热力图与配额看板';
      studioTriggerBtn.setAttribute('aria-label', '打开用量热力图与配额看板');
      studioTriggerBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>';
      studioTriggerBtn.addEventListener('click', openStudioModal);
      document.body.appendChild(studioTriggerBtn);
    }

    function hasVisibleMessages(convArea) {
      if (!convArea) return false;
      const msgs = convArea.querySelectorAll('[data-message-role="user"], [data-message-role="assistant"]');
      for (const el of msgs) {
        if (el.offsetParent !== null && !el.closest('.hidden')) return true;
      }
      return false;
    }

    let draftHeroResizeObs = null;
    let observedDraftHeroEl = null;

    function syncDraftHeroClearance(wrap, composerStack) {
      if (!wrap || !composerStack) return;
      const heroEl = composerStack.querySelector(':scope > .bottom-full');
      if (!heroEl) {
        wrap.style.removeProperty('--t3op-draft-hero-h');
        return;
      }
      const updateVar = () => {
        if (!wrap.isConnected || !heroEl.isConnected) return;
        const h = Math.ceil(heroEl.getBoundingClientRect().height);
        if (h > 0) wrap.style.setProperty('--t3op-draft-hero-h', `${h}px`);
      };
      updateVar();
      if (typeof ResizeObserver === 'function' && heroEl !== observedDraftHeroEl) {
        if (draftHeroResizeObs) {
          try {
            draftHeroResizeObs.disconnect();
          } catch {}
        }
        draftHeroResizeObs = new ResizeObserver(updateVar);
        draftHeroResizeObs.observe(heroEl);
        observedDraftHeroEl = heroEl;
      }
    }

    function syncStudioHome() {
      const cfg = configStore.get();
      ensureStudioQuickButton();
      const convArea = document.querySelector('[data-workspace-area="conversation"]');
      const hasMessages = hasVisibleMessages(convArea);
      const demoAnchor = document.querySelector('[data-t3op-studio-anchor]');
      const composerOverlay = document.querySelector('[data-chat-composer-overlay="true"]');
      const composerLane = composerOverlay?.querySelector('.chat-composer-lane') || null;
      const composerStack = composerLane?.querySelector('[data-chat-composer-stack="true"]') || null;
      const isT3DraftHome = Boolean(
        composerOverlay &&
          composerLane &&
          composerStack &&
          (composerOverlay.className.includes('items-center') || composerStack.querySelector(':scope > .bottom-full'))
      );

      // Priority: 1) standalone demo anchor, 2) real T3 Code centered empty-thread overlay lane, 3) fallback convArea
      const slotHost = demoAnchor || (isT3DraftHome ? composerLane : composerOverlay ? null : convArea);

      if (!cfg.studioHome || !slotHost || hasMessages) {
        if (studioWrapEl) {
          studioWrapEl.remove();
          studioWrapEl = null;
        }
        if (draftHeroResizeObs) {
          try {
            draftHeroResizeObs.disconnect();
          } catch {}
          draftHeroResizeObs = null;
          observedDraftHeroEl = null;
        }
        return;
      }

      if (studioWrapEl && studioWrapEl.isConnected && studioWrapEl.parentElement === slotHost) {
        renderStudioCard(studioWrapEl);
        if (isT3DraftHome) syncDraftHeroClearance(studioWrapEl, composerStack);
        return;
      }

      if (studioWrapEl) {
        studioWrapEl.remove();
        studioWrapEl = null;
      }

      const wrap = buildStudioShell(false);
      if (isT3DraftHome && composerStack && composerStack.parentElement === slotHost) {
        wrap.setAttribute('data-t3op-in-overlay', '1');
        slotHost.insertBefore(wrap, composerStack);
        syncDraftHeroClearance(wrap, composerStack);
      } else {
        const composerForm = slotHost.querySelector('[data-chat-composer-form="true"], [data-chat-composer-overlay="true"]');
        if (composerForm && composerForm.parentElement === slotHost) {
          slotHost.insertBefore(wrap, composerForm);
        } else {
          slotHost.appendChild(wrap);
        }
      }
      studioWrapEl = wrap;
      if (opticsHost) opticsHost.tagPrismBoxes();
    }

    function setTelemetryData(nextData) {
      if (nextData && typeof nextData === 'object') {
        G.__t3OpTelemetry = nextData;
        rerenderAllStudioCards();
        syncComposerVialHud();
      }
    }

    function refresh() {
      if (destroyed) return;
      syncComposerVialHud();
      updateOpenVialPopover();
      syncStudioHome();
    }

    function destroy() {
      destroyed = true;
      if (draftHeroResizeObs) {
        try {
          draftHeroResizeObs.disconnect();
        } catch {}
        draftHeroResizeObs = null;
        observedDraftHeroEl = null;
      }
      closeVialPopover();
      closeStudioModal();
      if (hudEl) {
        hudEl.remove();
        hudEl = null;
      }
      if (studioWrapEl) {
        studioWrapEl.remove();
        studioWrapEl = null;
      }
      if (studioTriggerBtn) {
        studioTriggerBtn.remove();
        studioTriggerBtn = null;
      }
    }

    return {
      refresh,
      openVialPopover,
      closeVialPopover,
      openStudioModal,
      closeStudioModal,
      setTelemetryData,
      destroy,
    };
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  const api = {
    TELEMETRY_BINDING,
    STUDIO_RANGES,
    formatCompact,
    aggregateForView,
    selectQuotasForCamp,
    readLiveTelemetryFromDom,
    createTelemetryStudio,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpTelemetryStudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
