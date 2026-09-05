#!/usr/bin/env node
// Cross-platform build dispatcher that picks the right packaging flow per OS.
//
// Renaming the artifacts is deliberately not done here: the Linux, Windows and macOS
// Intel lanes are built by GitHub Actions, which runs `npm run rename:*` as its own
// step. A local macOS build is renamed by the release sequence in RELEASING.md, right
// before the notarization steps that look the renamed disk images up.

const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';
// `npm run dist` produces an unsigned build for local testing; `npm run dist:sign`
// leaves signing on, which is what a release needs before it can be notarized.
const skipCodeSign = process.env.SC_SKIP_CODESIGN === 'true';

function bin(name) {
  return path.join(root, 'node_modules', '.bin', isWin ? `${name}.cmd` : name);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

(function initNpmHelpers() {
  const cli = process.env.npm_execpath; // points to npm-cli.js when invoked via npm
  // Helper to run `npm run <script>` reliably cross-platform
  run.npm = function runNpmScript(scriptName) {
    if (cli) {
      return run(process.execPath, [cli, 'run', scriptName]);
    }
    // Fallback to plain `npm run` if not invoked via npm
    const cmd = isWin ? 'npm.cmd' : 'npm';
    return run(cmd, ['run', scriptName]);
  };
})();

(async () => {
  // Always compile TS first
  await run.npm('build');

  if (isLinux) {
    // Use the Linux-specific builder to avoid mac config
    await run(process.execPath, ['scripts/build-linux.js']);
    return;
  }

  // macOS and Windows: run electron-builder via its JS CLI to avoid .cmd spawn issues on Windows
  const builderCli = require.resolve('electron-builder/out/cli/cli.js', { paths: [root] });
  const builderArgs = ['--publish', 'never'];
  if (isMac) {
    // GitHub Actions owns the x64 lane. A local Apple-silicon build publishes and
    // reads its own update channel so it can never download the Intel ZIP.
    builderArgs.unshift('--mac', '--arm64');
    builderArgs.push('-c.publish.channel=latest-arm64');
    if (skipCodeSign) {
      process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
      builderArgs.push('-c.mac.identity=null');
    }
  }
  await run(process.execPath, [builderCli, ...builderArgs]);

  if (isMac || isWin) {
    return;
  }

  // Fallback for other platforms
  console.warn('Unknown platform, ran electron-builder only.');
})().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
