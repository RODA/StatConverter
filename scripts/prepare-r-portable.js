#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const targetDir = path.join(root, 'R-runtime');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'statconverter-r-portable-'));

const DEFAULT_BASE_URL = 'https://github.com/dusadrian/binaries/releases/download/R-4.5.3';

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

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Request failed for ${url}: HTTP ${response.statusCode || 'unknown'}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
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

function parseGitHubReleaseUrl(url) {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    tag: decodeURIComponent(match[3]),
    assetName: decodeURIComponent(match[4]),
  };
}

function parseGitHubTreeOrBlobUrl(url) {
  const treeMatch = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/
  );
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2],
      ref: decodeURIComponent(treeMatch[3]),
      basePath: treeMatch[4] ? decodeURIComponent(treeMatch[4]) : '',
    };
  }

  const blobMatch = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/
  );
  if (blobMatch) {
    return {
      owner: blobMatch[1],
      repo: blobMatch[2],
      ref: decodeURIComponent(blobMatch[3]),
      basePath: path.posix.dirname(decodeURIComponent(blobMatch[4])),
    };
  }

  return null;
}

function parseRawGitHubUrl(url) {
  const match = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    ref: decodeURIComponent(match[3]),
    filePath: decodeURIComponent(match[4]),
  };
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

  const githubBlobMatch = trimmedBaseUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/
  );
  if (githubBlobMatch) {
    const [, owner, repo, ref, filePath] = githubBlobMatch;
    const baseDir = path.posix.dirname(filePath);
    const pathParts = [baseDir, archiveName]
      .flatMap((part) => part.split('/'))
      .filter(Boolean)
      .map(encodeURIComponent);
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${pathParts.join('/')}`;
  }

  return `${trimmedBaseUrl}/${encodeURIComponent(archiveName)}`;
}

async function downloadGitHubReleaseAsset(url, destination, token) {
  const parsed = parseGitHubReleaseUrl(url);
  if (!parsed) {
    await download(url, destination);
    return;
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'statconverter-prepare-r-portable',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const release = await requestJson(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/releases/tags/${encodeURIComponent(parsed.tag)}`,
    headers
  );

  const asset = Array.isArray(release.assets)
    ? release.assets.find((item) => item && item.name === parsed.assetName)
    : null;

  if (!asset || !asset.url) {
    throw new Error(
      `Release asset not found for ${parsed.owner}/${parsed.repo}@${parsed.tag}: ${parsed.assetName}`
    );
  }

  await download(asset.url, destination, {
    Accept: 'application/octet-stream',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'statconverter-prepare-r-portable',
    'X-GitHub-Api-Version': '2022-11-28',
  });
}

async function downloadGitHubRepoFile(owner, repo, ref, filePath, destination, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'statconverter-prepare-r-portable',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const content = await requestJson(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
    headers
  );

  if (content && typeof content.download_url === 'string' && content.download_url) {
    await download(content.download_url, destination, {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'statconverter-prepare-r-portable',
    });
    return;
  }

  if (content && typeof content.content === 'string' && content.encoding === 'base64') {
    fs.writeFileSync(destination, Buffer.from(content.content, 'base64'));
    return;
  }

  throw new Error(`Unable to resolve GitHub file download for ${owner}/${repo}/${filePath}@${ref}`);
}

async function downloadPortableArchive(url, destination, token) {
  const release = parseGitHubReleaseUrl(url);
  if (release && token) {
    await downloadGitHubReleaseAsset(url, destination, token);
    return;
  }

  const treeOrBlob = parseGitHubTreeOrBlobUrl(url);
  if (treeOrBlob && token) {
    const fileName = path.basename(destination);
    const filePath = [treeOrBlob.basePath, fileName].filter(Boolean).join('/');
    await downloadGitHubRepoFile(treeOrBlob.owner, treeOrBlob.repo, treeOrBlob.ref, filePath, destination, token);
    return;
  }

  const raw = parseRawGitHubUrl(url);
  if (raw && token) {
    await downloadGitHubRepoFile(raw.owner, raw.repo, raw.ref, raw.filePath, destination, token);
    return;
  }

  await download(url, destination);
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
  const baseUrl = (process.env.SC_R_PORTABLE_BASE_URL || DEFAULT_BASE_URL).trim();
  const url = (process.env.SC_R_PORTABLE_URL || '').trim() || (archiveName && baseUrl
    ? resolveUrlFromBase(baseUrl, archiveName)
    : '');
  const githubToken = (process.env.SC_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim();

  if (!url) {
    throw new Error(
      `No portable R archive configured for platform ${process.platform}/${process.arch}. ` +
      'Set SC_R_PORTABLE_URL to an archive URL or SC_R_PORTABLE_BASE_URL to a directory containing per-platform archives.'
    );
  }

  const resolvedArchiveName = archiveName || path.basename(new URL(url).pathname);
  const archivePath = path.join(tmpRoot, resolvedArchiveName);
  const extractDir = path.join(tmpRoot, 'extract');

  console.log(`[prepare:r-portable] Downloading ${url}`);
  await downloadPortableArchive(url, archivePath, githubToken);

  console.log(`[prepare:r-portable] Extracting ${resolvedArchiveName}`);
  await extractArchive(archivePath, extractDir);

  const extractedRoot = detectExtractedRoot(extractDir);
  ensureCleanDir(targetDir);
  fs.cpSync(extractedRoot, targetDir, { recursive: true });

  console.log(`[prepare:r-portable] Prepared ${targetDir}`);
}

main()
  .catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });
