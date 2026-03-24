$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $workspaceRoot "vendor"
$repoRoot = Join-Path $vendorRoot "godot_voxel"
$repoUrl = "https://github.com/Zylann/godot_voxel.git"

if (-not (Test-Path $vendorRoot)) {
    New-Item -ItemType Directory -Path $vendorRoot | Out-Null
}

if (-not (Test-Path $repoRoot)) {
    git clone --depth 1 $repoUrl $repoRoot
} else {
    git -C $repoRoot fetch --depth 1 origin master
    git -C $repoRoot reset --hard origin/master
}

$commit = git -C $repoRoot rev-parse HEAD
$date = git -C $repoRoot log -1 --format=%cI

Write-Host "Voxel-Tools-Doku aktualisiert."
Write-Host "Pfad: $repoRoot"
Write-Host "Commit: $commit"
Write-Host "Datum: $date"
