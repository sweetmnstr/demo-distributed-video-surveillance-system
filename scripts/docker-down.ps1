#Requires -Version 5.1
<#
.SYNOPSIS
    Stop the distributed video surveillance system Docker Compose stack.

.DESCRIPTION
    Runs `docker compose down` from the repo root.
    Pass -Volumes to also remove named Docker volumes (use with caution -
    this deletes persisted data such as Redis snapshots).

.PARAMETER Volumes
    When set, appends --volumes to `docker compose down`, removing named volumes
    declared in docker-compose.yml in addition to stopping all containers.

.EXAMPLE
    .\scripts\docker-down.ps1
    Stop all containers; keep volumes intact.

.EXAMPLE
    .\scripts\docker-down.ps1 -Volumes
    Stop all containers and remove named volumes.

.NOTES
    Resolves the repo root via $PSScriptRoot (scripts\ is one level below root).
#>

[CmdletBinding()]
param(
    # Remove named volumes in addition to stopping containers.
    [switch]$Volumes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Resolve repo root and change location so docker compose finds
# docker-compose.yml regardless of the caller's current directory.
# ---------------------------------------------------------------------------
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host ""
Write-Host "=================================================="
Write-Host "  VSS - Docker Compose Teardown"
Write-Host "  Repo root: $repoRoot"

if ($Volumes) {
    Write-Host "  Mode: stop containers + remove volumes"
} else {
    Write-Host "  Mode: stop containers only (volumes preserved)"
}

Write-Host "=================================================="
Write-Host ""

# ---------------------------------------------------------------------------
# Build the docker compose down command.
# Conditionally append --volumes; avoid && / || (not valid in PS 5.1).
# ---------------------------------------------------------------------------
if ($Volumes) {
    Write-Host "Running: docker compose down --volumes"
    Write-Host ""
    docker compose down --volumes
} else {
    Write-Host "Running: docker compose down"
    Write-Host ""
    docker compose down
}

if (-not $?) {
    Write-Error "ERROR: 'docker compose down' failed. Review the output above."
    exit 1
}

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=================================================="

if ($Volumes) {
    Write-Host "  Stack stopped and volumes removed."
} else {
    Write-Host "  Stack stopped. Volumes are preserved."
    Write-Host "  To also remove volumes, run: .\scripts\docker-down.ps1 -Volumes"
}

Write-Host "=================================================="
Write-Host ""
