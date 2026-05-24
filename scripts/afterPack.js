const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'linux') return;

  const appOutDir = context.appOutDir;
  const isSnap = context.targets.some(t => t.name === 'snap');
  const isFlatpak = context.targets.some(t => t.name === 'flatpak');

  // Remove chrome-sandbox
  const chromeSandboxPath = path.join(appOutDir, 'chrome-sandbox');
  if (fs.existsSync(chromeSandboxPath)) {
    fs.unlinkSync(chromeSandboxPath);
    console.log('Removed chrome-sandbox');
  }

  if (isSnap) {
    // Patch snap template: remove -e flag so errors in desktop setup don't
    // kill the launcher. Keeps icon/theme setup working for classic confinement.
    const templateDir = path.join(
      process.env.HOME || '/root',
      '.cache/electron-builder/snap/snap-template-electron-4.0-2-amd64'
    );
    for (const script of ['desktop-init.sh', 'desktop-common.sh', 'desktop-gnome-specific.sh']) {
      const scriptPath = path.join(templateDir, script);
      if (fs.existsSync(scriptPath)) {
        let content = fs.readFileSync(scriptPath, 'utf8');
        content = content.replace(/bin\/bash -e/g, 'bin/bash');
        fs.writeFileSync(scriptPath, content);
        console.log(`Patched ${script} (removed -e)`);
      }
    }
    return;
  }

  if (isFlatpak) {
    // Flatpak uses zypak via Electron BaseApp — no --no-sandbox wrapper needed
    return;
  }

  // For AppImage/deb: wrap binary with --no-sandbox
  const entries = fs.readdirSync(appOutDir);
  const executables = entries.filter(e => {
    const fullPath = path.join(appOutDir, e);
    return fs.statSync(fullPath).isFile() && !e.includes('.') && e !== 'chrome-sandbox' && !e.startsWith('lib');
  });

  for (const exe of executables) {
    const exePath = path.join(appOutDir, exe);
    try {
      fs.accessSync(exePath, fs.constants.X_OK);
    } catch {
      continue;
    }

    const realPath = exePath + '.real';
    fs.renameSync(exePath, realPath);
    fs.writeFileSync(exePath, `#!/bin/sh
exec "$(dirname "$0")/${exe}.real" --no-sandbox "$@"
`);
    fs.chmodSync(exePath, 0o755);
    console.log(`Wrapped ${exe} with --no-sandbox`);
  }
};
