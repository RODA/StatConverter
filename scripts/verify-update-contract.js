#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const pkg = require('../package.json');
assert.equal(pkg.build.publish.provider, 'generic');
assert.equal(
  pkg.build.publish.url,
  'https://github.com/RODA/StatConverter/releases/download/latest'
);
assert.equal(pkg.build.publish.channel, 'latest-x64');
assert.equal(pkg.devDependencies['app-builder-bin'], '5.0.0-alpha.12');
assert.ok(pkg.build.mac.target.some((target) => target.target === 'zip'));
// The Intel ZIP is fetched back by name for notarization, so the architecture has to be
// part of every macOS artifact name rather than being implied by the absence of one.
assert.match(pkg.build.mac.artifactName, /\$\{arch\}/);
assert.match(pkg.build.mac.artifactName, /\$\{os\}/);

for (const script of [
  'dist',
  'dist:sign',
  'rename:mac',
  'capture:screenshot',
  'verify:mac-signing',
  'fetch:intel',
  'submit',
  'history',
  'staple',
  'publish'
]) {
  assert.ok(pkg.scripts[script], `missing npm script: ${script}`);
}
assert.match(pkg.scripts['dist'], /SC_SKIP_CODESIGN=true/);
assert.doesNotMatch(pkg.scripts['dist:sign'], /SC_SKIP_CODESIGN/);

const main = read('src/main.ts');
assert.match(main, /autoUpdaterInstance\.autoDownload = false/);
assert.match(main, /process\.arch === "arm64" \? "latest-arm64" : "latest-x64"/);
assert.match(main, /mode: "available"/);
assert.match(main, /autoUpdaterInstance\.downloadUpdate\(\)/);
assert.match(main, /autoUpdaterInstance\.quitAndInstall\(false, true\)/);

const html = read('src/index.html');
const settingsIndex = html.indexOf('id="v-pills-settings-tab"');
const updateIndex = html.indexOf('id="app-update-button"');
assert.ok(settingsIndex >= 0 && updateIndex > settingsIndex, 'update button must follow Settings');
assert.match(html, /class="update-label">Download<\/span>/);
assert.match(html, /\.app-update-button:hover \.update-label/);

const preload = read('src/preload.ts');
assert.match(preload, /tooltip = 'New version available'/);
assert.match(preload, /updateLabel\.textContent = 'Update'/);
assert.match(preload, /tooltip = 'Quit application to update'/);

const dispatcher = read('scripts/dist-dispatch.js');
assert.match(dispatcher, /-c\.publish\.channel=latest-arm64/);
// Renaming belongs to the release steps, not to packaging: GitHub Actions renames its
// own lanes, and a local macOS build is renamed by the documented release sequence.
assert.doesNotMatch(dispatcher, /rename:(mac|linux|win)/);

// Stapling has to rebuild each updater ZIP from the application of its own
// architecture, or one architecture's users are handed the other's binary.
const notarization = read('scripts/macos-notarization.js');
assert.match(notarization, /productAppPathForArch\(arch\)/);
assert.match(notarization, /rebuildUpdaterZip\(appPath, channelPath\)/);

// The Intel lane's ZIP and its channel file are what the local notarization pass pulls
// back; fetching one without the other would staple a build with no metadata to match.
const fetchIntel = read('scripts/fetch-intel-artifacts.js');
assert.match(fetchIntel, /'\*-x64-mac\.zip'/);
assert.match(fetchIntel, /'latest-x64-mac\.yml'/);
// The Intel build is signed but not notarized when CI is done with it, so it waits in
// staging; only the local notarization pass writes to the release users download from.
assert.match(fetchIntel, /SC_STAGING_TAG \|\| 'macos-intel-staging'/);
// Download names stay the same across releases so Gatekeeper and SmartScreen keep the
// reputation they have built for them; the rename scripts and everything that looks a
// renamed file up have to agree on that.
assert.match(fetchIntel, /`\$\{nameFile\}_intel\.dmg`/);
const artifactPaths = read('scripts/artifact-paths.js');
assert.match(artifactPaths, /const DMG_LABELS = \['silicon', 'intel'\]/);
assert.match(artifactPaths, /`\$\{productFileName\(\)\}_\$\{label\}\.dmg`/);
// Notarizing, stapling and publishing cover a whole release, so a half-present set is
// an error rather than something to quietly work with.
assert.match(artifactPaths, /required = true, labels = DMG_LABELS/);
const refreshMetadata = read('scripts/refresh-update-metadata.js');
assert.match(refreshMetadata, /`\$\{name\}_setup_intel\.exe`/);
assert.match(refreshMetadata, /`\$\{name\}_intel\.AppImage`/);
for (const [script, names] of [
  ['scripts/rename-binaries-mac.sh', ['${NAME_FILE}_silicon.dmg', '${NAME_FILE}_intel.dmg']],
  ['scripts/rename-binaries-linux.sh', ['${NAME_FILE}_silicon.AppImage', '${NAME_FILE}_intel.AppImage']],
  ['scripts/rename-binaries-windows.ps1', ['${nameForFile}_setup_intel.exe', '${nameForFile}_intel.exe']]
]) {
  const source = read(script);
  for (const name of names) {
    assert.ok(source.includes(name), `${script} should produce ${name}`);
  }
}

// The site screenshot shows the version in the app's sidebar, so a release refreshes it
// from the packaged build rather than leaving last release's picture in place.
const capture = read('scripts/capture-screenshot.js');
assert.match(capture, /docs', 'images', 'StatConverter\.png'/);
assert.match(capture, /screencapture/);
assert.ok(
  fs.existsSync(path.join(root, 'docs/images/StatConverter.png')),
  'docs/images/StatConverter.png should exist'
);

const downloadPage = read('docs/download.html');
// The file names no longer carry the version, so the page states it instead — and that
// statement is the one thing on the page that still has to be updated per release.
const statedVersion = /Current version: <b>([^<]+)<\/b>/.exec(downloadPage);
assert.ok(statedVersion, 'docs/download.html should state the current version');
assert.equal(
  statedVersion[1],
  pkg.version,
  `docs/download.html says ${statedVersion[1]}, package.json says ${pkg.version}`
);
for (const name of [
  'StatConverter_setup_intel.exe',
  'StatConverter_intel.exe',
  'StatConverter_intel.dmg',
  'StatConverter_silicon.dmg',
  'StatConverter_intel.AppImage'
]) {
  assert.ok(
    downloadPage.includes(`releases/download/latest/${name}?raw=true`),
    `docs/download.html should link ${name}`
  );
}

const publishArtifacts = read('scripts/publish-artifacts.js');
assert.match(publishArtifacts, /SC_PUBLISH_TAG \|\| 'latest'/);
assert.match(publishArtifacts, /assertStapled\(dmgPaths\)/);

const workflows = [
  '.github/workflows/build-binaries.yml',
  '.github/workflows/build-linux-intel.yml',
  '.github/workflows/build-windows-intel.yml',
  '.github/workflows/build-macos-intel.yml'
];

for (const workflow of workflows) {
  const source = read(workflow);
  if (workflow.includes('linux') || workflow.endsWith('build-binaries.yml')) {
    assert.match(source, /build\/output\/latest\*-linux\.yml/);
    assert.match(source, /build\/output\/\*\.AppImage\.blockmap/);
  }
  if (workflow.includes('windows') || workflow.endsWith('build-binaries.yml')) {
    assert.match(source, /Refresh Windows update metadata/);
    assert.match(source, /build\/output\/latest\*\.yml/);
    assert.match(source, /build\/output\/\*\.exe\.blockmap/);
  }
  if (workflow.endsWith('build-binaries.yml')) {
    // One platform failing to build is a reason to withhold that platform, not the two
    // that built cleanly, so the publish job runs regardless and gates each upload on
    // the result of the lane it publishes.
    assert.match(source, /if: \$\{\{ !cancelled\(\) \}\}/);
    for (const job of ['linux-intel', 'windows-intel', 'macos-intel']) {
      assert.match(
        source,
        new RegExp(`if: \\$\\{\\{ needs\\['${job}'\\]\\.result == 'success' \\}\\}`),
        `build-binaries.yml should gate publishing on ${job}`
      );
    }
  }
  if (workflow.includes('macos') || workflow.endsWith('build-binaries.yml')) {
    assert.match(source, /electron-builder --mac dmg zip --x64/);
    assert.match(source, /npm run verify:mac-signing/);
    assert.match(source, /build\/output\/\*-mac\.yml/);
    assert.match(source, /build\/output\/\*-mac\.zip\.blockmap/);
    // The unnotarized Intel build must not land in the release users download from.
    assert.match(source, /tag_name: macos-intel-staging/);
    const macUpload = source.slice(source.indexOf('tag_name: macos-intel-staging'));
    assert.match(macUpload.slice(0, 800), /prerelease: true/);
  }
}

console.log('Update UI and release-channel contract verified.');
