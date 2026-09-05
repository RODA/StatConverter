#!/usr/bin/env node

/**
 * Re-pairs an update channel with the final release payload.
 *
 * StatConverter renames the files electron-builder emits to stable, version-free
 * download names, and Windows signing changes the installer after its original checksum
 * was recorded. This helper updates the channel after those operations and regenerates
 * the matching blockmap.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const yaml = require('js-yaml');
const { appBuilderPath } = require('app-builder-bin');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'build', 'output');

function fail(message) {
  throw new Error(message);
}

function parsePlatform() {
  const index = process.argv.indexOf('--platform');
  const platform = index >= 0 ? process.argv[index + 1] : '';
  if (platform !== 'linux' && platform !== 'windows') {
    fail('Use --platform linux or --platform windows.');
  }
  return platform;
}

function productName() {
  const pkg = require('../package.json');
  return String((pkg.build && pkg.build.productName) || pkg.name).replace(/\s+/g, '_');
}

function expectedPayload(platform) {
  const name = productName();
  // Version-free, matching the rename scripts: the download names stay the same across
  // releases so they keep the reputation Windows and macOS have built for them.
  return platform === 'windows'
    ? `${name}_setup_intel.exe`
    : `${name}_intel.AppImage`;
}

/**
 * The entry that describes the payload being renamed.
 *
 * A channel file can list more than one artifact — the Linux build emits an AppImage and
 * a .deb, and both are recorded. Only the one the updater actually installs is rewritten
 * here: the others keep the names and checksums electron-builder gave them, which are
 * still correct because those files are not renamed. The top-level `path` names the
 * artifact electron-builder chose as the payload, so it identifies the entry; a match on
 * the file extension covers a channel file that has no usable `path`.
 */
function findPayloadEntry(metadata, payloadName, metadataPath) {
  const files = metadata.files;
  if (!files.length) {
    fail(`No update payload listed in ${path.basename(metadataPath)}.`);
  }

  const named = files.find((file) => file && String(file.url) === String(metadata.path));
  if (named) return named;

  const extension = path.extname(payloadName).toLowerCase();
  const byExtension = files.filter(
    (file) => file && path.extname(String(file.url || '')).toLowerCase() === extension
  );

  if (byExtension.length === 1) return byExtension[0];

  fail(
    `Cannot tell which entry in ${path.basename(metadataPath)} is the ${extension} payload; `
    + `found ${byExtension.length} candidate(s) among: `
    + files.map((file) => String((file || {}).url)).join(', ')
  );
}

function findMetadata(platform) {
  if (!fs.existsSync(outputDir)) {
    fail(`No build output directory at ${outputDir}.`);
  }

  const candidates = fs.readdirSync(outputDir).filter((name) => {
    if (platform === 'linux') {
      return /^latest.*-linux\.yml$/.test(name);
    }
    return /^latest.*\.yml$/.test(name) && !/-(mac|linux)\.yml$/.test(name);
  });

  if (candidates.length !== 1) {
    fail(
      `Expected exactly one ${platform} update metadata file; found ${candidates.length}`
      + (candidates.length ? `: ${candidates.join(', ')}` : '.')
    );
  }

  return path.join(outputDir, candidates[0]);
}

function sha512Base64(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

function regenerateBlockmap(payloadPath) {
  const blockmapPath = `${payloadPath}.blockmap`;
  const suffix = path.extname(payloadPath) + '.blockmap';

  for (const name of fs.readdirSync(outputDir)) {
    if (name.endsWith(suffix) && path.join(outputDir, name) !== blockmapPath) {
      fs.rmSync(path.join(outputDir, name), { force: true });
    }
  }

  const result = spawnSync(
    appBuilderPath,
    ['blockmap', '--input', payloadPath, '--output', blockmapPath],
    { cwd: projectRoot, encoding: 'utf8' }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`app-builder failed while regenerating the blockmap:\n${result.stderr || ''}`);
  }
  if (!fs.existsSync(blockmapPath)) {
    fail(`The blockmap was not created: ${blockmapPath}`);
  }

  return blockmapPath;
}

function main() {
  const platform = parsePlatform();
  const metadataPath = findMetadata(platform);
  const payloadName = expectedPayload(platform);
  const payloadPath = path.join(outputDir, payloadName);

  if (!fs.existsSync(payloadPath)) {
    fail(`Update payload not found: ${payloadPath}`);
  }

  const metadata = yaml.load(fs.readFileSync(metadataPath, 'utf8'));
  if (!metadata || typeof metadata !== 'object' || !Array.isArray(metadata.files)) {
    fail(`Invalid update metadata: ${metadataPath}`);
  }

  const entry = findPayloadEntry(metadata, payloadName, metadataPath);

  const blockmapPath = regenerateBlockmap(payloadPath);
  const sha512 = sha512Base64(payloadPath);
  const size = fs.statSync(payloadPath).size;

  entry.url = payloadName;
  entry.sha512 = sha512;
  entry.size = size;
  entry.blockMapSize = fs.statSync(blockmapPath).size;
  metadata.path = payloadName;
  metadata.sha512 = sha512;

  fs.writeFileSync(metadataPath, yaml.dump(metadata, { lineWidth: 120, noRefs: true }));
  console.log(`Refreshed ${path.basename(metadataPath)} for ${payloadName}.`);
}

try {
  main();
} catch (error) {
  console.error('[refresh-update-metadata] Failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
