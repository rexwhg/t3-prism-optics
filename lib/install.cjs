#!/usr/bin/env node
'use strict';

/**
 * Portable installer, macOS LaunchAgent & Dock Launcher CLI for T3 Prism Optics (t3-prism-optics).
 *
 *   node lib/install.cjs                        Install/update portable plugin in ~/.t3/plugins/t3-prism-optics
 *   node lib/install.cjs --autostart            Install plugin + macOS LaunchAgent watcher + ~/Applications/T3 Code Prism.app
 *   node lib/install.cjs --autostart --pin-dock Also pin "T3 Code Prism.app" to the macOS Dock for 1-click launch
 *   node lib/install.cjs --uninstall-autostart  Remove LaunchAgent, Launcher .app, and Dock pin
 *   node lib/install.cjs --status               Inspect installation, autostart & T3 Code CDP status
 *   node lib/install.cjs --uninstall            Remove autostart & portable plugin directory cleanly
 *   node lib/install.cjs --launch-t3            Print / launch T3 Code with --remote-debugging-port=0
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { discoverCdpPort, buildBundle } = require('./cdp');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_INSTALL_DIR = path.join(os.homedir(), '.t3', 'plugins', 't3-prism-optics');
const LAUNCH_AGENT_LABEL = 'com.rexwhg.t3-prism-optics.watch';
const DEFAULT_LAUNCH_AGENT_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`);
const DEFAULT_LAUNCHER_APP_PATH = path.join(os.homedir(), 'Applications', 'T3 Code Prism.app');

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

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function findT3AppBundle() {
  const candidates = ['/Applications/T3 Code (Beta).app', '/Applications/T3 Code.app'];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function findT3AppBinary() {
  const candidates = [
    '/Applications/T3 Code (Beta).app/Contents/MacOS/T3 Code (Beta)',
    '/Applications/T3 Code.app/Contents/MacOS/T3 Code',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function buildLaunchAgentPlist({
  label = LAUNCH_AGENT_LABEL,
  nodePath = process.execPath,
  injectScriptPath,
  logPath,
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodePath)}</string>
    <string>${xmlEscape(injectScriptPath)}</string>
    <string>--watch</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`;
}

function buildLauncherApp({
  appPath = DEFAULT_LAUNCHER_APP_PATH,
  pluginDir = DEFAULT_INSTALL_DIR,
  nodePath = process.execPath,
  label = LAUNCH_AGENT_LABEL,
  sourceAppBundle = findT3AppBundle(),
} = {}) {
  const resolvedApp = path.resolve(appPath);
  const contentsDir = path.join(resolvedApp, 'Contents');
  const macOsDir = path.join(contentsDir, 'MacOS');
  const resDir = path.join(contentsDir, 'Resources');

  fs.mkdirSync(macOsDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });

  // Copy official T3 Code app icon if present so the Dock icon looks completely native
  let hasIcon = false;
  if (sourceAppBundle) {
    const iconCandidates = [
      path.join(sourceAppBundle, 'Contents', 'Resources', 'icon.icns'),
      path.join(sourceAppBundle, 'Contents', 'Resources', 'AppIcon.icns'),
      path.join(sourceAppBundle, 'Contents', 'Resources', 'electron.icns'),
    ];
    const foundIcon = iconCandidates.find((p) => fs.existsSync(p));
    if (foundIcon) {
      fs.copyFileSync(foundIcon, path.join(resDir, 'icon.icns'));
      hasIcon = true;
    }
  }

  const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>T3 Code Prism</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.rexwhg.t3-prism-optics.launcher</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>T3 Code Prism</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.1.0</string>
  <key>CFBundleVersion</key>
  <string>1.1.0</string>
  ${hasIcon ? '<key>CFBundleIconFile</key>\n  <string>icon</string>' : ''}
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist, 'utf8');

  const injectScript = path.join(pluginDir, 'lib', 'inject.js');
  const launcherScript = `#!/bin/zsh
set -euo pipefail

APP="/Applications/T3 Code (Beta).app"
if [ ! -d "$APP" ]; then
  APP="/Applications/T3 Code.app"
fi
if [ ! -d "$APP" ]; then
  osascript -e 'display notification "Could not find T3 Code in /Applications" with title "T3 Prism Optics"' >/dev/null 2>&1 || true
  exit 1
fi

# 1. Ensure background watcher LaunchAgent is active
UID_NUM="$(id -u)"
launchctl kickstart "gui/\${UID_NUM}/${label}" >/dev/null 2>&1 || true

# 2. Check if T3 Code is already running and whether its local CDP port is live
CDP_ALIVE=0
for port_file in \\
  "$HOME/Library/Application Support/t3code-v2/DevToolsActivePort" \\
  "$HOME/Library/Application Support/t3code/DevToolsActivePort"; do
  if [ -f "$port_file" ]; then
    port="$(head -n 1 "$port_file" 2>/dev/null || true)"
    if [ -n "$port" ] && curl -sf --max-time 0.6 "http://127.0.0.1:\${port}/json/version" >/dev/null 2>&1; then
      CDP_ALIVE=1
      break
    fi
  fi
done

RUNNING=0
if pgrep -x "T3 Code (Beta)" >/dev/null 2>&1 || pgrep -x "T3 Code" >/dev/null 2>&1; then
  RUNNING=1
fi

if [ "$RUNNING" -eq 1 ]; then
  if [ "$CDP_ALIVE" -eq 1 ]; then
    open -a "$APP"
    "${nodePath}" "${injectScript}" >/dev/null 2>&1 &
    exit 0
  else
    # Avoid force-killing active agent turns; focus window and notify gently
    open -a "$APP"
    osascript -e 'display notification "当前 T3 Code 未携带 CDP 端口启动。请先按 Cmd+Q 退出一次，再点 T3 Code Prism 即可永久自动注入。" with title "T3 Prism Optics"' >/dev/null 2>&1 || true
    exit 0
  fi
fi

# 3. Launch T3 Code fresh with local loopback CDP enabled; LaunchAgent auto-injects in ~1-2s
open -a "$APP" --args --remote-debugging-port=0

# Trigger immediate one-shot inject retries while window boots for sub-second feel
(
  for _ in 1 2 3 4 5 6; do
    sleep 1
    if "${nodePath}" "${injectScript}" >/dev/null 2>&1; then
      break
    fi
  done
) &
`;
  const launcherBinPath = path.join(macOsDir, 'launcher');
  fs.writeFileSync(launcherBinPath, launcherScript, { mode: 0o755 });

  return { appPath: resolvedApp, launcherBinPath, hasIcon };
}

function pinLauncherToDock(appPath = DEFAULT_LAUNCHER_APP_PATH) {
  if (process.platform !== 'darwin') return { supported: false, pinned: false };
  const py = `
import os, plistlib, subprocess, sys, urllib.parse
app_path = os.path.abspath(sys.argv[1])
dock_plist = os.path.expanduser("~/Library/Preferences/com.apple.dock.plist")
app_url = "file://" + urllib.parse.quote(app_path) + "/"
with open(dock_plist, "rb") as f:
    data = plistlib.load(f)
apps = data.setdefault("persistent-apps", [])
for item in apps:
    u = item.get("tile-data", {}).get("file-data", {}).get("_CFURLString", "")
    if u.rstrip("/") == app_url.rstrip("/"):
        print("ALREADY_PINNED")
        sys.exit(0)
entry = {
    "tile-data": {
        "file-data": {
            "_CFURLString": app_url,
            "_CFURLStringType": 15,
        },
        "file-label": os.path.basename(app_path).replace(".app", ""),
        "file-type": 41,
    },
    "tile-type": "file-tile",
}
# Insert right after Antigravity if present, else append
insert_idx = len(apps)
for i, item in enumerate(apps):
    lbl = str(item.get("tile-data", {}).get("file-label", ""))
    if lbl.lower() == "antigravity":
        insert_idx = i + 1
        break
apps.insert(insert_idx, entry)
with open(dock_plist, "wb") as f:
    plistlib.dump(data, f, fmt=plistlib.FMT_BINARY)
subprocess.run(["killall", "Dock"], check=False)
print("PINNED")
`;
  const out = execFileSync('python3', ['-c', py, appPath], { encoding: 'utf8' }).trim();
  return { supported: true, pinned: true, status: out };
}

function unpinLauncherFromDock(appPath = DEFAULT_LAUNCHER_APP_PATH) {
  if (process.platform !== 'darwin') return { supported: false, removed: false };
  const py = `
import os, plistlib, subprocess, sys, urllib.parse
app_path = os.path.abspath(sys.argv[1])
dock_plist = os.path.expanduser("~/Library/Preferences/com.apple.dock.plist")
if not os.path.exists(dock_plist):
    print("MISSING")
    sys.exit(0)
app_url = "file://" + urllib.parse.quote(app_path) + "/"
with open(dock_plist, "rb") as f:
    data = plistlib.load(f)
apps = data.get("persistent-apps", [])
kept = [
    item for item in apps
    if item.get("tile-data", {}).get("file-data", {}).get("_CFURLString", "").rstrip("/") != app_url.rstrip("/")
]
if len(kept) == len(apps):
    print("NOT_PINNED")
    sys.exit(0)
data["persistent-apps"] = kept
with open(dock_plist, "wb") as f:
    plistlib.dump(data, f, fmt=plistlib.FMT_BINARY)
subprocess.run(["killall", "Dock"], check=False)
print("UNPINNED")
`;
  const out = execFileSync('python3', ['-c', py, appPath], { encoding: 'utf8' }).trim();
  return { supported: true, removed: out === 'UNPINNED', status: out };
}

function installAutostart({
  targetDir = DEFAULT_INSTALL_DIR,
  sourceDir = ROOT_DIR,
  launchAgentPath = DEFAULT_LAUNCH_AGENT_PATH,
  launcherAppPath = DEFAULT_LAUNCHER_APP_PATH,
  pinDock = false,
  registerSystem = process.platform === 'darwin',
} = {}) {
  const installed = installPlugin(targetDir, sourceDir);
  const injectScriptPath = path.join(installed.targetDir, 'lib', 'inject.js');
  const logPath = path.join(installed.targetDir, 'launchd.log');

  const plistContent = buildLaunchAgentPlist({
    label: LAUNCH_AGENT_LABEL,
    nodePath: process.execPath,
    injectScriptPath,
    logPath,
  });
  fs.mkdirSync(path.dirname(launchAgentPath), { recursive: true });
  fs.writeFileSync(launchAgentPath, plistContent, 'utf8');

  const launcher = buildLauncherApp({
    appPath: launcherAppPath,
    pluginDir: installed.targetDir,
    nodePath: process.execPath,
    label: LAUNCH_AGENT_LABEL,
  });

  let launchdLoaded = false;
  if (registerSystem && process.platform === 'darwin') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid !== null) {
      try {
        execFileSync('launchctl', ['bootout', `gui/${uid}/${LAUNCH_AGENT_LABEL}`], { stdio: 'ignore' });
      } catch {}
      try {
        execFileSync('launchctl', ['bootstrap', `gui/${uid}`, launchAgentPath], { stdio: 'ignore' });
        execFileSync('launchctl', ['kickstart', '-k', `gui/${uid}/${LAUNCH_AGENT_LABEL}`], { stdio: 'ignore' });
        launchdLoaded = true;
      } catch {}
    }
    try {
      const lsregister =
        '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
      if (fs.existsSync(lsregister)) {
        execFileSync(lsregister, ['-f', launcher.appPath], { stdio: 'ignore' });
      }
    } catch {}
  }

  let dockResult = null;
  if (pinDock && registerSystem && process.platform === 'darwin') {
    dockResult = pinLauncherToDock(launcher.appPath);
  }

  return {
    installed,
    launchAgentPath,
    launchdLoaded,
    launcher,
    dock: dockResult,
  };
}

function uninstallAutostart({
  launchAgentPath = DEFAULT_LAUNCH_AGENT_PATH,
  launcherAppPath = DEFAULT_LAUNCHER_APP_PATH,
  registerSystem = process.platform === 'darwin',
} = {}) {
  if (registerSystem && process.platform === 'darwin') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid !== null) {
      try {
        execFileSync('launchctl', ['bootout', `gui/${uid}/${LAUNCH_AGENT_LABEL}`], { stdio: 'ignore' });
      } catch {}
    }
  }
  const removedAgent = fs.existsSync(launchAgentPath);
  if (removedAgent) fs.rmSync(launchAgentPath, { force: true });

  const removedApp = fs.existsSync(launcherAppPath);
  if (removedApp) fs.rmSync(launcherAppPath, { recursive: true, force: true });

  const dockResult = registerSystem && process.platform === 'darwin' ? unpinLauncherFromDock(launcherAppPath) : null;
  return { removedAgent, removedApp, dock: dockResult };
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
"${process.execPath}" "${path.join(resolvedTarget, 'lib', 'inject.js')}" --watch
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
  const autostart = {
    launchAgentInstalled: fs.existsSync(DEFAULT_LAUNCH_AGENT_PATH),
    launchAgentPath: DEFAULT_LAUNCH_AGENT_PATH,
    launcherAppInstalled: fs.existsSync(DEFAULT_LAUNCHER_APP_PATH),
    launcherAppPath: DEFAULT_LAUNCHER_APP_PATH,
  };
  return { installed, targetDir: resolvedTarget, meta, cdp, autostart };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const targetArgIdx = args.indexOf('--target');
  const targetDir = targetArgIdx >= 0 ? args[targetArgIdx + 1] : DEFAULT_INSTALL_DIR;

  if (args.includes('--status')) {
    console.log(JSON.stringify(getStatus(targetDir), null, 2));
  } else if (args.includes('--uninstall-autostart')) {
    const res = uninstallAutostart();
    console.log('Removed T3 Prism Optics macOS autostart:', JSON.stringify(res));
  } else if (args.includes('--uninstall')) {
    if (process.platform === 'darwin') uninstallAutostart();
    const res = uninstallPlugin(targetDir);
    console.log(res.existed ? `Removed ${res.targetDir}` : `Not installed at ${res.targetDir}`);
  } else if (args.includes('--autostart')) {
    const pinDock = args.includes('--pin-dock');
    const res = installAutostart({ targetDir, pinDock });
    console.log(`Installed T3 Prism Optics to ${res.installed.targetDir}`);
    console.log(`  LaunchAgent: ${res.launchAgentPath} (loaded=${res.launchdLoaded})`);
    console.log(`  Launcher App: ${res.launcher.appPath} (icon=${res.launcher.hasIcon})`);
    if (res.dock) console.log(`  macOS Dock: ${res.dock.status}`);
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
          '  Option A (Permanent 1-Click macOS Dock + LaunchAgent):\n' +
          '    npm run install:dock\n' +
          '  Option B (Manual launch):\n' +
          '    1. Quit T3 Code completely (Cmd+Q)\n' +
          `    2. Relaunch with: open -a "${path.dirname(path.dirname(path.dirname(bin)))}" --args --remote-debugging-port=0\n` +
          '    3. Start watcher: npm run watch'
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
  LAUNCH_AGENT_LABEL,
  DEFAULT_LAUNCH_AGENT_PATH,
  DEFAULT_LAUNCHER_APP_PATH,
  buildLaunchAgentPlist,
  buildLauncherApp,
  installAutostart,
  uninstallAutostart,
  installPlugin,
  uninstallPlugin,
  getStatus,
  findT3AppBundle,
  findT3AppBinary,
};
