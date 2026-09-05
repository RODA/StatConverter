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
 * The macOS disk images that are actually present, in a stable order. These are the
 * renamed, human-facing downloads the site links to. Names are deliberately
 * version-free: Gatekeeper builds its reputation per file, so a name that stays the
 * same across releases keeps the trust it has already earned, and published links stay
 * valid.
 */
const productDmgPaths = ({ required = true } = {}) => {
    const nameFile = productFileName();
    const candidates = [
        path.join(outputDir, `${nameFile}_silicon.dmg`),
        path.join(outputDir, `${nameFile}_intel.dmg`),
    ];

    const paths = candidates.filter((candidate) => fs.existsSync(candidate));

    if (required && paths.length === 0) {
        // A build that has not been renamed yet is the usual reason, and it looks
        // identical to no build at all unless the difference is spelled out.
        const unrenamed = fs.existsSync(outputDir)
            ? fs.readdirSync(outputDir).filter((name) => name.endsWith('.dmg'))
            : [];
        const hint = unrenamed.length
            ? `\nFound instead: ${unrenamed.join(', ')}. Run \`npm run rename:mac\` first.`
            : '';
        throw new Error(`Missing built DMG: looked for ${candidates.join(' and ')}.${hint}`);
    }

    return paths;
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
    productDmgPaths,
    productAppPaths,
    productAppPathForArch,
    updateChannelPaths,
    updateChannelMetadataPaths,
    archForChannelMetadata,
};
