#!/usr/bin/env node
'use strict';

/**
 * Portable installer & lifecycle CLI for T3 Prism Optics (t3-prism-optics).
 *
 *   node lib/install.cjs                  Install/update portable plugin in ~/.t3/plugins/t3-prism-optics
 *   node lib/install.cjs --status         Inspect installation & T3 Code CDP status
 *   node lib/install.cjs --uninstall      Remove portable plugin directory cleanly
 *   node lib/install.cjs --launch-t3      Print / launch T3 Code with --remote-debugging-port=0
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { discoverCdpPort, buildBundle } = require('./cdp');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_INSTALL_DIR = path.join(os.homedir(), '.t3', 'plugins', 't3-prism-optics');

const COPY_ITEMS = [
  'package.json',
  'plugin.json',
  'config.example.json',
  'LICENSE',
  'NOTICE',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'README.zh-CN.md',
  'engines',
  'src',
  'lib',
  'demo',
];

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === '.DS_Store' || name === 'node_modules') continue;
      copyRecursive(path.join(src, name), path.join(dst, name));
    }
    return 1;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return 1;
}

function installPlugin(targetDir = DEFAULT_INSTALL_DIR, sourceDir = ROOT_DIR) {
  const resolvedTarget = path.resolve(targetDir);
  const existingConfigPath = path.join(resolvedTarget, 'config.json');
  const preservedConfig = fs.existsSync(existingConfigPath)
    ? fs.readFileSync(existingConfigPath, 'utf8')
    : null;

  fs.mkdirSync(resolvedTarget, { recursive: true });

  let syncedEntries = 0;
  for (const rel of COPY_ITEMS) {
    const src = path.join(sourceDir, rel);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(resolvedTarget, rel));
    syncedEntries += 1;
  }

  // Build clean portable dist bundle (no personal telemetry baked into static file; live CDP injects dynamically)
  const distDir = path.join(resolvedTarget, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const bundle = buildBundle({ rootDir: resolvedTarget, includeLocalTelemetry: false });
  fs.writeFileSync(path.join(distDir, 't3-prism-optics.bundle.js'), bundle.code, 'utf8');

  if (preservedConfig !== null) {
    fs.writeFileSync(existingConfigPath, preservedConfig, 'utf8');
  } else if (fs.existsSync(path.join(resolvedTarget, 'config.example.json'))) {
    fs.copyFileSync(path.join(resolvedTarget, 'config.example.json'), existingConfigPath);
  }

  const meta = {
    sourceRepo: sourceDir,
    installedAt: new Date().toISOString(),
    version: JSON.parse(fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf8')).version,
    bundleHash: bundle.hash,
    bundleBytes: bundle.bytes,
  };
  fs.writeFileSync(path.join(resolvedTarget, 'repo-meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  // Create a convenient macOS launcher shell script inside the plugin folder
  const launchScriptPath = path.join(resolvedTarget, 'launch-t3-with-prism.command');
  const launchScript = `#!/usr/bin/env zsh
set -euo pipefail
APP="/Applications/T3 Code (Beta).app"
if [ ! -d "$APP" ]; then
  APP="/Applications/T3 Code.app"
fi
echo "Launching $APP with --remote-debugging-port=0 ..."
open -na "$APP" --args --remote-debugging-port=0
sleep 2
node "${path.join(resolvedTarget, 'lib', 'inject.js')}" --watch
`;
  fs.writeFileSync(launchScriptPath, launchScript, { mode: 0o755 });

  return { targetDir: resolvedTarget, syncedEntries, meta, launchScriptPath };
}

function uninstallPlugin(targetDir = DEFAULT_INSTALL_DIR) {
  const resolvedTarget = path.resolve(targetDir);
  if (!fs.existsSync(resolvedTarget)) {
    return { existed: false, targetDir: resolvedTarget };
  }
  const pidFile = path.join(resolvedTarget, '.watch.pid');
  if (fs.existsSync(pidFile)) {
    try {
      const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
      if (Number.isInteger(pid) && pid > 1) process.kill(pid, 'SIGTERM');
    } catch {}
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
  return { existed: true, targetDir: resolvedTarget };
}

function getStatus(targetDir = DEFAULT_INSTALL_DIR) {
  const resolvedTarget = path.resolve(targetDir);
  const installed = fs.existsSync(path.join(resolvedTarget, 'plugin.json'));
  const metaPath = path.join(resolvedTarget, 'repo-meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
  const cdp = discoverCdpPort();
  return { installed, targetDir: resolvedTarget, meta, cdp };
}

function findT3AppBinary() {
  const candidates = [
    '/Applications/T3 Code (Beta).app/Contents/MacOS/T3 Code (Beta)',
    '/Applications/T3 Code.app/Contents/MacOS/T3 Code',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetArgIdx = args.indexOf('--target');
  const targetDir = targetArgIdx >= 0 ? args[targetArgIdx + 1] : DEFAULT_INSTALL_DIR;

  if (args.includes('--status')) {
    console.log(JSON.stringify(getStatus(targetDir), null, 2));
  } else if (args.includes('--uninstall')) {
    const res = uninstallPlugin(targetDir);
    console.log(res.existed ? `Removed ${res.targetDir}` : `Not installed at ${res.targetDir}`);
  } else if (args.includes('--launch-t3')) {
    const bin = findT3AppBinary();
    if (!bin) {
      console.error('Could not locate T3 Code.app in /Applications.');
      process.exit(1);
    }
    if (args.includes('--spawn')) {
      const child = spawn(bin, ['--remote-debugging-port=0'], { detached: true, stdio: 'ignore' });
      child.unref();
      console.log(`Spawned T3 Code with CDP enabled (pid=${child.pid}). Run \`npm run watch\` to attach.`);
    } else {
      console.log(
        'To enable live CDP injection into T3 Code Desktop without modifying the app bundle:\n' +
          '  1. Quit T3 Code completely (Cmd+Q)\n' +
          `  2. Relaunch with: open -a "${path.dirname(path.dirname(path.dirname(bin)))}" --args --remote-debugging-port=0\n` +
          '  3. Start watcher: npm run watch\n' +
          'Or double-click ~/.t3/plugins/t3-prism-optics/launch-t3-with-prism.command'
      );
    }
  } else {
    const res = installPlugin(targetDir);
    console.log(`Installed T3 Prism Optics to ${res.targetDir}`);
    console.log(`  Bundle: ${(res.meta.bundleBytes / 1024).toFixed(1)} KB (hash=${res.meta.bundleHash})`);
    console.log(`  Launcher: ${res.launchScriptPath}`);
  }
}

module.exports = {
  DEFAULT_INSTALL_DIR,
  installPlugin,
  uninstallPlugin,
  getStatus,
  findT3AppBinary,
};
