#!/usr/bin/env node
// Cross-platform build dispatcher that picks the right build + rename flow per OS.

const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

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
    // Use the Linux-specific builder to avoid mac config, then rename
    await run(process.execPath, ['scripts/build-linux.js']);
    await run.npm('rename:linux');
    return;
  }

  // macOS and Windows: run electron-builder via its JS CLI to avoid .cmd spawn issues on Windows
  const builderCli = require.resolve('electron-builder/out/cli/cli.js', { paths: [root] });
  await run(process.execPath, [builderCli, '--publish', 'never']);

  if (isMac) {
    await run.npm('rename:mac');
    return;
  }

  if (isWin) {
    await run.npm('rename:win');
    return;
  }

  // Fallback for other platforms
  console.warn('Unknown platform, ran electron-builder only.');
})().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
