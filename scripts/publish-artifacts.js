#!/usr/bin/env node
/** Uploads the notarized macOS disk images and update channel to the download release. */

const path = require('path');
const { spawnSync } = require('child_process');

const { projectRoot, productDmgPaths, updateChannelPaths } = require('./artifact-paths');

const targetRepo = String(process.env.SC_PUBLISH_REPO || 'RODA/StatConverter').trim();
const targetTag = String(process.env.SC_PUBLISH_TAG || 'latest').trim();

const allowUnstapled = process.argv.slice(2).includes('--allow-unstapled');

function fail(message) {
    throw new Error(message);
}

function requireGitHubCli() {
    const result = spawnSync('gh', ['--version'], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
        fail('The GitHub CLI (gh) is required to publish. Install it and run `gh auth login`.');
    }
}

/**
 * An unstapled disk image still shows the Gatekeeper warning on a machine that has
 * never seen it, which defeats the point of notarizing at all. Uploading one is the
 * easiest mistake to make in this flow, so it is refused rather than warned about.
 */
function assertStapled(dmgPaths) {
    if (allowUnstapled) {
        console.warn('Skipping the staple check because --allow-unstapled was passed.');
        return;
    }

    const unstapled = dmgPaths.filter((dmgPath) => {
        const result = spawnSync('xcrun', ['stapler', 'validate', dmgPath], { encoding: 'utf8' });
        return result.error || result.status !== 0;
    });

    if (unstapled.length) {
        fail(
            `Not stapled:\n  ${unstapled.map((p) => path.basename(p)).join('\n  ')}\n`
            + 'Run `npm run submit` and `npm run staple` first, '
            + 'or pass --allow-unstapled to upload anyway.'
        );
    }
}

function upload(filePaths) {
    const args = [
        'release', 'upload', targetTag,
        '--repo', targetRepo,
        '--clobber',
        ...filePaths,
    ];

    console.log(`Uploading to ${targetRepo} (${targetTag}):`);
    for (const filePath of filePaths) console.log(`  ${path.basename(filePath)}`);

    const result = spawnSync('gh', args, { cwd: projectRoot, stdio: 'inherit' });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`gh release upload failed with exit code ${String(result.status)}.`);
    }

    console.log(`Uploaded ${filePaths.length} file(s).`);
}

function main() {
    requireGitHubCli();
    const dmgPaths = productDmgPaths();

    if (process.platform === 'darwin') {
        // Only the disk images are stapled; the zip is verified through the metadata
        // checksum instead, and a blockmap and a yml carry no signature at all.
        assertStapled(dmgPaths);
    } else {
        // stapler only exists on macOS; publishing from elsewhere cannot verify.
        console.warn('Not running on macOS, so the staple check was skipped.');
    }

    const updatePaths = updateChannelPaths();
    if (!updatePaths.some((entry) => entry.endsWith('-mac.yml'))) {
        console.warn(
            'No <channel>-mac.yml found, so this upload carries no auto-update metadata.'
        );
    }

    upload([...dmgPaths, ...updatePaths]);
}

try {
    main();
} catch (error) {
    console.error('[publish-artifacts] Failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
