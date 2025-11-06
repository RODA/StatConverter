
#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "(p=> (p.build && p.build.productName) ? p.build.productName : p.name)(require('./package.json'))")
# Use a filename-safe variant (replace spaces with underscores)
NAME_FILE=$(printf '%s' "$NAME" | sed 's/[[:space:]]\+/_/g')

# Optional Linux artifacts (if you add Linux target later)
ORIGINAL_LINUX_ARM="build/output/${NAME}-${VERSION}-arm64.AppImage"
NEW_LINUX_ARM="${NAME_FILE}_${VERSION}_silicon.AppImage"

ORIGINAL_LINUX_INTEL="build/output/${NAME}-${VERSION}.AppImage"
NEW_LINUX_INTEL="${NAME_FILE}_${VERSION}_intel.AppImage"

renamed_any=0

if [ -f "$ORIGINAL_LINUX_ARM" ]; then
    echo "Renaming $(basename "$ORIGINAL_LINUX_ARM") -> $NEW_LINUX_ARM"
    mv "$ORIGINAL_LINUX_ARM" "build/output/$NEW_LINUX_ARM"
    renamed_any=1
fi

if [ -f "$ORIGINAL_LINUX_INTEL" ]; then
    echo "Renaming $(basename "$ORIGINAL_LINUX_INTEL") -> $NEW_LINUX_INTEL"
    mv "$ORIGINAL_LINUX_INTEL" "build/output/$NEW_LINUX_INTEL"
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

# Ensure AppImage files are executable
echo "Marking .AppImage files executable in build/output..."
count=0
while IFS= read -r -d '' f; do
    chmod +x "$f" || true
    echo "Made executable: $(basename "$f")"
    count=$((count+1))
done < <(find build/output -maxdepth 1 -type f -name "*.AppImage" -print0)

if [ "$count" -eq 0 ]; then
    echo "No .AppImage files found to make executable."
fi
