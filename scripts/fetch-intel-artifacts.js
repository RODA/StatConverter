#!/usr/bin/env node
/**
 * Downloads the Intel macOS build so it can be notarized alongside the local Apple
 * Silicon one.
 *
 * The Intel lane runs on GitHub, so its artifacts and, more importantly, its unpacked
 * application exist only there. Stapling rebuilds the updater ZIP from the application,
 * so downloading the ZIP is not enough: it has to be expanded into the directory the
 * staple step looks in for an x64 build, which is `build/output/mac`.
 *
 * The source is the staging release, not the download release: the Intel build is
 * signed but not notarized until it has been through this machine.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { appBundleName, outputDir, productFileName, projectRoot } = require('./artifact-paths');

const sourceRepo = String(process.env.SC_PUBLISH_REPO || 'RODA/StatConverter').trim();
const sourceTag = String(process.env.SC_STAGING_TAG || 'macos-intel-staging').trim();
const appDir = path.join(outputDir, 'mac');

function fail(message) {
    throw new Error(message);
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, { cwd: projectRoot, stdio: 'inherit', ...options });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`${command} failed with exit code ${String(result.status)}.`);
    }
}

function requireGitHubCli() {
    const result = spawnSync('gh', ['--version'], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
        fail('The GitHub CLI (gh) is required. Install it and run `gh auth login`.');
    }
}

function requireStagingRelease() {
    const result = spawnSync('gh', ['release', 'view', sourceTag, '--repo', sourceRepo], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
        fail(
            `No ${sourceTag} release in ${sourceRepo}.\n`
            + 'Run the "build MacOS Intel" workflow first; it creates that release and '
            + 'uploads the signed Intel build to it.'
        );
    }
}

function download() {
    const nameFile = productFileName();
    // The blockmap is deliberately absent: staple regenerates it from the rebuilt ZIP.
    const patterns = [
        `${nameFile}_intel.dmg`,
        '*-x64-mac.zip',
        'latest-x64-mac.yml',
    ];

    fs.mkdirSync(outputDir, { recursive: true });

    const args = ['release', 'download', sourceTag, '--repo', sourceRepo, '--dir', outputDir, '--clobber'];
    for (const pattern of patterns) args.push('--pattern', pattern);

    console.log(`Downloading the Intel build from ${sourceRepo} (${sourceTag}, staging):`);
    for (const pattern of patterns) console.log(`  ${pattern}`);
    run('gh', args);
}

function expandApplication() {
    const zipPath = fs.readdirSync(outputDir)
        .filter((name) => /-x64-mac\.zip$/.test(name))
        .map((name) => path.join(outputDir, name))[0];

    if (!zipPath) {
        fail('No Intel updater ZIP was downloaded, so the application cannot be expanded.');
    }

    // A stale application would be stapled and re-zipped in place of the one just
    // downloaded, so the directory is replaced rather than merged into.
    fs.rmSync(appDir, { recursive: true, force: true });
    fs.mkdirSync(appDir, { recursive: true });

    console.log(`Expanding ${path.basename(zipPath)} into ${path.relative(projectRoot, appDir)}`);
    run('ditto', ['-x', '-k', zipPath, appDir]);

    const appPath = path.join(appDir, appBundleName());
    if (!fs.existsSync(appPath)) {
        fail(`Expanding ${path.basename(zipPath)} did not produce ${appPath}.`);
    }

    console.log(`Ready: ${path.relative(projectRoot, appPath)}`);
}

function main() {
    if (process.platform !== 'darwin') {
        fail('The Intel macOS build can only be prepared for notarization on macOS.');
    }

    requireGitHubCli();
    requireStagingRelease();
    download();
    expandApplication();

    console.log('');
    console.log('Both architectures are now present. Next: npm run submit, then npm run staple.');
}

try {
    main();
} catch (error) {
    console.error('[fetch-intel-artifacts] Failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
