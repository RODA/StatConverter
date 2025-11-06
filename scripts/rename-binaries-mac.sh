
#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "(p=> (p.build && p.build.productName) ? p.build.productName : p.name)(require('./package.json'))")
# Use a filename-safe variant (replace spaces with underscores)
NAME_FILE=$(printf '%s' "$NAME" | sed 's/[[:space:]]\+/_/g')

# Expected electron-builder outputs (current config produces mac DMGs)
ORIGINAL_APPLE_ARM="build/output/${NAME}-${VERSION}-arm64.dmg"
NEW_APPLE_ARM="${NAME_FILE}_${VERSION}_silicon.dmg"

ORIGINAL_APPLE_INTEL="build/output/${NAME}-${VERSION}.dmg"
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
