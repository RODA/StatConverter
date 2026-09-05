#!/usr/bin/env node
/**
 * Submits the built macOS disk images to Apple's notary service, reports on past
 * submissions, and staples the resulting tickets.
 *
 * Notarization runs here rather than in CI because the notary credentials live in a
 * keychain profile on the release machine. The Intel build is produced by GitHub
 * Actions, so `npm run fetch:intel` brings it back before `submit` and `staple` treat
 * both architectures as one release.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
    DMG_LABELS,
    archForChannelMetadata,
    projectRoot,
    productAppPathForArch,
    productAppPaths,
    productDmgPaths,
    updateChannelMetadataPaths
} = require('./artifact-paths');

const keychainProfile = String(
    process.env.STATCONVERTER_NOTARY_PROFILE || 'developer-id-notary'
).trim();

// One submit run covers every DMG present, so the default shows both the silicon
// and the intel result from the most recent run. Override with, for example,
// `npm run history -- 6`.
const DEFAULT_HISTORY_ENTRIES = 2;

function fail(message) {
    throw new Error(message);
}

function requireMacOS() {
    if (process.platform !== 'darwin') {
        fail('macOS notarization commands must run on macOS.');
    }
}

function runCommand(command, args) {
    const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit' });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`${command} failed with exit code ${String(result.status)}.`);
    }
}

function runInherited(args) {
    const result = spawnSync('xcrun', args, { cwd: projectRoot, stdio: 'inherit' });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`xcrun failed with exit code ${String(result.status)}.`);
    }
}

function readHistory() {
    const result = spawnSync(
        'xcrun',
        ['notarytool', 'history', '--keychain-profile', keychainProfile, '--output-format', 'json'],
        { cwd: projectRoot, encoding: 'utf8' }
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
        process.stderr.write(String(result.stderr || ''));
        fail(`notarytool history failed with exit code ${String(result.status)}.`);
    }

    const parsed = JSON.parse(String(result.stdout || '{}'));

    return Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.history)
            ? parsed.history
            : [];
}

function historyNewestFirst(history) {
    return history.slice().sort((left, right) => {
        const leftTime = Date.parse(String(left.createdDate || ''));
        const rightTime = Date.parse(String(right.createdDate || ''));
        const normalizedLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const normalizedRight = Number.isFinite(rightTime) ? rightTime : 0;

        return normalizedRight - normalizedLeft;
    });
}

function submit(labels) {
    const dmgPaths = productDmgPaths({ labels });

    for (const dmgPath of dmgPaths) {
        console.log(`Submitting ${dmgPath}; waiting for the notary service.`);

        const result = spawnSync(
            'xcrun',
            [
                'notarytool',
                'submit',
                dmgPath,
                '--keychain-profile',
                keychainProfile,
                '--wait',
                '--output-format',
                'json'
            ],
            { cwd: projectRoot, encoding: 'utf8' }
        );

        if (result.error) throw result.error;

        process.stderr.write(String(result.stderr || ''));
        const stdout = String(result.stdout || '');

        let parsed;
        try {
            parsed = JSON.parse(stdout);
        } catch {
            fail(`Could not read the notary response for ${dmgPath}:\n${stdout}`);
        }

        const status = String(parsed.status || '(unknown)');
        const id = String(parsed.id || '');
        console.log(`${path.basename(dmgPath)}: ${status}${id ? ` (id ${id})` : ''}`);

        // The status decides, not the exit code: notarytool can exit 0 on a rejected
        // submission, and stapling a rejected disk image would then look like it had
        // worked.
        if (status !== 'Accepted') {
            fail(
                `${dmgPath} was not accepted (${status}).\n`
                + `For the reasons, run: xcrun notarytool log ${id || '<submission-id>'} `
                + `--keychain-profile ${keychainProfile}`
            );
        }
    }
}

function showRecentHistory(count) {
    const history = historyNewestFirst(readHistory());

    if (!history.length) {
        fail('No notarization submissions were returned.');
    }

    const entries = history.slice(0, count);
    console.log(`Showing ${entries.length} of ${history.length} submission(s), newest first:`);

    for (const entry of entries) {
        console.log('');
        console.log(`Name: ${String(entry.name || '(unknown)')}`);
        console.log(`Status: ${String(entry.status || '(unknown)')}`);
        console.log(`Created: ${String(entry.createdDate || '(unknown)')}`);
        console.log(`ID: ${String(entry.id || '(unknown)')}`);
    }
}

function fileHash(filePath, algorithm, encoding) {
    return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding);
}

/**
 * Rebuilds the updater ZIP from the stapled application.
 *
 * electron-builder writes the ZIP while packaging, which is before the notary has seen
 * the app, so the copy inside it is signed but carries no stapled ticket. Left alone, an
 * update installs an app that has to reach Apple to validate and fails behind a captive
 * portal or an offline machine. Re-zipping after stapling, and rewriting the checksum
 * the metadata records for it, means the update installs the same stapled app the disk
 * image carries.
 */
function rebuildUpdaterZip(appPath, channelPath) {
    const yaml = require('js-yaml');
    const { appBuilderPath } = require('app-builder-bin');

    const outputDir = path.dirname(channelPath);
    const latest = yaml.load(fs.readFileSync(channelPath, 'utf8')) || {};
    const files = Array.isArray(latest.files) ? latest.files : [];
    const zipEntry = files.find((entry) => /\.zip$/i.test(String((entry || {}).url || '')));

    if (!zipEntry) {
        fail(`No updater ZIP is listed in ${channelPath}.`);
    }

    const zipPath = path.join(outputDir, String(zipEntry.url));
    const blockMapPath = `${zipPath}.blockmap`;
    const temporaryZipPath = `${zipPath}.stapled`;
    const temporaryBlockMapPath = `${blockMapPath}.stapled`;

    fs.rmSync(temporaryZipPath, { force: true });
    fs.rmSync(temporaryBlockMapPath, { force: true });

    console.log(`Rebuilding ${path.basename(zipPath)} from the stapled application.`);
    runCommand('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, temporaryZipPath]);
    runCommand(appBuilderPath, [
        'blockmap',
        '--input', temporaryZipPath,
        '--output', temporaryBlockMapPath
    ]);

    fs.renameSync(temporaryZipPath, zipPath);
    fs.renameSync(temporaryBlockMapPath, blockMapPath);

    const sha512 = fileHash(zipPath, 'sha512', 'base64');
    zipEntry.size = fs.statSync(zipPath).size;
    zipEntry.sha512 = sha512;
    zipEntry.blockMapSize = fs.statSync(blockMapPath).size;
    // The disk image is renamed after packaging, so its entry here would point at a name
    // that no longer exists. The updater only ever reads the ZIP.
    latest.files = [zipEntry];
    latest.path = String(zipEntry.url);
    latest.sha512 = sha512;

    fs.writeFileSync(channelPath, yaml.dump(latest, { lineWidth: -1, noRefs: true }));
}

function staple() {
    // Both disk images are required: stapling rebuilds each architecture's updater ZIP
    // from its own application, so a half-present set would leave one channel pointing
    // at an unstapled ZIP.
    const dmgPaths = productDmgPaths();
    const appPaths = productAppPaths();

    // The application is stapled first: the updater ZIP is rebuilt from it, so it has to
    // carry its ticket before that copy is made.
    for (const appPath of appPaths) {
        console.log(`Stapling ${appPath}`);
        runInherited(['stapler', 'staple', appPath]);
        runInherited(['stapler', 'validate', appPath]);
    }

    // Each channel is rebuilt from the application of its own architecture. Using
    // whichever application happened to be present would hand one architecture's users
    // a binary built for the other.
    for (const channelPath of updateChannelMetadataPaths()) {
        const channelName = path.basename(channelPath);
        const arch = archForChannelMetadata(channelPath);

        if (!arch) {
            console.warn(`Cannot tell which architecture ${channelName} belongs to; leaving it alone.`);
            continue;
        }

        const appPath = productAppPathForArch(arch);
        if (!appPath) {
            console.warn(
                `No ${arch} application is present, so ${channelName} and its ZIP were left alone. `
                + 'Their architecture has to be stapled where that build was produced.'
            );
            continue;
        }

        rebuildUpdaterZip(appPath, channelPath);
    }

    for (const dmgPath of dmgPaths) {
        console.log(`Stapling ${dmgPath}`);
        runInherited(['stapler', 'staple', dmgPath]);
        runInherited(['stapler', 'validate', dmgPath]);
    }
}

function main() {
    requireMacOS();
    const action = String(process.argv[2] || '').trim();

    if (action === 'submit') {
        // A whole release is the default. One architecture can be named — `npm run
        // submit -- silicon` — to re-submit just that one without uploading gigabytes
        // for a disk image the notary has already accepted.
        const requested = process.argv.slice(3).map((value) => String(value).replace(/^--/, ''));
        const unknown = requested.filter((label) => !DMG_LABELS.includes(label));

        if (unknown.length) {
            fail(`Unknown architecture: ${unknown.join(', ')}. Expected ${DMG_LABELS.join(' or ')}.`);
        }

        submit(requested.length ? requested : DMG_LABELS);
        return;
    }

    if (action === 'history') {
        const requested = Number(process.argv[3]);
        const count = Number.isInteger(requested) && requested > 0
            ? requested
            : DEFAULT_HISTORY_ENTRIES;
        showRecentHistory(count);
        return;
    }

    if (action === 'staple') {
        staple();
        return;
    }

    fail('Unknown notarization action. Expected submit, history, or staple.');
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error('[macos-notarization] Failed.');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

module.exports = { rebuildUpdaterZip };
