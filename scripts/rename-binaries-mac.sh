#!/usr/bin/env bash
# Renames macOS disk images to stable, human-facing download names.
#
# The names carry no version on purpose. Gatekeeper and SmartScreen build their
# reputation per file, so a name that stays the same across releases keeps the trust it
# has already earned, and the download page never needs re-linking.

set -euo pipefail

VERSION=$(node -p "require('./scripts/version-info').getVersionInfo().rawVersion")
NORMALIZED_VERSION=$(node -p "require('./scripts/version-info').getVersionInfo().normalizedVersion")
NAME=$(node -p "(p=> (p.build && p.build.productName) ? p.build.productName : p.name)(require('./package.json'))")
# Use a filename-safe variant (replace spaces with underscores)
NAME_FILE=$(printf '%s' "$NAME" | sed 's/[[:space:]]\+/_/g')

# mac.artifactName pins the architecture into every macOS artifact name, so both
# architectures are labelled rather than x64 being identified by the absence of a
# suffix. electron-builder canonicalizes a version like 1.3.03 to 1.3.3, so the built
# files are matched on the normalized version, then renamed to a version-free name. The
# glob fallback means a naming change upstream surfaces as an unrenamed file rather than
# as a rename that silently did nothing.
find_dmg() {
    arch="$1"
    expected="build/output/${NAME}-${NORMALIZED_VERSION}-${arch}-mac.dmg"
    if [ -f "$expected" ]; then
        printf '%s' "$expected"
        return
    fi
    found=$(find build/output -maxdepth 1 -type f -name "*-${arch}-mac.dmg" | head -n 1)
    if [ -n "$found" ]; then
        echo "Expected $expected; using $found instead." >&2
        printf '%s' "$found"
    fi
}

ORIGINAL_APPLE_ARM=$(find_dmg arm64)
NEW_APPLE_ARM="${NAME_FILE}_silicon.dmg"

ORIGINAL_APPLE_INTEL=$(find_dmg x64)
NEW_APPLE_INTEL="${NAME_FILE}_intel.dmg"

renamed_any=0

if [ -n "$ORIGINAL_APPLE_ARM" ] && [ -f "$ORIGINAL_APPLE_ARM" ]; then
    echo "Renaming $(basename "$ORIGINAL_APPLE_ARM") -> $NEW_APPLE_ARM"
    mv "$ORIGINAL_APPLE_ARM" "build/output/$NEW_APPLE_ARM"
    renamed_any=1
fi

if [ -n "$ORIGINAL_APPLE_INTEL" ] && [ -f "$ORIGINAL_APPLE_INTEL" ]; then
    echo "Renaming $(basename "$ORIGINAL_APPLE_INTEL") -> $NEW_APPLE_INTEL"
    mv "$ORIGINAL_APPLE_INTEL" "build/output/$NEW_APPLE_INTEL"
    renamed_any=1
fi

if [ "$renamed_any" -eq 0 ]; then
    echo "No matching artifacts found to rename in build/output for version $VERSION." >&2
fi

# The ZIP, its blockmap, and the matching per-architecture metadata form the macOS
# update channel: auto-update reads <channel>-mac.yml and downloads the ZIP named in it,
# so those keep the names electron-builder recorded. Only the disk image is renamed,
# because that is the human-facing download.
echo "Cleaning up auxiliary files in build/output (keeping update metadata)..."
for f in build/output/*; do
    if [ -f "$f" ]; then
        case "$f" in
            *-mac.yml|*.zip.blockmap)
                : # part of the update channel
                ;;
            *.yml|*.yaml|*.blockmap)
                echo "Removing $(basename "$f")"
                rm -f "$f"
                ;;
        esac
    fi
done
