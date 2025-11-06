# Get name and version from package.json
$packageJson = Get-Content "./package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version
$name = if ($packageJson.build -and $packageJson.build.productName) { $packageJson.build.productName } else { $packageJson.name }

# Normalize name used in filenames (avoid spaces in file names we create)
$nameForFile = ($name -replace "\s+", "_")

# Define original and new file names (installer)
$originalFile = "build/output/${name} Setup $version.exe"
$newName = "${nameForFile}_setup_${version}.exe"
$newPath = "build/output/$newName"

# Rename if file exists
if (Test-Path $originalFile) {
    Rename-Item -Path $originalFile -NewName $newName
    Write-Host "Renamed to $newName"
} else {
    Write-Error "Original file not found: $originalFile"
    exit 1
} 

# Also remove update metadata artifacts we don't want to ship alongside the installer
$artifactDir = "build/output"
$patterns = @("*.yml", "*.yaml", "*.blockmap")

foreach ($pattern in $patterns) {
    $files = Get-ChildItem -Path $artifactDir -Filter $pattern -File -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        try {
            Remove-Item -Path $f.FullName -Force -ErrorAction Stop
            Write-Host "Removed: $($f.Name)"
        } catch {
            Write-Warning "Could not remove: $($f.Name) - $($_.Exception.Message)"
        }
    }
}

# Hide all files in win-unpacked except the executable, resources, and licenses
$unpackedDir = "build/output/win-unpacked"
if (Test-Path -LiteralPath $unpackedDir) {
    # Items to keep visible
    $exeName = "${name}.exe"
    $keep = @(
        $exeName,
        "resources",
        "LICENSES.chromium.html",
        "LICENSE.electron.txt"
    )

    function Set-Hidden {
        param(
            [Parameter(Mandatory = $true)]
            [string] $Path
        )

        try {
            $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
            $attrs = $item.Attributes
            $newAttrs = $attrs -bor [IO.FileAttributes]::Hidden
            if ($attrs -ne $newAttrs) {
                Set-ItemProperty -LiteralPath $Path -Name Attributes -Value $newAttrs -ErrorAction Stop
            }
            Write-Host "Hidden: $Path"
        } catch {
            Write-Warning "Failed to hide: $Path - $($_.Exception.Message)"
        }
    }

    # Hide everything in win-unpacked except the allowed items
    $children = Get-ChildItem -LiteralPath $unpackedDir -Force -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        if ($keep -notcontains $child.Name) {
            Set-Hidden -Path $child.FullName
        }
    }

    # Additionally hide resources/assets and resources/page if present
    $resourcesDir = Join-Path -Path $unpackedDir -ChildPath "resources"
    foreach ($sub in @("assets", "page")) {
        $subPath = Join-Path -Path $resourcesDir -ChildPath $sub
        if (Test-Path -LiteralPath $subPath) {
            Set-Hidden -Path $subPath
        }
    }
} else {
    Write-Warning "Unpacked directory not found: $unpackedDir"
}

# Finally, rename win-unpacked to NAME_VERSION (NAME from build.productName or package name)
$finalDirName = "${name}_${version}"
$finalDirPath = Join-Path -Path "build/output" -ChildPath $finalDirName

if (Test-Path -LiteralPath $unpackedDir) {
    if (Test-Path -LiteralPath $finalDirPath) {
        Write-Warning "Target directory already exists: $finalDirPath"
    } else {
        try {
            Rename-Item -LiteralPath $unpackedDir -NewName $finalDirName -ErrorAction Stop
            Write-Host "Renamed directory to: $finalDirName"
        } catch {
            Write-Error "Failed to rename directory: $($_.Exception.Message)"
            exit 1
        }
    }
}

# Zip the renamed directory (NAME_VERSION) as NAME_VERSION.zip in build/output
if (Test-Path -LiteralPath $finalDirPath) {
    $zipPath = Join-Path -Path "build/output" -ChildPath ("{0}.zip" -f $finalDirName)
    try {
        if (Test-Path -LiteralPath $zipPath) {
            try {
                Remove-Item -LiteralPath $zipPath -Force -ErrorAction Stop
                Write-Host "Removed existing archive: $zipPath"
            } catch {
                Write-Warning "Could not remove existing archive: $zipPath - $($_.Exception.Message)"
            }
        }

        # Create the archive so that the top-level folder inside the zip is NAME_VERSION
        Push-Location "build/output"
        try {
            Compress-Archive -Path $finalDirName -DestinationPath ("{0}.zip" -f $finalDirName) -Force -ErrorAction Stop
        } finally {
            Pop-Location
        }
        Write-Host "Created archive: $zipPath"
    } catch {
        Write-Warning "Failed to create zip archive: $($_.Exception.Message)"
    }
} else {
    Write-Warning "Final directory not found for zipping: $finalDirPath"
}
