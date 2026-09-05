#!/usr/bin/env node
/**
 * Checks every Mach-O file in the packaged macOS app against the three things Apple
 * requires before it will notarize a submission: a Developer ID Application signature,
 * an enabled hardened runtime, and a secure timestamp.
 *
 * This exists because `codesign --verify --deep --strict` does not answer the question.
 * That verifies signature integrity, so an ad-hoc signature passes it happily — and the
 * bundled R runtime is ad-hoc signed during relocation, because `install_name_tool`
 * invalidates whatever signature a binary arrived with. Catching an unsigned nested
 * binary here costs one build; catching it at the notary costs a submission round-trip
 * per attempt.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { appBundleName, outputDir } = require('./artifact-paths');

// Thin and fat Mach-O magic numbers, big and little endian.
const MACH_O_MAGICS = new Set([
    'feedface', 'cefaedfe', // 32-bit
    'feedfacf', 'cffaedfe', // 64-bit
    'cafebabe', 'bebafeca', // universal
]);

const HARDENED_RUNTIME_FLAG = 0x10000;

const findPackagedApp = () => {
    const explicit = process.argv[2];
    if (explicit) return path.resolve(explicit);

    if (!fs.existsSync(outputDir)) {
        throw new Error(`No build output directory at ${outputDir}.`);
    }

    const bundle = appBundleName();
    const found = fs.readdirSync(outputDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(outputDir, entry.name, bundle))
        .find((candidate) => fs.existsSync(candidate));

    if (!found) {
        throw new Error(`No ${bundle} found under ${outputDir}.`);
    }
    return found;
};

const FAT_MAGICS = new Set(['cafebabe', 'bebafeca']);
const MAX_PLAUSIBLE_FAT_ARCHES = 32;

const isMachO = (filePath) => {
    let handle;
    try {
        handle = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(8);
        const read = fs.readSync(handle, buffer, 0, 8, 0);
        if (read < 4) return false;

        const magic = buffer.subarray(0, 4).toString('hex');
        if (!MACH_O_MAGICS.has(magic)) return false;
        if (!FAT_MAGICS.has(magic)) return true;

        // Java class files open with the same 0xCAFEBABE magic as a universal binary.
        // The next field tells them apart: in a fat Mach-O it is the architecture count,
        // which is single digits in practice, while in a class file it is the version
        // pair, never below 45.
        if (read < 8) return false;
        const archCount = magic === 'cafebabe'
            ? buffer.readUInt32BE(4)
            : buffer.readUInt32LE(4);
        return archCount >= 1 && archCount <= MAX_PLAUSIBLE_FAT_ARCHES;
    } catch {
        return false;
    } finally {
        if (handle !== undefined) fs.closeSync(handle);
    }
};

const collectMachOFiles = (root) => {
    const found = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            // Symlinks are skipped: their target is inspected at its real location, and
            // following them inside a framework produces duplicate reports.
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && isMachO(full)) {
                found.push(full);
            }
        }
    };
    walk(root);
    return found;
};

const inspectSignature = (filePath) => {
    // codesign writes its description to stderr.
    const result = spawnSync('codesign', ['-dvvv', filePath], { encoding: 'utf8' });
    const output = `${result.stdout || ''}${result.stderr || ''}`;

    if (/code object is not signed at all/.test(output)) {
        return { signed: false, adhoc: false, authority: '', hardened: false, timestamp: false };
    }

    const authorityMatch = output.match(/^Authority=(.+)$/m);
    const flagsMatch = output.match(/flags=0x([0-9a-f]+)/i);
    const flags = flagsMatch ? parseInt(flagsMatch[1], 16) : 0;

    return {
        signed: true,
        adhoc: /Signature=adhoc/.test(output),
        authority: authorityMatch ? authorityMatch[1].trim() : '',
        hardened: (flags & HARDENED_RUNTIME_FLAG) !== 0,
        // "Timestamp=" is the secure Apple timestamp; "Signed Time=" is the local clock
        // and does not satisfy the notary.
        timestamp: /^Timestamp=/m.test(output),
    };
};

const main = () => {
    if (process.platform !== 'darwin') {
        throw new Error('macOS signing verification must run on macOS.');
    }

    const appPath = findPackagedApp();
    const machOFiles = collectMachOFiles(appPath);
    if (!machOFiles.length) {
        throw new Error(`No Mach-O files found in ${appPath}; the bundle looks wrong.`);
    }

    const problems = { unsigned: [], adhoc: [], notDeveloperId: [], noHardenedRuntime: [], noTimestamp: [] };

    for (const filePath of machOFiles) {
        const relative = path.relative(appPath, filePath);
        const info = inspectSignature(filePath);

        if (!info.signed) {
            problems.unsigned.push(relative);
            continue;
        }
        if (info.adhoc) {
            problems.adhoc.push(relative);
            continue;
        }
        if (!/^Developer ID Application:/.test(info.authority)) {
            problems.notDeveloperId.push(`${relative} (${info.authority || 'no authority'})`);
        }
        if (!info.hardened) problems.noHardenedRuntime.push(relative);
        if (!info.timestamp) problems.noTimestamp.push(relative);
    }

    console.log(`[verify-macos-signing] Inspected ${machOFiles.length} Mach-O files in ${appPath}.`);

    const sections = [
        ['not signed at all', problems.unsigned],
        ['ad-hoc signed (not a Developer ID signature)', problems.adhoc],
        ['signed by something other than Developer ID Application', problems.notDeveloperId],
        ['missing the hardened runtime', problems.noHardenedRuntime],
        ['missing a secure timestamp', problems.noTimestamp],
    ].filter(([, entries]) => entries.length);

    if (!sections.length) {
        console.log('[verify-macos-signing] Every Mach-O file is ready for notarization.');
        return;
    }

    const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);
    for (const [label, entries] of sections) {
        const heading = `${entries.length} file(s) ${label}:`;
        console.error(isGitHubActions ? `::error::${heading}` : heading);
        // Long lists are dominated by one underlying cause, so a sample is enough to act
        // on while keeping the log readable.
        for (const entry of entries.slice(0, 20)) console.error(`  ${entry}`);
        if (entries.length > 20) console.error(`  ... and ${entries.length - 20} more`);
    }

    throw new Error('The packaged app is not ready for notarization.');
};

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error('[verify-macos-signing] Failed.');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

module.exports = { isMachO, inspectSignature, collectMachOFiles };
