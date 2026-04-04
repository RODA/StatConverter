const fs = require('fs');
const os = require('os');
const path = require('path');

const ARCH_DIR_BY_NAME = {
  arm64: 'darwin-arm64',
  x64: 'darwin-x86',
};

function patchMacRLauncher(runtimeDir) {
  const launcherPath = path.join(runtimeDir, 'bin', 'R');
  const src = fs.readFileSync(launcherPath, 'utf8');
  const startMarker = '#!/bin/sh\n# Shell wrapper for R executable.\n\n';
  const endMarker = '\n# Since this script can be called recursively, we allow R_ARCH to\n';

  const startIndex = src.indexOf(startMarker);
  const endIndex = src.indexOf(endMarker);

  if (startIndex !== 0 || endIndex === -1) {
    throw new Error(`Unexpected macOS R launcher format: ${launcherPath}`);
  }

  const replacement = `${startMarker}SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"\nR_HOME_DIR="$(CDPATH= cd -- "\${SCRIPT_DIR}/.." && pwd)"\nR_HOME="\${R_HOME_DIR}"\nexport R_HOME\nR_SHARE_DIR="\${R_HOME}/share"\nexport R_SHARE_DIR\nR_INCLUDE_DIR="\${R_HOME}/include"\nexport R_INCLUDE_DIR\nR_DOC_DIR="\${R_HOME}/doc"\nexport R_DOC_DIR\n`;

  fs.writeFileSync(launcherPath, replacement + src.slice(endIndex), 'utf8');
}

function resolveArchName(context) {
  if (typeof context.arch === 'string') return context.arch;

  switch (context.arch) {
    case 1:
      return 'x64';
    case 3:
      return 'arm64';
    case 4:
      return 'universal';
    default:
      return String(context.arch || '');
  }
}

exports.default = async function beforePack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const archName = resolveArchName(context);
  const sourceRoot = process.env.SC_MAC_R_PORTABLE_ROOT || path.join(os.homedir(), 'Lucru', '_R', 'R_Portable');
  const runtimeSubdir = ARCH_DIR_BY_NAME[archName];

  if (!runtimeSubdir) {
    throw new Error(`Unsupported macOS build arch for bundled R runtime: ${archName}`);
  }

  const sourceDir = path.join(sourceRoot, runtimeSubdir);
  const projectDir = context.packager && context.packager.projectDir;
  const targetDir = path.join(projectDir, 'R-runtime');

  if (!projectDir) {
    throw new Error('electron-builder beforePack did not provide a project directory');
  }

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Portable R directory not found for macOS ${archName}: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  patchMacRLauncher(targetDir);

  console.log(`[beforePack] Prepared macOS portable R from ${sourceDir}`);
};
