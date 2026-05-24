const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'linux') return;

  const appOutDir = context.appOutDir;

  // Remove chrome-sandbox
  const chromeSandboxPath = path.join(appOutDir, 'chrome-sandbox');
  if (fs.existsSync(chromeSandboxPath)) {
    fs.unlinkSync(chromeSandboxPath);
    console.log('Removed chrome-sandbox');
  }

  // Find the main executable (could be lowercase or mixed case)
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
