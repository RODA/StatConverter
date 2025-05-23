#!/bin/bash

VERSION=$(node -p "require('./package.json').version")
ARCH=$(uname -m)
PLATFORM=$(uname -s)

if [ "$PLATFORM" = "Darwin" ]; then
    # macOS section
    if [ "$ARCH" = "arm64" ]; then
        NEW_NAME="StatConverter_${VERSION}_silicon.dmg"
    elif [ "$ARCH" = "x86_64" ]; then
        NEW_NAME="StatConverter_${VERSION}_intel.dmg"
    else
        echo "Unknown macOS architecture: $ARCH"
        exit 1
    fi
    ORIGINAL_FILE="build/output/StatConverter-${VERSION}.dmg"

elif [ "$PLATFORM" = "Linux" ]; then
    # Linux section
    if [ "$ARCH" = "x86_64" ]; then
        NEW_NAME="StatConverter_${VERSION}_intel.AppImage"
    elif [ "$ARCH" = "aarch64" ]; then
        NEW_NAME="StatConverter_${VERSION}_arm.AppImage"
    else
        echo "Unknown Linux architecture: $ARCH"
        exit 1
    fi
    ORIGINAL_FILE="build/output/StatConverter-${VERSION}.AppImage"

else
    echo "Unsupported platform: $PLATFORM"
    exit 1
fi

# Rename if file exists
if [ -f "$ORIGINAL_FILE" ]; then
    mv "$ORIGINAL_FILE" "build/output/$NEW_NAME"
    echo "Renamed to $NEW_NAME"
else
    echo "Original file not found: $ORIGINAL_FILE"
    exit 1
fi