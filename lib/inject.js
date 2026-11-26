#!/usr/bin/env node
'use strict';

/**
 * Inject T3 Prism Optics into every open T3 Code window over Chrome DevTools Protocol (CDP).
 *
 *   node lib/inject.js                one-shot: inject and exit
 *   node lib/inject.js --watch        daemon mode: auto-inject new/reloaded windows + live hot-reload
 *   node lib/inject.js --port 9222    connect to explicit CDP port
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT_DIR,
  SRC_DIR,
  CONFIG_FILE,
  PID_FILE,
  SETTING_BINDING,
  TELEMETRY_BINDING,
  discoverCdpPort,
  readConfig,
  patchConfig,
  buildInjectExpression,
  buildConfigRefreshExpression,
  buildTelemetryRefreshExpression,
  isEligibleT3Target,
  listPages,
  CdpSession,
} = require('./cdp');

const WATCH = process.argv.includes('--watch');
const portArgIdx = process.argv.indexOf('--port');
const EXPLICIT_PORT = portArgIdx >= 0 ? process.argv[portArgIdx + 1] : null;
const LOG_FILE = path.join(ROOT_DIR, 'watch.log');

function log(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  if (WATCH) {
    try {
      fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
    } catch {}
  }
}

async function attachAndInject(target, attachedMap) {
  if (attachedMap.has(target.id)) return attachedMap.get(target.id);
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  await session.send('Runtime.enable');
  await session.send('Page.enable');
  await session.send('Runtime.addBinding', { name: SETTING_BINDING });
  await session.send('Runtime.addBinding', { name: TELEMETRY_BINDING });

  const entry = { target, session };
  attachedMap.set(target.id, entry);

  session.on('Runtime.bindingCalled', async (params) => {
    if (!params) return;
    if (params.name === TELEMETRY_BINDING) {
      try {
        const refreshExpr = buildTelemetryRefreshExpression();
        for (const other of attachedMap.values()) {
          if (other.session.closed) continue;
          await other.session
            .send('Runtime.evaluate', { expression: refreshExpr, returnByValue: true })
            .catch(() => null);
        }
        log('[telemetry] refreshed local Codex + T3 Code snapshot');
      } catch (err) {
        log('[telemetry] refresh failed:', err.message);
      }
      return;
    }
    if (params.name !== SETTING_BINDING) return;
    try {
      const patch = JSON.parse(String(params.payload || '{}'));
      const next = patchConfig(patch);
      if (next) {
        const refreshExpr = buildConfigRefreshExpression(next);
        for (const other of attachedMap.values()) {
          if (other.session.closed) continue;
          await other.session
            .send('Runtime.evaluate', { expression: refreshExpr, returnByValue: true })
            .catch(() => null);
        }
        log('[config] persisted & synced:', JSON.stringify(patch));
      }
    } catch (err) {
      log('[config] failed to handle setting update:', err.message);
    }
  });

  session.on('Page.loadEventFired', async () => {
    try {
      const expr = buildInjectExpression();
      const res = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true });
      log('[reload] re-injected:', target.title || target.url, res?.result?.value?.status || 'ok');
    } catch (err) {
      log('[reload] failed:', err.message);
    }
  });

  const expr = buildInjectExpression();
  const res = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  log('[inject]', target.title || target.url, '=>', JSON.stringify(res?.result?.value || {}));
  return entry;
}

async function injectOnce(attachedMap) {
  const discovered = discoverCdpPort(EXPLICIT_PORT);
  if (!discovered) {
    if (!WATCH) {
      console.error(
        'No T3 Code CDP port found (checked DevToolsActivePort).\n' +
          'Launch T3 Code with --remote-debugging-port=0 (see `npm run launch:t3`) or pass --port <PORT>.'
      );
      process.exitCode = 1;
    }
    return 0;
  }

  let pages = [];
  try {
    pages = await listPages(discovered.port);
  } catch (err) {
    if (!WATCH) {
      console.error(`Failed to reach CDP at 127.0.0.1:${discovered.port}: ${err.message}`);
      process.exitCode = 1;
    }
    return 0;
  }

  const eligible = pages.filter(isEligibleT3Target);
  let count = 0;
  for (const page of eligible) {
    try {
      await attachAndInject(page, attachedMap);
      count += 1;
    } catch (err) {
      log('[error] attach failed:', page.title || page.url, err.message);
    }
  }
  return count;
}

async function main() {
  const attached = new Map();
  if (!WATCH) {
    const count = await injectOnce(attached);
    for (const entry of attached.values()) entry.session.close();
    if (count === 0 && !process.exitCode) {
      log('No eligible T3 Code pages found.');
    }
    return;
  }

  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
  const cleanup = () => {
    for (const entry of attached.values()) entry.session.close();
    try {
      if (fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch {}
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  process.on('exit', cleanup);

  log(`T3 Prism Optics watcher started (pid=${process.pid})`);
  await injectOnce(attached);

  // Watch source & config files for instant hot-reload
  let debounce = null;
  const triggerHotReload = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      debounce = null;
      const expr = buildInjectExpression();
      for (const [id, entry] of attached.entries()) {
        if (entry.session.closed) {
          attached.delete(id);
          continue;
        }
        try {
          const res = await entry.session.send('Runtime.evaluate', { expression: expr, returnByValue: true });
          log('[hot-reload]', entry.target.title || entry.target.url, res?.result?.value?.status || 'ok');
        } catch {
          attached.delete(id);
        }
      }
    }, 180);
  };

  try {
    fs.watch(SRC_DIR, { recursive: false }, triggerHotReload);
  } catch {}
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      fs.watch(CONFIG_FILE, triggerHotReload);
    } catch {}
  }

  const pollMs = Math.max(1000, Number(readConfig().pollIntervalMs) || 2500);
  setInterval(async () => {
    for (const [id, entry] of attached.entries()) {
      if (entry.session.closed) attached.delete(id);
    }
    await injectOnce(attached);
  }, pollMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
