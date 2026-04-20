
#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./scripts/version-info').getVersionInfo().rawVersion")
NORMALIZED_VERSION=$(node -p "require('./scripts/version-info').getVersionInfo().normalizedVersion")
NAME=$(node -p "(p=> (p.build && p.build.productName) ? p.build.productName : p.name)(require('./package.json'))")
# Use a filename-safe variant (replace spaces with underscores)
NAME_FILE=$(printf '%s' "$NAME" | sed 's/[[:space:]]\+/_/g')

# Expected electron-builder outputs (current config produces mac DMGs).
# electron-builder canonicalizes 1.3.03 to 1.3.3, so match against the normalized version
# and rename to the exact package.json version.
ORIGINAL_APPLE_ARM="build/output/${NAME}-${NORMALIZED_VERSION}-arm64.dmg"
NEW_APPLE_ARM="${NAME_FILE}_${VERSION}_silicon.dmg"

ORIGINAL_APPLE_INTEL="build/output/${NAME}-${NORMALIZED_VERSION}.dmg"
NEW_APPLE_INTEL="${NAME_FILE}_${VERSION}_intel.dmg"

renamed_any=0

if [ -f "$ORIGINAL_APPLE_ARM" ]; then
    echo "Renaming $(basename "$ORIGINAL_APPLE_ARM") -> $NEW_APPLE_ARM"
    mv "$ORIGINAL_APPLE_ARM" "build/output/$NEW_APPLE_ARM"
    renamed_any=1
fi

if [ -f "$ORIGINAL_APPLE_INTEL" ]; then
    echo "Renaming $(basename "$ORIGINAL_APPLE_INTEL") -> $NEW_APPLE_INTEL"
    mv "$ORIGINAL_APPLE_INTEL" "build/output/$NEW_APPLE_INTEL"
    renamed_any=1
fi

if [ "$renamed_any" -eq 0 ]; then
    echo "No matching artifacts found to rename in build/output for version $VERSION." >&2
fi

# Clean up auxiliary files we don't want to distribute
echo "Cleaning up .yml, .yaml, and .blockmap files in build/output..."
for f in build/output/*; do
    if [ -f "$f" ]; then
        case "$f" in
            *.yml|*.yaml|*.blockmap)
                echo "Removing $(basename "$f")"
                rm -f "$f"
                ;;
        esac
    fi
done
