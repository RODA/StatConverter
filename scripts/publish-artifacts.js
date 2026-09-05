#!/usr/bin/env node
/** Uploads the notarized macOS disk images and update channel to the download release. */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { projectRoot, productDmgPaths, updateChannelPaths } = require('./artifact-paths');

const targetRepo = String(process.env.SC_PUBLISH_REPO || 'RODA/StatConverter').trim();
const targetTag = String(process.env.SC_PUBLISH_TAG || 'latest').trim();

const args = process.argv.slice(2);
const allowUnstapled = args.includes('--allow-unstapled');
// Says what would be uploaded, and where, without uploading it. The upload is the one
// step of the release that cannot be taken back quietly, so it is worth being able to
// look at the list first.
const dryRun = args.includes('--dry-run');

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
    const uploadArgs = [
        'release', 'upload', targetTag,
        '--repo', targetRepo,
        '--clobber',
        ...filePaths,
    ];

    console.log(`${dryRun ? 'Would upload' : 'Uploading'} to ${targetRepo} (${targetTag}):`);
    for (const filePath of filePaths) {
        const { size } = fs.statSync(filePath);
        console.log(`  ${path.basename(filePath)} (${(size / 1e6).toFixed(1)} MB)`);
    }

    if (dryRun) {
        console.log('Dry run: nothing was uploaded.');
        return;
    }

    const result = spawnSync('gh', uploadArgs, { cwd: projectRoot, stdio: 'inherit' });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`gh release upload failed with exit code ${String(result.status)}.`);
    }

    console.log(`Uploaded ${filePaths.length} file(s).`);
}

/**
 * Projects what the download release will hold after this upload, and checks the links
 * the site actually publishes against it.
 *
 * A missing asset is invisible from here: the upload succeeds, and the first sign of
 * trouble is a 404 for someone downloading. Links inside HTML comments are ignored —
 * those are retired downloads the page keeps for reference.
 */
function reportPageLinks(filePaths) {
    const pagePath = path.join(projectRoot, 'docs', 'download.html');
    if (!fs.existsSync(pagePath)) return;

    const page = fs.readFileSync(pagePath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const linked = [...page.matchAll(/releases\/download\/[^/]+\/([^?"']+)/g)].map((match) => match[1]);
    if (!linked.length) return;

    let existing = [];
    const result = spawnSync(
        'gh',
        ['release', 'view', targetTag, '--repo', targetRepo, '--json', 'assets'],
        { encoding: 'utf8' }
    );

    if (result.status === 0) {
        try {
            existing = JSON.parse(result.stdout).assets.map((asset) => asset.name);
        } catch {
            // A release that cannot be read is reported below as unknown, not as broken.
        }
    }

    const after = new Set([...existing, ...filePaths.map((filePath) => path.basename(filePath))]);
    const missing = linked.filter((name) => !after.has(name));

    console.log('');
    console.log(`Links on the download page, against ${targetRepo} (${targetTag}) after this upload:`);
    for (const name of linked) console.log(`  ${after.has(name) ? 'ok     ' : 'MISSING'}  ${name}`);

    if (missing.length) {
        console.log('');
        console.log(`${missing.length} link(s) would 404. Publish those files or fix the page.`);
    }
}

function main() {
    requireGitHubCli();
    const dmgPaths = productDmgPaths();

    if (dryRun && !allowUnstapled) {
        console.log('Dry run: checking the disk images are stapled before listing them.');
    }

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

    const filePaths = [...dmgPaths, ...updatePaths];
    upload(filePaths);

    if (dryRun) reportPageLinks(filePaths);
}

try {
    main();
} catch (error) {
    console.error('[publish-artifacts] Failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
