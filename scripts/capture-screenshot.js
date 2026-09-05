#!/usr/bin/env node
/**
 * Launches the packaged app and replaces the screenshot on the site with a fresh one.
 *
 * The image on the download page shows the version in the sidebar, so it goes stale
 * every release. This captures the window the way the old image was captured — through
 * `screencapture`, which keeps the macOS title bar, rounded corners and drop shadow.
 * Electron's own `capturePage` would only give the web contents, which looks nothing
 * like the picture the site has always shown.
 *
 * macOS only, and it needs Screen Recording permission for whatever terminal runs it.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { appBundleName, outputDir, productName, projectRoot } = require('./artifact-paths');

const DEFAULT_OUTPUT = path.join(projectRoot, 'docs', 'images', 'StatConverter.png');
// The window is fixed at 800x550 in main.ts; the capture is that, scaled by the
// display, plus the margin the shadow occupies.
const WINDOW_POLL_TIMEOUT_MS = 60000;
const WINDOW_POLL_INTERVAL_MS = 250;

function fail(message) {
    throw new Error(message);
}

function parseArgs(argv) {
    const options = { app: '', out: DEFAULT_OUTPUT, delay: 2.5, shadow: true };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--app') options.app = String(argv[++index] || '');
        else if (arg === '--out') options.out = path.resolve(String(argv[++index] || ''));
        else if (arg === '--delay') options.delay = Number(argv[++index]);
        else if (arg === '--no-shadow') options.shadow = false;
        else fail(`Unknown argument: ${arg}`);
    }

    if (!Number.isFinite(options.delay) || options.delay < 0) {
        fail('--delay must be a number of seconds.');
    }

    return options;
}

/** The packaged application to photograph: the local build, silicon first. */
function resolveAppExecutable(explicit) {
    if (explicit) {
        const bundle = path.resolve(explicit);
        if (!fs.existsSync(bundle)) fail(`No application bundle at ${bundle}.`);
        return { bundle, executable: bundleExecutable(bundle) };
    }

    const bundle = ['mac-arm64', 'mac', 'mac-universal']
        .map((directory) => path.join(outputDir, directory, appBundleName()))
        .find((candidate) => fs.existsSync(candidate));

    if (!bundle) {
        fail(
            'No packaged application found under build/output.\n'
            + 'Run `npm run dist` (or `npm run dist:sign`) first, or pass --app <path to .app>.'
        );
    }

    return { bundle, executable: bundleExecutable(bundle) };
}

/**
 * The binary inside a .app. The product name is the expected one, but a bundle passed
 * with --app need not be this product, so a single-entry MacOS directory decides.
 */
function bundleExecutable(bundle) {
    const macOSDir = path.join(bundle, 'Contents', 'MacOS');
    if (!fs.existsSync(macOSDir)) fail(`${bundle} has no Contents/MacOS directory.`);

    const expected = path.join(macOSDir, productName());
    if (fs.existsSync(expected)) return expected;

    const entries = fs.readdirSync(macOSDir).filter((name) => !name.startsWith('.'));
    if (entries.length !== 1) {
        fail(`Cannot tell which binary to run in ${macOSDir}: ${entries.join(', ') || '(empty)'}`);
    }

    return path.join(macOSDir, entries[0]);
}

// Window owner names are ambiguous — a development build is owned by "Electron" — so the
// window is matched on the process id of the app this script started. CoreGraphics is
// not in JXA's bridge by default, hence bindFunction.
const WINDOW_LOOKUP_JS = `
ObjC.import('Foundation');
ObjC.bindFunction('CGWindowListCopyWindowInfo', ['id', ['unsigned int', 'unsigned int']]);
function run(argv) {
    var pid = Number(argv[0]);
    var windows = ObjC.deepUnwrap($.CGWindowListCopyWindowInfo(0x1 | 0x10, 0)) || [];
    var match = windows.filter(function (window) {
        return Number(window.kCGWindowOwnerPID) === pid
            && Number(window.kCGWindowLayer) === 0
            && Number((window.kCGWindowBounds || {}).Width) > 0;
    })[0];
    if (!match) return '';
    var bounds = match.kCGWindowBounds || {};
    return [match.kCGWindowNumber, bounds.Width, bounds.Height].join(' ');
}
`;

function findWindow(pid) {
    const result = spawnSync(
        'osascript',
        ['-l', 'JavaScript', '-e', WINDOW_LOOKUP_JS, String(pid)],
        { encoding: 'utf8' }
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`Could not list windows:\n${String(result.stderr || '').trim()}`);
    }

    const parts = String(result.stdout || '').trim().split(/\s+/);
    if (parts.length < 3 || !parts[0]) return null;

    return { id: parts[0], width: Math.round(Number(parts[1])), height: Math.round(Number(parts[2])) };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A path relative to the project, unless that would be a climb out of it. */
const describe = (target) => {
    const relative = path.relative(projectRoot, target);
    return relative.startsWith('..') ? target : relative;
};

async function waitForWindow(pid) {
    const deadline = Date.now() + WINDOW_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const window = findWindow(pid);
        if (window) return window;
        await wait(WINDOW_POLL_INTERVAL_MS);
    }

    fail(
        `No window appeared within ${WINDOW_POLL_TIMEOUT_MS / 1000}s. `
        + 'The app may have failed to start; try launching it by hand.'
    );
}

/** Width and height straight out of the PNG header, so the log says what was written. */
function pngSize(filePath) {
    const header = Buffer.alloc(24);
    const handle = fs.openSync(filePath, 'r');
    try {
        fs.readSync(handle, header, 0, 24, 0);
    } finally {
        fs.closeSync(handle);
    }

    if (header.subarray(1, 4).toString('ascii') !== 'PNG') return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function capture(windowId, targetPath, withShadow) {
    const args = ['-x'];
    if (!withShadow) args.push('-o');
    args.push('-l', String(windowId), targetPath);

    const result = spawnSync('screencapture', args, { encoding: 'utf8' });
    if (result.error) throw result.error;

    if (result.status !== 0 || !fs.existsSync(targetPath)) {
        const message = String(result.stderr || result.stdout || '').trim();
        fail(
            `screencapture failed${message ? `: ${message}` : '.'}\n`
            + 'If it could not create an image from the window, grant Screen Recording '
            + 'permission to the terminal running this script in System Settings > '
            + 'Privacy & Security > Screen Recording, then run it again.'
        );
    }
}

async function quit(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;

    child.kill('SIGTERM');

    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (child.exitCode !== null || child.signalCode !== null) return;
        await wait(100);
    }

    child.kill('SIGKILL');
}

async function main() {
    if (process.platform !== 'darwin') {
        fail('The site screenshot is a macOS window capture, so it has to be taken on macOS.');
    }

    const options = parseArgs(process.argv.slice(2));
    const { bundle, executable } = resolveAppExecutable(options.app);

    console.log(`Launching ${describe(bundle)}`);
    const child = spawn(executable, [], { stdio: 'ignore' });
    child.on('error', (error) => fail(`Could not start the app: ${error.message}`));

    const temporaryPath = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), 'statconverter-shot-')),
        'StatConverter.png'
    );

    try {
        const window = await waitForWindow(child.pid);
        console.log(`Window ${window.id} is up at ${window.width}x${window.height} points.`);

        // The window exists before the renderer has painted it, and a capture taken then
        // shows an empty frame.
        console.log(`Waiting ${options.delay}s for the interface to settle.`);
        await wait(options.delay * 1000);

        capture(window.id, temporaryPath, options.shadow);
    } finally {
        await quit(child);
    }

    const size = pngSize(temporaryPath);
    if (!size) fail(`${temporaryPath} is not a PNG.`);

    fs.mkdirSync(path.dirname(options.out), { recursive: true });
    // Only now is the published image replaced: a failed capture leaves it untouched.
    fs.copyFileSync(temporaryPath, options.out);
    fs.rmSync(path.dirname(temporaryPath), { recursive: true, force: true });

    console.log(`Wrote ${describe(options.out)} (${size.width}x${size.height}).`);
    console.log('Check it before committing: the sidebar should show the new version.');
}

main().catch((error) => {
    console.error('[capture-screenshot] Failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
