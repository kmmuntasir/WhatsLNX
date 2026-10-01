#!/usr/bin/env node
//
// Regenerate dist/latest-linux.yml after the AppImage has been repacked with
// the static AppImage runtime (scripts/repack-appimage.sh).
//
// electron-updater verifies the sha512 of downloaded artifacts against this
// file, so it must describe the *repacked* bytes. The repacked AppImage has
// no embedded blockmap, so `blockMapSize` is intentionally omitted — the
// updater then downloads the full file instead of a delta.
//
// Usage: node scripts/generate-update-info.js
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// Only pick artifacts matching the current version — dist/ may contain stale
// files from earlier local builds.
const versionSuffixes = [
  `WhatsLNX-${pkg.version}.AppImage`,
  `whatslnx_${pkg.version}_amd64.deb`,
];
const artifacts = versionSuffixes.filter(name => fs.existsSync(path.join(dist, name)));
if (artifacts.length === 0) {
  console.error(`error: no artifacts for version ${pkg.version} found in dist/`);
  process.exit(1);
}

function fileEntry(name) {
  const filePath = path.join(dist, name);
  const data = fs.readFileSync(filePath);
  return {
    url: name,
    sha512: crypto.createHash('sha512').update(data).digest('base64'),
    size: data.length,
  };
}

// The AppImage is the primary update artifact for electron-updater; put it first.
const appImage = artifacts.find(f => f.endsWith('.AppImage'));
const entries = [appImage, ...artifacts.filter(f => f !== appImage)].map(fileEntry);

const yml =
  `version: ${pkg.version}\n` +
  'files:\n' +
  entries.map(e => `  - url: ${e.url}\n    sha512: ${e.sha512}\n    size: ${e.size}\n`).join('') +
  `path: ${appImage}\n` +
  `sha512: ${entries[0].sha512}\n` +
  `releaseDate: '${new Date().toISOString()}'\n`;

const outFile = path.join(dist, 'latest-linux.yml');
fs.writeFileSync(outFile, yml);
console.log(`>> Wrote ${outFile}`);
console.log(yml.trimEnd());
