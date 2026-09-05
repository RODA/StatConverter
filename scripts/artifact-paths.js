/**
 * Resolves the built macOS artifact names, so everything that has to find them agrees
 * on one convention. The rename script produces these names and the notarization and
 * publish steps consume them; when two places each carried their own copy of the
 * convention, they drifted and a mismatch went unnoticed.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'build', 'output');

const productName = () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    return String((pkg.build && pkg.build.productName) || pkg.name || 'StatConverter').trim();
};

/** The product name as it appears in a file name: spaces collapsed to underscores. */
const productFileName = () => productName().replace(/\s+/g, '_');

const appBundleName = () => `${productName()}.app`;

/**
 * The two architectures a release carries, by the word that names their disk image.
 * `silicon` is built locally, `intel` comes back from CI through `npm run fetch:intel`.
 */
const DMG_LABELS = ['silicon', 'intel'];

const LABEL_RECOVERY = {
    silicon: 'build it with `npm run dist:sign`, then run `npm run rename:mac`',
    intel: 'fetch it with `npm run fetch:intel`',
};

/** Where one architecture's renamed disk image belongs, present or not. */
const productDmgPath = (label) => path.join(outputDir, `${productFileName()}_${label}.dmg`);

/**
 * The macOS disk images, in a stable order. These are the renamed, human-facing
 * downloads the site links to. Names are deliberately version-free: Gatekeeper builds
 * its reputation per file, so a name that stays the same across releases keeps the
 * trust it has already earned, and published links stay valid.
 *
 * Both architectures are required by default. Notarizing, stapling and publishing are
 * all meant to cover a whole release, and a half-present set does not announce itself:
 * it notarizes one architecture, then fails much later when the other has no ticket.
 */
const productDmgPaths = ({ required = true, labels = DMG_LABELS } = {}) => {
    const wanted = labels.filter((label) => DMG_LABELS.includes(label));
    const paths = wanted.map(productDmgPath);
    const missing = paths.filter((candidate) => !fs.existsSync(candidate));

    if (required && missing.length) {
        // A build that has not been renamed yet is the usual reason, and it looks
        // identical to an absent build unless the difference is spelled out.
        const present = fs.existsSync(outputDir)
            ? fs.readdirSync(outputDir).filter((name) => name.endsWith('.dmg'))
            : [];

        const lines = missing.map((candidate) => {
            const label = wanted[paths.indexOf(candidate)];
            return `  ${path.basename(candidate)} — ${LABEL_RECOVERY[label]}`;
        });

        throw new Error(
            `Missing disk image(s):\n${lines.join('\n')}\n`
            + `In build/output: ${present.length ? present.join(', ') : 'no .dmg at all'}`
        );
    }

    return paths.filter((candidate) => fs.existsSync(candidate));
};

/**
 * The macOS auto-update channel: the per-architecture metadata file, the zip it points
 * at, and that zip's blockmap. These keep the names electron-builder gave them, because
 * the metadata records those names and their checksums; renaming any of them breaks
 * updating. Only the disk image is renamed for humans.
 */
const updateChannelPaths = () => {
    if (!fs.existsSync(outputDir)) return [];

    return fs.readdirSync(outputDir)
        .filter((name) => /-mac\.yml$/.test(name) || /-mac\.zip$/.test(name) || /-mac\.zip\.blockmap$/.test(name))
        .sort()
        .map((name) => path.join(outputDir, name));
};

/** The per-architecture auto-update metadata files, `<channel>-mac.yml`. */
const updateChannelMetadataPaths = () => updateChannelPaths().filter((candidate) => candidate.endsWith('-mac.yml'));

/** The architecture a `<channel>-mac.yml` belongs to, from the channel its build set. */
const archForChannelMetadata = (channelPath) => {
    const match = /^latest-([a-z0-9_]+)-mac\.yml$/i.exec(path.basename(channelPath));
    return match ? match[1].toLowerCase() : null;
};

/** The unpacked application bundles electron-builder left behind, one per architecture. */
const productAppPaths = () => {
    if (!fs.existsSync(outputDir)) return [];

    return fs.readdirSync(outputDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
        .map((entry) => path.join(outputDir, entry.name, appBundleName()))
        .filter((candidate) => fs.existsSync(candidate));
};

/**
 * The unpacked application for one architecture. electron-builder names the directory
 * after the architecture except for x64, which gets a bare `mac`. Pairing has to be
 * exact: rebuilding one architecture's updater ZIP from another's application would
 * hand those users a binary that cannot run.
 */
const productAppPathForArch = (arch) => {
    const directories = {
        arm64: 'mac-arm64',
        x64: 'mac',
        universal: 'mac-universal',
    };
    const directory = directories[arch];
    if (!directory) return null;

    const candidate = path.join(outputDir, directory, appBundleName());
    return fs.existsSync(candidate) ? candidate : null;
};

module.exports = {
    projectRoot,
    outputDir,
    productName,
    productFileName,
    appBundleName,
    DMG_LABELS,
    productDmgPath,
    productDmgPaths,
    productAppPaths,
    productAppPathForArch,
    updateChannelPaths,
    updateChannelMetadataPaths,
    archForChannelMetadata,
};
