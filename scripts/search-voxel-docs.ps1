param(
    [Parameter(Mandatory = $true)]
    [string]$Query,
    [ValidateSet("all", "guides", "api", "specs", "classes", "readme")]
    [string]$Section = "all"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Join-Path $workspaceRoot "vendor\\godot_voxel"

if (-not (Test-Path $repoRoot)) {
    throw "Repo nicht gefunden: $repoRoot. Zuerst scripts/update-voxel-docs.ps1 ausführen."
}

$files = switch ($Section) {
    "guides" { Get-ChildItem -Path "$repoRoot\\doc\\source" -File -Filter *.md }
    "api" { Get-ChildItem -Path "$repoRoot\\doc\\source\\api" -File -Filter *.md }
    "specs" { Get-ChildItem -Path "$repoRoot\\doc\\source\\specs" -File -Filter *.md }
    "classes" { Get-ChildItem -Path "$repoRoot\\doc\\classes" -File -Filter *.xml }
    "readme" { Get-Item "$repoRoot\\README.md" }
    default {
        @(
            (Get-Item "$repoRoot\\README.md"),
            (Get-Item "$repoRoot\\doc\\graph_nodes.xml"),
            (Get-ChildItem -Path "$repoRoot\\doc\\source" -File -Filter *.md),
            (Get-ChildItem -Path "$repoRoot\\doc\\source\\api" -File -Filter *.md),
            (Get-ChildItem -Path "$repoRoot\\doc\\source\\specs" -File -Filter *.md),
            (Get-ChildItem -Path "$repoRoot\\doc\\classes" -File -Filter *.xml)
        )
    }
}

$filePaths = $files | Select-Object -ExpandProperty FullName

if (Get-Command rg -ErrorAction SilentlyContinue) {
    rg --line-number --ignore-case --fixed-strings $Query $filePaths
} else {
    $files | Select-String -Pattern $Query -SimpleMatch -CaseSensitive:$false
}
