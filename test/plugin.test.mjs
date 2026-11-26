import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cdp = require('../lib/cdp.js');
const installer = require('../lib/install.cjs');
const telemetry = require('../lib/telemetry.js');
const configMod = require('../src/t3-config.js');
const modelControls = require('../src/t3-model-controls.js');
const studioMod = require('../src/t3-telemetry-studio.js');
const commandI18n = require('../src/t3-command-i18n.js');

test('config normalization & validation reject unknown/invalid entries', () => {
  const cfg = configMod.normalizeConfig({
    palette: 'warm',
    lightPreset: 'alabaster',
    accentTone: 'iris',
    cornerStyle: 'soft',
    ambientIntensity: 70,
    mascot: 'quad-minis',
    invalidKey: 'should-drop',
    motionLevel: 'bogus',
  });
  assert.equal(cfg.palette, 'warm');
  assert.equal(cfg.lightPreset, 'alabaster');
  assert.equal(cfg.accentTone, 'iris');
  assert.equal(cfg.cornerStyle, 'soft');
  assert.equal(cfg.ambientIntensity, '70');
  assert.equal(cfg.mascot, 'quad-minis');
  assert.equal(cfg.motionLevel, 'ultra'); // fell back to default
  assert.equal('invalidKey' in cfg, false);
});

test('periodic-table model keycap resolution covers Gemini, Claude, Codex, and fallback', () => {
  const ne = modelControls.resolvePeriodicBadge('Gemini 4 Neon');
  assert.equal(ne.num, '10');
  assert.equal(ne.sym, 'Ne');
  assert.equal(ne.brand, 'gemini');

  const au = modelControls.resolvePeriodicBadge('Claude Opus 4.6');
  assert.equal(au.num, '79');
  assert.equal(au.sym, 'Au');
  assert.equal(au.brand, 'claude');

  const si = modelControls.resolvePeriodicBadge('GPT-5.4 Codex');
  assert.equal(si.num, '14');
  assert.equal(si.sym, 'Si');
  assert.equal(si.brand, 'openai');

  const fb = modelControls.resolvePeriodicBadge('CustomModelX');
  assert.equal(fb.num, '42');
  assert.equal(fb.sym, 'Cu');
});

test('single-file CDP bundle compiles cleanly, is deterministic, and parses as valid JS', () => {
  const b1 = cdp.buildBundle({ includeLocalTelemetry: false });
  const b2 = cdp.buildBundle({ includeLocalTelemetry: false });
  assert.equal(b1.hash, b2.hash);
  assert.equal(b1.telemetry, null);
  assert.ok(b1.bytes > 400_000, `expected full optical bundle > 400KB, got ${b1.bytes}`);
  assert.match(b1.code, /mountPhysicalWaterVial/);
  assert.match(b1.code, /mountCrystalPrismBar/);
  assert.match(b1.code, /mountDualMascotStage/);
  assert.match(b1.code, /createPrismRimCanvasController/);
  assert.match(b1.code, /t3opCesSweep/);
  assert.match(b1.code, /t3-stream-f0/);
  assert.match(b1.code, /__t3OpCommandI18n/);
  assert.match(b1.code, /--t3op-draft-hero-h/);
  assert.match(b1.code, /RMvdesi\/obsidian-prism/);
  // Parse syntax without executing
  assert.doesNotThrow(() => new Function(b1.code));
});

test('slash command & skill Chinese localization preserves original tokens and skips Chinese or non-command items', () => {
  // Antigravity & Codex slash commands
  assert.match(
    commandI18n.translateCommandDescription({
      itemId: 'provider-slash-command:antigravity:goal',
      label: '/goal',
      description: 'Run until the specified goal is completely finished.',
    }),
    /持续执行任务/
  );
  assert.match(
    commandI18n.translateCommandDescription({
      itemId: 'provider-slash-command:antigravity:boost',
      label: '/boost',
      description: 'Invoke the Boost multi-agent orchestrator for complex tasks.',
    }),
    /Boost/
  );
  assert.match(
    commandI18n.translateCommandDescription({
      itemId: 'provider-slash-command:antigravity:agy-customizations',
      label: '/agy-customizations',
      description: 'Comprehensive guide and reference for the Antigravity Customization System.',
    }),
    /Antigravity 自定义系统/
  );
  // Skills (slash & $)
  assert.match(
    commandI18n.translateCommandDescription({
      itemId: 'skill:codex:openai-templates:artifact-template-system-design',
      label: 'openai-templates:artifact-template-system-design',
      description: 'Create documents with the System Design template',
    }),
    /System Design.*模板创建文档/
  );
  // Already Chinese descriptions stay untouched
  assert.equal(
    commandI18n.translateCommandDescription({
      itemId: 'slash:model',
      label: '/model',
      description: '切换这个会话使用的回复模型',
    }),
    null
  );
  // Only slash / provider-slash-command / skill itemIds are translated
  assert.equal(commandI18n.isTranslatableItemId('provider-slash-command:antigravity:plan'), true);
  assert.equal(commandI18n.isTranslatableItemId('skill:codex:create-skill'), true);
  assert.equal(commandI18n.isTranslatableItemId('path:file:src/index.ts'), false);
  assert.equal(commandI18n.isTranslatableItemId('model:antigravity:gemini-4-neon'), false);
});

test('effort level translation & 5-scale Studio telemetry aggregation work across 7d/30d/90d/180d/all', () => {
  assert.equal(modelControls.translateEffortShort('Extra High').zh, '超高');
  assert.equal(modelControls.translateEffortShort('Ultra').zh, '极致');
  assert.equal(modelControls.translateEffortShort('Auto').isAuto, true);

  const mockRaw = {
    totalSessions: 42,
    days: {
      '2026-06-15': { calls: 10, input: 1000000, cached: 800000, output: 50000, total: 1050000, sessions: 3, models: { 'gpt-6.2-sol': { input: 1000000, cached: 800000, output: 50000, total: 1050000, calls: 10 } }, projects: { 'Codex 历史': { calls: 10, input: 1000000, cached: 800000, output: 50000, total: 1050000, sessions: 3 } } },
      '2026-11-25': { calls: 20, input: 2000000, cached: 1800000, output: 100000, total: 2100000, sessions: 5, models: { 'gpt-6.2-sol': { input: 2000000, cached: 1800000, output: 100000, total: 2100000, calls: 20 } }, projects: { 'Codex 历史': { calls: 20, input: 2000000, cached: 1800000, output: 100000, total: 2100000, sessions: 5 } } },
    },
  };
  const agg7 = studioMod.aggregateForView(mockRaw, '7d', 'all');
  const agg180 = studioMod.aggregateForView(mockRaw, '180d', 'all');
  assert.equal(agg7.totalTokens, 2100000);
  assert.equal(agg180.totalTokens, 3150000);
  assert.equal(agg180.activeDays, 2);
  assert.equal(agg180.topModel, 'gpt-6.2-sol');
  assert.equal(studioMod.STUDIO_RANGES.map((r) => r.id).join(','), '7d,30d,90d,180d,all');
  assert.equal(typeof telemetry.collectLocalTelemetry, 'function');

  // Verify model-camp quota filtering selects matching provider pool
  const samplePools = [
    { id: 'antigravity-gemini', name: 'Gemini (Antigravity)', camp: 'gemini', windows: [{ label: '5 小时窗口', remainingPct: 77 }] },
    { id: 'antigravity-3p', name: 'Claude / GPT (Antigravity)', camp: 'claude', windows: [{ label: '5 小时窗口', remainingPct: 100 }] },
    { id: 't3-codex', name: 'Codex / GPT', camp: 'codex', windows: [{ label: '周配额', remainingPct: 60 }] },
  ];
  assert.equal(studioMod.selectQuotasForCamp(samplePools, 'gemini')[0].id, 'antigravity-gemini');
  assert.equal(studioMod.selectQuotasForCamp(samplePools, 'codex')[0].id, 't3-codex');
  assert.equal(studioMod.selectQuotasForCamp(samplePools, 'claude')[0].id, 'antigravity-3p');
});

test('CDP inject, refresh, and remove expressions parse cleanly', () => {
  const inj = cdp.buildInjectExpression();
  const ref = cdp.buildConfigRefreshExpression({ palette: 'warm' });
  const rem = cdp.buildRemoveExpression();
  assert.doesNotThrow(() => new Function(`return ${inj}`));
  assert.doesNotThrow(() => new Function(`return ${ref}`));
  assert.doesNotThrow(() => new Function(`return ${rem}`));
});

test('CDP target filter accepts T3 Code pages and excludes devtools/extensions', () => {
  assert.equal(
    cdp.isEligibleT3Target({ type: 'page', url: 't3code://app/', title: 'T3 Code', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/page/1' }),
    true
  );
  assert.equal(
    cdp.isEligibleT3Target({ type: 'page', url: 'http://127.0.0.1:5173/', title: 'T3 Code', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/page/2' }),
    true
  );
  assert.equal(
    cdp.isEligibleT3Target({ type: 'page', url: 'devtools://devtools/bundled/inspector.html', title: 'DevTools', webSocketDebuggerUrl: 'ws://x' }),
    false
  );
  assert.equal(
    cdp.isEligibleT3Target({ type: 'background_page', url: 't3code://app/', webSocketDebuggerUrl: 'ws://x' }),
    false
  );
});

test('portable installer installs, preserves user config on upgrade, reports status, and uninstalls cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't3-op-install-test-'));
  const targetDir = path.join(tmpDir, 't3-prism-optics');
  try {
    const res1 = installer.installPlugin(targetDir);
    assert.equal(fs.existsSync(path.join(targetDir, 'plugin.json')), true);
    assert.equal(fs.existsSync(path.join(targetDir, 'dist', 't3-prism-optics.bundle.js')), true);
    assert.equal(fs.existsSync(path.join(targetDir, 'config.json')), true);
    assert.equal(fs.existsSync(res1.launchScriptPath), true);

    // Customize user config and re-install to verify config preservation
    const customCfg = { palette: 'warm', mascot: 'quad' };
    fs.writeFileSync(path.join(targetDir, 'config.json'), JSON.stringify(customCfg), 'utf8');
    installer.installPlugin(targetDir);
    const afterUpgrade = JSON.parse(fs.readFileSync(path.join(targetDir, 'config.json'), 'utf8'));
    assert.equal(afterUpgrade.palette, 'warm');
    assert.equal(afterUpgrade.mascot, 'quad');

    const status = installer.getStatus(targetDir);
    assert.equal(status.installed, true);
    assert.equal(status.meta.version, '1.1.3');

    const un = installer.uninstallPlugin(targetDir);
    assert.equal(un.existed, true);
    assert.equal(fs.existsSync(targetDir), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('macOS autostart builder generates valid LaunchAgent plist and native .app launcher bundle', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't3-op-autostart-test-'));
  const targetDir = path.join(tmpDir, 'plugin');
  const plistPath = path.join(tmpDir, 'com.rexwhg.t3-prism-optics.watch.plist');
  const appPath = path.join(tmpDir, 'T3 Code Prism.app');
  try {
    const res = installer.installAutostart({
      targetDir,
      launchAgentPath: plistPath,
      launcherAppPath: appPath,
      pinDock: false,
      registerSystem: false,
    });
    assert.equal(fs.existsSync(plistPath), true);
    const plistText = fs.readFileSync(plistPath, 'utf8');
    assert.match(plistText, /com\.rexwhg\.t3-prism-optics\.watch/);
    assert.match(plistText, /<key>RunAtLoad<\/key>/);
    assert.match(plistText, /--watch/);
    assert.equal(fs.existsSync(path.join(appPath, 'Contents', 'Info.plist')), true);
    assert.equal(fs.existsSync(res.launcher.launcherBinPath), true);
    const launcherSrc = fs.readFileSync(res.launcher.launcherBinPath, 'utf8');
    assert.match(launcherSrc, /--remote-debugging-port=0/);

    const clean = installer.uninstallAutostart({
      launchAgentPath: plistPath,
      launcherAppPath: appPath,
      registerSystem: false,
    });
    assert.equal(clean.removedAgent, true);
    assert.equal(clean.removedApp, true);
    assert.equal(fs.existsSync(plistPath), false);
    assert.equal(fs.existsSync(appPath), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
