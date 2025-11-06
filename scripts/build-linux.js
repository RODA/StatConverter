#!/usr/bin/env node
/*
  Generates a Linux-only electron-builder config from package.json build,
  runs electron-builder for x64 and arm64, and leaves package.json untouched.
*/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const tmpDir = path.join(root, '.tmp');
const cfgPath = path.join(tmpDir, 'electron-builder-linux.json');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

(async () => {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const base = pkg.build || {};

  const linuxConfig = Object.assign({}, base, {
    // Remove mac section to avoid any cross-platform confusion
    mac: undefined,
    // Ensure linux section is present and configured
    linux: Object.assign({}, base.linux || {}, {
      target: 'AppImage',
      icon: base.linux?.icon || 'icons/original/icon.png',
      category: base.linux?.category || 'Utility',
      maintainer: base.linux?.maintainer || 'Adrian Dusa <dusa.adrian@gmail.com>'
    })
  });

  // Clean undefined keys (like mac: undefined)
  const cleaned = JSON.parse(JSON.stringify(linuxConfig));

  // Ensure tmp dir
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  fs.writeFileSync(cfgPath, JSON.stringify(cleaned, null, 2));

  const bin = path.join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
  );

  // Build only Linux targets, do not publish by default
  const args = ['--linux', '--x64', '--arm64', '--publish', 'never', '-c', cfgPath];

  console.log('Using electron-builder config at', cfgPath);
  await run(bin, args, { cwd: root });
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

