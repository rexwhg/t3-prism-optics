#!/usr/bin/env node
'use strict';

/**
 * Cleanly remove T3 Prism Optics from all open T3 Code windows and stop any watcher daemon.
 */

const fs = require('node:fs');
const {
  PID_FILE,
  discoverCdpPort,
  buildRemoveExpression,
  isEligibleT3Target,
  listPages,
  CdpSession,
} = require('./cdp');

const portArgIdx = process.argv.indexOf('--port');
const EXPLICIT_PORT = portArgIdx >= 0 ? process.argv[portArgIdx + 1] : null;

function stopWatcherIfRunning() {
  if (!fs.existsSync(PID_FILE)) return false;
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
    if (Number.isInteger(pid) && pid > 1) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
    fs.unlinkSync(PID_FILE);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const stoppedDaemon = stopWatcherIfRunning();
  if (stoppedDaemon) console.log('Stopped background watcher daemon.');

  const discovered = discoverCdpPort(EXPLICIT_PORT);
  if (!discovered) {
    console.log('No T3 Code CDP port active; nothing to strip from live windows.');
    return;
  }

  const pages = await listPages(discovered.port).catch(() => []);
  const eligible = pages.filter(isEligibleT3Target);
  const expr = buildRemoveExpression();
  let removed = 0;

  for (const page of eligible) {
    const session = new CdpSession(page.webSocketDebuggerUrl);
    try {
      await session.connect();
      const res = await session.send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res?.result?.value?.existed) removed += 1;
      console.log('[remove]', page.title || page.url, JSON.stringify(res?.result?.value || {}));
    } catch (err) {
      console.warn('[remove] skipped:', page.title || page.url, err.message);
    } finally {
      session.close();
    }
  }
  console.log(`Done. Stripped T3 Prism Optics from ${removed} window(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
