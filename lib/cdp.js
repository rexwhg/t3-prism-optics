'use strict';

/**
 * Zero-dependency Chrome DevTools Protocol (CDP) client & single-file bundle compiler
 * for T3 Prism Optics (t3-prism-optics).
 * Requires Node >= 22 (built-in fetch & WebSocket).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENGINES_DIR = path.join(ROOT_DIR, 'engines');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
const EXAMPLE_CONFIG_FILE = path.join(ROOT_DIR, 'config.example.json');
const PID_FILE = path.join(ROOT_DIR, '.watch.pid');
const SETTING_BINDING = '__t3OpSetting';
const TELEMETRY_BINDING = '__t3OpTelemetryCall';

const configApi = require(path.join(SRC_DIR, 't3-config.js'));
const telemetryApi = require(path.join(__dirname, 'telemetry.js'));

const ENGINE_FILES = [
  'motion-engine.js',
  'animated-icons.js',
  'ripple-core.js',
  'prism-rim-canvas.js',
  'crystal-prism-core.js',
  'vial-core.js',
  'dual-mascot-rig.js',
  'smooth-caret.js',
];

const SRC_FILES = [
  't3-config.js',
  't3-stream-ink.js',
  't3-optics-host.js',
  't3-model-controls.js',
  't3-telemetry-studio.js',
  't3-command-i18n.js',
  't3-workbench-settings.js',
  't3-runtime.js',
];

function getAppDataDir() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

function getCandidatePortFiles() {
  const appData = getAppDataDir();
  const dirs = ['t3code-v2', 't3code', 'T3 Code (Beta)', 'T3 Code'];
  return dirs.map((d) => path.join(appData, d, 'DevToolsActivePort'));
}

function readPortFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
    const port = Number(lines[0]);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { port, wsPath: lines[1] || '', source: filePath };
  } catch {
    return null;
  }
}

function discoverCdpPort(explicitPort = null) {
  const envPort = explicitPort || process.env.T3_PRISM_CDP_PORT;
  if (envPort) {
    const p = Number(envPort);
    if (Number.isInteger(p) && p > 0 && p <= 65535) {
      return { port: p, wsPath: '', source: 'explicit' };
    }
  }
  for (const candidate of getCandidatePortFiles()) {
    const found = readPortFile(candidate);
    if (found) return found;
  }
  return null;
}

function readConfig(configPath = CONFIG_FILE) {
  let raw = {};
  try {
    if (fs.existsSync(configPath)) {
      raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else if (fs.existsSync(EXAMPLE_CONFIG_FILE)) {
      raw = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return configApi.normalizeConfig(raw);
}

function writeConfig(nextConfig, configPath = CONFIG_FILE) {
  const normalized = configApi.normalizeConfig(nextConfig);
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function patchConfig(patchObj, configPath = CONFIG_FILE) {
  if (!patchObj || typeof patchObj !== 'object' || Array.isArray(patchObj)) return null;
  const current = readConfig(configPath);
  let changed = false;
  const next = { ...current };
  for (const [k, rawV] of Object.entries(patchObj)) {
    const v = k === 'ambientIntensity' && typeof rawV === 'number' ? String(rawV) : rawV;
    if (configApi.validateEntry(k, v) && next[k] !== v) {
      next[k] = k === 'pollIntervalMs' ? Number(v) : v;
      changed = true;
    }
  }
  if (!changed) return current;
  return writeConfig(next, configPath);
}

function serializeJsonSafe(val) {
  return JSON.stringify(val === undefined ? null : val).replace(/[<>/\u2028\u2029]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

function buildBundle({ config = null, telemetry = undefined, includeLocalTelemetry = true, rootDir = ROOT_DIR } = {}) {
  const enginesDir = path.join(rootDir, 'engines');
  const srcDir = path.join(rootDir, 'src');
  const cfg = config ? configApi.normalizeConfig(config) : readConfig(path.join(rootDir, 'config.json'));
  const cssText = fs.readFileSync(path.join(srcDir, 't3-style.css'), 'utf8');
  let telSnap = telemetry;
  if (telSnap === undefined && includeLocalTelemetry) {
    try {
      telSnap = telemetryApi.collectLocalTelemetry();
    } catch {
      telSnap = null;
    }
  }

  const chunks = [];
  for (const f of ENGINE_FILES) {
    const content = fs.readFileSync(path.join(enginesDir, f), 'utf8');
    chunks.push(`/* ── engine: ${f} ── */\n${content}`);
  }
  for (const f of SRC_FILES) {
    const content = fs.readFileSync(path.join(srcDir, f), 'utf8');
    chunks.push(`/* ── module: ${f} ── */\n${content}`);
  }

  const hash = crypto
    .createHash('sha256')
    .update('t3op-v2:')
    .update(cssText)
    .update(chunks.join('\n'))
    .update(JSON.stringify(cfg))
    .digest('hex')
    .slice(0, 16);

  const code = [
    '(function(){',
    '  "use strict";',
    '  var module = undefined;',
    '  var exports = undefined;',
    chunks.join('\n;\n'),
    '  if (typeof globalThis !== "undefined" && globalThis.__t3OpRuntime) {',
    `    globalThis.__t3OpRuntime.mountT3ObsidianPrism({ cssText: ${serializeJsonSafe(cssText)}, config: ${serializeJsonSafe(cfg)}, telemetry: ${serializeJsonSafe(telSnap || null)}, hash: ${serializeJsonSafe(hash)} });`,
    '  }',
    '})();',
  ].join('\n');

  return { code, hash, config: cfg, telemetry: telSnap || null, bytes: Buffer.byteLength(code, 'utf8') };
}

function buildTelemetryRefreshExpression(telemetrySnap) {
  const snap = telemetrySnap || telemetryApi.collectLocalTelemetry();
  return `(() => {
    if (!window.__t3ObsidianPrism?.updateTelemetry) return { ok: false };
    window.__t3ObsidianPrism.updateTelemetry(${serializeJsonSafe(snap)});
    return { ok: true, records: ${Number(snap?.totalRecords) || 0} };
  })()`;
}

function buildInjectExpression(opts = {}) {
  const { code, hash, telemetry } = buildBundle(opts);
  return `(() => {
    if (window.__t3ObsidianPrism && window.__t3ObsidianPrism.hash === ${serializeJsonSafe(hash)}) {
      ${telemetry ? `if (window.__t3ObsidianPrism.updateTelemetry) window.__t3ObsidianPrism.updateTelemetry(${serializeJsonSafe(telemetry)});` : ''}
      return { ok: true, status: 'unchanged', hash: ${serializeJsonSafe(hash)}, telemetryRecords: window.__t3OpTelemetry?.totalRecords || 0 };
    }
    ${code}
    return { ok: true, status: 'injected', hash: ${serializeJsonSafe(hash)}, version: window.__t3ObsidianPrism?.version || '1.0.0', telemetryRecords: window.__t3OpTelemetry?.totalRecords || 0 };
  })()`;
}

function buildConfigRefreshExpression(config) {
  const cfg = configApi.normalizeConfig(config || readConfig());
  return `(() => {
    if (!window.__t3ObsidianPrism) return { ok: false, status: 'not-mounted' };
    window.__t3ObsidianPrism.reconfigure(${serializeJsonSafe(cfg)}, { silentPersist: true });
    return { ok: true, status: 'reconfigured' };
  })()`;
}

function buildRemoveExpression() {
  return `(() => {
    const existed = Boolean(window.__t3ObsidianPrism);
    try { window.__t3ObsidianPrism?.destroy?.(); } catch {}
    try { document.getElementById('t3-obsidian-prism-css')?.remove(); } catch {}
    try { document.querySelectorAll('[data-t3op-owned="1"], .ag-cs-prism-rim-cv, .ag-cs-smooth-caret').forEach((n) => n.remove()); } catch {}
    return { ok: true, existed };
  })()`;
}

function isEligibleT3Target(target) {
  if (!target || target.type !== 'page' || !target.webSocketDebuggerUrl) return false;
  const url = String(target.url || '');
  if (url.startsWith('devtools://') || url.startsWith('chrome-extension://')) return false;
  return (
    url.startsWith('t3code://') ||
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('http://localhost') ||
    url.includes('t3') ||
    String(target.title || '').toLowerCase().includes('t3')
  );
}

async function listPages(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`CDP HTTP ${res.status}`);
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
    this.eventHandlers = new Map();
    this.closed = false;
  }

  connect(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      if (typeof WebSocket !== 'function') {
        reject(new Error('Node >= 22 global WebSocket is required'));
        return;
      }
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        reject(new Error('CDP WebSocket connect timeout'));
      }, timeoutMs);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve(this);
      });
      ws.addEventListener('error', (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('CDP WebSocket error'));
      });
      ws.addEventListener('close', () => {
        this.closed = true;
        for (const [, p] of this.pending) p.reject(new Error('CDP session closed'));
        this.pending.clear();
      });
      ws.addEventListener('message', (ev) => {
        let msg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.id && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else entry.resolve(msg.result);
        } else if (msg.method) {
          const set = this.eventHandlers.get(msg.method);
          if (set) {
            for (const fn of set) {
              try {
                fn(msg.params);
              } catch {}
            }
          }
        }
      });
    });
  }

  on(method, fn) {
    if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, new Set());
    this.eventHandlers.get(method).add(fn);
    return () => this.eventHandlers.get(method)?.delete(fn);
  }

  send(method, params = {}, timeoutMs = 12000) {
    if (this.closed || !this.ws) return Promise.reject(new Error('CDP session not connected'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout on ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.closed = true;
    try {
      this.ws?.close();
    } catch {}
  }
}

if (require.main === module && process.argv.includes('--build-bundle')) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
  const bundle = buildBundle({ includeLocalTelemetry: false });
  const outPath = path.join(DIST_DIR, 't3-prism-optics.bundle.js');
  fs.writeFileSync(outPath, bundle.code, 'utf8');
  console.log(`Built ${outPath} (${(bundle.bytes / 1024).toFixed(1)} KB, hash=${bundle.hash}, portable-clean)`);
}

module.exports = {
  ROOT_DIR,
  ENGINES_DIR,
  SRC_DIR,
  DIST_DIR,
  CONFIG_FILE,
  PID_FILE,
  SETTING_BINDING,
  TELEMETRY_BINDING,
  ENGINE_FILES,
  SRC_FILES,
  getCandidatePortFiles,
  discoverCdpPort,
  readConfig,
  writeConfig,
  patchConfig,
  buildBundle,
  buildInjectExpression,
  buildConfigRefreshExpression,
  buildTelemetryRefreshExpression,
  buildRemoveExpression,
  isEligibleT3Target,
  listPages,
  CdpSession,
};
