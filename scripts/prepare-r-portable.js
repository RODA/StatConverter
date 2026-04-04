#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const targetDir = path.join(root, 'R-runtime');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'statconverter-r-portable-'));

const DEFAULT_BASE_URL = 'https://github.com/dusadrian/binaries/tree/R-4.5.3';

const ARCHIVE_FILENAMES = {
  linux: {
    x64: 'linux-x86.tar.gz',
  },
  win32: {
    x64: 'windows-x86.zip',
  },
};

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function download(url, destination, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        download(response.headers.location, destination, headers).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed for ${url}: HTTP ${response.statusCode || 'unknown'}`));
        response.resume();
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });

    request.on('error', reject);
  });
}

function resolveArchiveFilename(platform, arch) {
  return ARCHIVE_FILENAMES[platform] && ARCHIVE_FILENAMES[platform][arch];
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

function resolveUrlFromBase(baseUrl, archiveName) {
  const trimmedBaseUrl = trimTrailingSlashes(baseUrl);
  const githubTreeMatch = trimmedBaseUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/
  );

  if (githubTreeMatch) {
    const [, owner, repo, ref, subdir = ''] = githubTreeMatch;
    const encodedParts = [subdir, archiveName]
      .filter(Boolean)
      .flatMap((part) => part.split('/'))
      .filter(Boolean)
      .map(encodeURIComponent);
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${encodedParts.join('/')}`;
  }

  return `${trimmedBaseUrl}/${encodeURIComponent(archiveName)}`;
}

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function detectExtractedRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.name !== '__MACOSX');

  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(dir, entries[0].name);
  }

  return dir;
}

async function extractArchive(archivePath, extractDir) {
  fs.mkdirSync(extractDir, { recursive: true });

  if (archivePath.endsWith('.zip')) {
    if (process.platform === 'win32') {
      await run('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
      ]);
      return;
    }

    await run('tar', ['-xf', archivePath, '-C', extractDir]);
    return;
  }

  await run('tar', ['-xzf', archivePath, '-C', extractDir]);
}

async function main() {
  const archiveName = resolveArchiveFilename(process.platform, process.arch);
  if (!archiveName) {
    throw new Error(`No portable R archive configured for ${process.platform}/${process.arch}`);
  }

  const baseUrl = (process.env.SC_R_PORTABLE_BASE_URL || DEFAULT_BASE_URL).trim();
  const archiveUrl = resolveUrlFromBase(baseUrl, archiveName);
  const archivePath = path.join(tmpRoot, archiveName);
  const extractDir = path.join(tmpRoot, 'extract');

  console.log(`[prepare:r-portable] Downloading ${archiveUrl}`);
  await download(archiveUrl, archivePath);

  console.log(`[prepare:r-portable] Extracting ${archivePath}`);
  await extractArchive(archivePath, extractDir);

  const extractedRoot = detectExtractedRoot(extractDir);
  ensureCleanDir(targetDir);
  fs.cpSync(extractedRoot, targetDir, { recursive: true });

  console.log(`[prepare:r-portable] Prepared R runtime in ${targetDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
