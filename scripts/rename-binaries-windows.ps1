# Get version from package.json
$packageJson = Get-Content "./package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version

# Define original and new file names
$originalFile = "build/output/StatConverter Setup $version.exe"
$newName = "StatConverter_setup_${version}.exe"
$newPath = "build/output/$newName"

# Rename if file exists
if (Test-Path $originalFile) {
    Rename-Item -Path $originalFile -NewName $newName
    Write-Host "Renamed to $newName"
} else {
    Write-Error "Original file not found: $originalFile"
    exit 1
}