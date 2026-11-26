'use strict';

/**
 * Real local telemetry & quota aggregator for Obsidian Prism for T3 Code.
 * Zero external dependencies — reads:
 *  1. ~/.t3/userdata/usage-scan-cache-v*.json (Codex, Codex Switcher, T3 history, Claude)
 *  2. ~/.codex/sessions & ~/.codex/archived_sessions (live rate_limits 5h/7d quotas + cwd -> project mapping)
 *  3. ~/.t3/userdata/statev2.sqlite (optional T3 project/thread mapping via sqlite3 CLI)
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function dayKeyLocal(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function findLatestScanCache(t3UserDataDir) {
  try {
    if (!fs.existsSync(t3UserDataDir)) return null;
    const files = fs
      .readdirSync(t3UserDataDir)
      .filter((f) => /^usage-scan-cache(?:-v\d+)?\.json$/.test(f))
      .sort((a, b) => {
        const va = Number((a.match(/-v(\d+)/) || [])[1] || 0);
        const vb = Number((b.match(/-v(\d+)/) || [])[1] || 0);
        return vb - va;
      });
    return files.length > 0 ? path.join(t3UserDataDir, files[0]) : null;
  } catch {
    return null;
  }
}

function readFirstLineMeta(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const chunk = buf.toString('utf8', 0, bytes);
    const nl = chunk.indexOf('\n');
    const firstLine = nl >= 0 ? chunk.slice(0, nl) : chunk;
    if (!firstLine.includes('session_meta')) return null;
    const obj = JSON.parse(firstLine);
    return obj?.payload || null;
  } catch {
    return null;
  }
}

function readTailRateLimitsAndUsage(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const readSize = Math.min(stat.size, 65536);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').filter(Boolean);
    let rateLimits = null;
    let lastUsage = null;
    let totalUsage = null;
    let model = null;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!line.startsWith('{')) continue;
      if (!rateLimits && line.includes('rate_limits')) {
        try {
          const obj = JSON.parse(line);
          const rl = obj?.payload?.rate_limits || obj?.rate_limits;
          if (rl && (rl.primary || rl.secondary)) {
            rateLimits = rl;
          }
          const info = obj?.payload?.info;
          if (info && !lastUsage) {
            lastUsage = info.last_token_usage || null;
            totalUsage = info.total_token_usage || null;
          }
        } catch {}
      }
      if (!model && line.includes('"model"')) {
        try {
          const obj = JSON.parse(line);
          model = obj?.payload?.model || obj?.model || null;
        } catch {}
      }
      if (rateLimits && model) break;
    }
    return { rateLimits, lastUsage, totalUsage, model, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

function projectNameFromCwd(cwd, projectRoots) {
  if (!cwd || typeof cwd !== 'string') return '';
  const norm = cwd.replace(/\/+$/, '');
  for (const proj of projectRoots) {
    if (norm === proj.root || norm.startsWith(`${proj.root}/`)) {
      return proj.title;
    }
  }
  const base = path.basename(norm);
  return base || '';
}

function loadT3Projects(t3UserDataDir) {
  const dbPath = path.join(t3UserDataDir, 'statev2.sqlite');
  if (!fs.existsSync(dbPath)) return [];
  try {
    const out = execFileSync(
      'sqlite3',
      ['-readonly', dbPath, 'SELECT title, workspace_root FROM projection_projects WHERE deleted_at IS NULL;'],
      { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const list = [];
    for (const line of out.split('\n')) {
      const idx = line.indexOf('|');
      if (idx <= 0) continue;
      const title = line.slice(0, idx).trim();
      const root = line.slice(idx + 1).trim().replace(/\/+$/, '');
      if (title && root) list.push({ title, root });
    }
    // Sort longest root first for most specific prefix match
    list.sort((a, b) => b.root.length - a.root.length);
    return list;
  } catch {
    return [];
  }
}

function formatResetCountdown(resetsAtSec, nowMs = Date.now()) {
  if (!Number.isFinite(resetsAtSec) || resetsAtSec <= 0) return '';
  const diffSec = Math.max(0, Math.round(resetsAtSec - nowMs / 1000));
  if (diffSec < 60) return '即将重置';
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${mins}分`;
  return `${mins}分钟`;
}

function windowLabelFromMinutes(mins) {
  if (!Number.isFinite(mins) || mins <= 0) return '配额窗口';
  if (mins >= 9000) return '周配额';
  if (mins >= 1300) return `${Math.round(mins / 1440)}天窗口`;
  if (mins >= 60) return `${Math.round(mins / 60)} 小时窗口`;
  return `${mins} 分钟窗口`;
}

function cleanModelDisplay(raw) {
  const s = String(raw || 'unknown').trim();
  if (!s) return 'unknown';
  return s.replace(/^models\//i, '');
}

function collectLocalTelemetry(opts = {}) {
  const home = opts.homeDir || os.homedir();
  const t3UserDataDir = opts.t3UserDataDir || path.join(home, '.t3', 'userdata');
  const codexDir = opts.codexDir || path.join(home, '.codex');
  const nowMs = opts.nowMs || Date.now();

  const projectRoots = loadT3Projects(t3UserDataDir);
  const sessionProjectMap = new Map();
  const quotaMap = new Map();
  let latestContext = null;

  const days = Object.create(null);
  const seenDedupe = new Set();
  const allSessions = new Set();
  const projectTotals = Object.create(null);
  const providerCounts = Object.create(null);
  let totalRecords = 0;
  let minTs = Infinity;
  let maxTs = 0;

  function ensureDay(dk) {
    if (!days[dk]) {
      days[dk] = {
        calls: 0,
        input: 0,
        cached: 0,
        cacheWrite: 0,
        output: 0,
        reasoning: 0,
        total: 0,
        sessionSet: new Set(),
        models: Object.create(null),
        projects: Object.create(null),
      };
    }
    return days[dk];
  }

  function addRecord({ ts, model, sessionId, provider, project, uncachedIn, cachedIn, cacheWrite, output, reasoning, dedupeKey }) {
    if (!Number.isFinite(ts) || ts <= 0) return;
    if (dedupeKey) {
      if (seenDedupe.has(dedupeKey)) return;
      seenDedupe.add(dedupeKey);
    }
    const uIn = Math.max(0, Number(uncachedIn) || 0);
    const cIn = Math.max(0, Number(cachedIn) || 0);
    const cWr = Math.max(0, Number(cacheWrite) || 0);
    const out = Math.max(0, Number(output) || 0);
    const reas = Math.max(0, Number(reasoning) || 0);
    const total = uIn + cIn + cWr + out + reas;
    if (total <= 0) return;

    totalRecords += 1;
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
    if (sessionId) allSessions.add(sessionId);
    const prov = provider || 'codex';
    providerCounts[prov] = (providerCounts[prov] || 0) + 1;

    const dk = dayKeyLocal(ts);
    const d = ensureDay(dk);
    d.calls += 1;
    d.input += uIn + cIn;
    d.cached += cIn;
    d.cacheWrite += cWr;
    d.output += out;
    d.reasoning += reas;
    d.total += total;
    if (sessionId) d.sessionSet.add(sessionId);

    const mName = cleanModelDisplay(model);
    if (!d.models[mName]) {
      d.models[mName] = { calls: 0, input: 0, cached: 0, output: 0, reasoning: 0, total: 0 };
    }
    const m = d.models[mName];
    m.calls += 1;
    m.input += uIn + cIn;
    m.cached += cIn;
    m.output += out;
    m.reasoning += reas;
    m.total += total;

    const pName = project || (prov === 'claude' ? 'Claude 本地' : 'Codex 默认');
    if (!d.projects[pName]) {
      d.projects[pName] = { calls: 0, input: 0, cached: 0, output: 0, reasoning: 0, total: 0, sessionSet: new Set() };
    }
    const dp = d.projects[pName];
    dp.calls += 1;
    dp.input += uIn + cIn;
    dp.cached += cIn;
    dp.output += out;
    dp.reasoning += reas;
    dp.total += total;
    if (sessionId) dp.sessionSet.add(sessionId);

    if (!projectTotals[pName]) projectTotals[pName] = { total: 0, sessions: new Set() };
    projectTotals[pName].total += total;
    if (sessionId) projectTotals[pName].sessions.add(sessionId);
  }

  // 1. Read T3 Code's pre-indexed scan cache (covers Codex, Codex Switcher, T3 history, Claude!)
  const cachePath = findLatestScanCache(t3UserDataDir);
  let cacheFileCount = 0;
  const recentCodexFiles = [];

  if (cachePath) {
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const modelsTable = Array.isArray(cache.models) ? cache.models : [];
      const sessionsTable = Array.isArray(cache.sessions) ? cache.sessions : [];
      const filesObj = cache.files || {};

      for (const [fp, entry] of Object.entries(filesObj)) {
        if (!entry) continue;
        cacheFileCount += 1;
        const prov = entry.p || 'codex';
        if (prov === 'codex' && entry.m && fp.endsWith('.jsonl') && fs.existsSync(fp)) {
          recentCodexFiles.push({ fp, mtimeMs: Number(entry.m) || 0 });
        }

        // Resolve project from Codex session_meta if file exists locally
        let projForFile = '';
        if (prov === 'codex' && fp.endsWith('.jsonl') && fs.existsSync(fp)) {
          const meta = readFirstLineMeta(fp);
          if (meta?.cwd) {
            projForFile = projectNameFromCwd(meta.cwd, projectRoots);
            if (meta.id && projForFile) sessionProjectMap.set(meta.id, projForFile);
          }
        } else if (prov === 'claude') {
          const m = fp.match(/\.claude\/projects\/([^/]+)/);
          const candidate = m ? m[1].replace(/^-+/, '') : '';
          // Group UUID-like temp/sandbox folders cleanly under 'Claude 本地'
          projForFile = candidate && !/[0-9a-f]{4}-[0-9a-f]{8,}/i.test(candidate)
            ? candidate.split('-').slice(-2).join('-')
            : 'Claude 本地';
        }

        const allRows = [];
        if (Array.isArray(entry.r)) allRows.push(...entry.r);
        if (Array.isArray(entry.t)) allRows.push(...entry.t);

        for (const row of allRows) {
          if (!Array.isArray(row) || row.length < 8) continue;
          const sid = sessionsTable[row[2]] || '';
          const proj = projForFile || sessionProjectMap.get(sid) || (prov === 'claude' ? 'Claude 本地' : 'Codex 历史');
          addRecord({
            ts: row[0],
            model: modelsTable[row[1]] || 'unknown',
            sessionId: sid,
            provider: prov,
            project: proj,
            uncachedIn: row[3],
            cachedIn: row[4],
            cacheWrite: row[5],
            output: row[6],
            reasoning: row[7],
            dedupeKey: typeof row[8] === 'string' && row[8] ? row[8] : null,
          });
        }
      }
    } catch {}
  }

  // 2. Scan latest 6 Codex session JSONLs for live rate_limits (5h / 7d quotas) & latest context window
  recentCodexFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const item of recentCodexFiles.slice(0, 6)) {
    const tail = readTailRateLimitsAndUsage(item.fp);
    if (!tail) continue;
    if (!latestContext && tail.lastUsage) {
      latestContext = {
        model: tail.model || 'gpt-6.2-sol',
        usedTokens: (Number(tail.lastUsage.input_tokens) || 0) + (Number(tail.lastUsage.output_tokens) || 0),
        cachedTokens: Number(tail.lastUsage.cached_input_tokens) || 0,
        totalSessionTokens: Number(tail.totalUsage?.total_tokens) || 0,
        updatedAt: tail.mtimeMs,
      };
    }
    if (tail.rateLimits) {
      const rl = tail.rateLimits;
      const id = rl.limit_id || 'codex';
      if (!quotaMap.has(id)) {
        const windows = [];
        for (const slot of ['primary', 'secondary']) {
          const w = rl[slot];
          if (!w || typeof w.used_percent !== 'number') continue;
          const rem = Math.max(0, Math.min(100, Math.round(100 - w.used_percent)));
          windows.push({
            label: windowLabelFromMinutes(w.window_minutes),
            remainingPct: rem,
            usedPct: Math.round(w.used_percent),
            resetText: formatResetCountdown(w.resets_at, nowMs),
            resetsAt: w.resets_at || null,
          });
        }
        if (windows.length > 0) {
          const minRem = Math.min(...windows.map((w) => w.remainingPct));
          quotaMap.set(id, {
            id,
            name: rl.limit_name || (id === 'codex' ? `Codex / GPT (${rl.plan_type || 'Active'})` : id),
            source: 'codex-local',
            level: minRem <= 15 ? 'low' : minRem <= 35 ? 'warn' : 'ok',
            badge: minRem <= 15 ? '额度偏低' : minRem <= 35 ? '余量偏紧' : '充裕',
            windows,
            updatedAt: tail.mtimeMs,
          });
        }
      }
    }
  }

  // 3. Serialize compact daily object (replace Sets with integer counts)
  const serializedDays = Object.create(null);
  const sortedDayKeys = Object.keys(days).sort();
  for (const dk of sortedDayKeys) {
    const d = days[dk];
    const projs = Object.create(null);
    for (const [pk, pv] of Object.entries(d.projects)) {
      projs[pk] = {
        calls: pv.calls,
        input: pv.input,
        cached: pv.cached,
        output: pv.output,
        reasoning: pv.reasoning,
        total: pv.total,
        sessions: pv.sessionSet.size,
      };
    }
    serializedDays[dk] = {
      calls: d.calls,
      input: d.input,
      cached: d.cached,
      cacheWrite: d.cacheWrite,
      output: d.output,
      reasoning: d.reasoning,
      total: d.total,
      sessions: d.sessionSet.size,
      models: d.models,
      projects: projs,
    };
  }

  const projects = Object.entries(projectTotals)
    .map(([name, info]) => ({ name, total: info.total, sessions: info.sessions.size }))
    .sort((a, b) => b.total - a.total);

  let userName = '';
  try {
    userName = os.userInfo().username || '';
  } catch {}

  return {
    version: 2,
    generatedAt: nowMs,
    userName,
    dateRange: {
      min: Number.isFinite(minTs) ? dayKeyLocal(minTs) : null,
      max: maxTs > 0 ? dayKeyLocal(maxTs) : null,
    },
    totalRecords,
    totalSessions: allSessions.size,
    cacheFileCount,
    providers: providerCounts,
    projects,
    days: serializedDays,
    quotas: Array.from(quotaMap.values()),
    latestContext,
    sourcesNote: cachePath
      ? `本地真实数据 · Codex / T3 Code 缓存 (${totalRecords.toLocaleString()} 条记录)`
      : '仅统计本机已保存会话（不含云端）',
  };
}

if (require.main === module && process.argv.includes('--summary')) {
  const snap = collectLocalTelemetry();
  console.log(
    JSON.stringify(
      {
        userName: snap.userName,
        dateRange: snap.dateRange,
        totalRecords: snap.totalRecords,
        totalSessions: snap.totalSessions,
        dayCount: Object.keys(snap.days).length,
        providers: snap.providers,
        topProjects: snap.projects.slice(0, 8),
        quotas: snap.quotas,
        latestContext: snap.latestContext,
        payloadKB: (Buffer.byteLength(JSON.stringify(snap), 'utf8') / 1024).toFixed(1),
      },
      null,
      2
    )
  );
}

module.exports = {
  collectLocalTelemetry,
  findLatestScanCache,
  dayKeyLocal,
  formatResetCountdown,
};
