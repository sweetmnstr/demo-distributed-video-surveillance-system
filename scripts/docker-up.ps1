#Requires -Version 5.1
<#
.SYNOPSIS
    Start the distributed video surveillance system via Docker Compose.

.DESCRIPTION
    1. Verifies that docker and node are available on the system.
    2. Generates RSA keys (config\keys\private.pem / public.pem) if they do not
       already exist, using scripts\setup-keys.mjs.
    3. Seeds demo users (config\users.json) if that file does not already exist,
       using the @vss/server-b workspace npm script.
    4. Runs `docker compose up --build -d`.
    5. Prints the service URLs on success.

.NOTES
    Requires Docker Desktop (WSL2 backend, Linux containers) and Node.js.
    Run from any directory - the script resolves the repo root via $PSScriptRoot.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helper: resolve repo root and change location so docker compose finds
# docker-compose.yml regardless of where the caller invoked the script from.
# scripts\ sits directly under the repo root, so one level up is correct.
# ---------------------------------------------------------------------------
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host ""
Write-Host "=================================================="
Write-Host "  VSS - Docker Compose Bootstrap"
Write-Host "  Repo root: $repoRoot"
Write-Host "=================================================="
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1 - Verify required runtimes are available.
# ---------------------------------------------------------------------------
Write-Host "[1/4] Checking required tools..."

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($null -eq $dockerCmd) {
    Write-Error "ERROR: 'docker' not found. Install Docker Desktop (WSL2 backend) and ensure it is on your PATH."
    exit 1
}
Write-Host "      docker  : $($dockerCmd.Source)"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Write-Error "ERROR: 'node' not found. Install Node.js and ensure it is on your PATH."
    exit 1
}
Write-Host "      node    : $($nodeCmd.Source)"

# ---------------------------------------------------------------------------
# Step 2 - Generate RSA key pair if not already present.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Checking RSA key pair..."

$privateKey = Join-Path $repoRoot "config\keys\private.pem"
$publicKey  = Join-Path $repoRoot "config\keys\public.pem"

if ((-not (Test-Path $privateKey)) -or (-not (Test-Path $publicKey))) {
    Write-Host "      Keys missing - generating via scripts\setup-keys.mjs ..."
    $setupKeysScript = Join-Path $repoRoot "scripts\setup-keys.mjs"
    node $setupKeysScript
    if (-not $?) {
        Write-Error "ERROR: Key generation failed (node scripts/setup-keys.mjs exited non-zero)."
        exit 1
    }
    Write-Host "      Keys generated."
} else {
    Write-Host "      Keys already present, skipping."
}

# ---------------------------------------------------------------------------
# Step 3 - Seed demo users if config\users.json is absent.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Checking demo users..."

$usersJson = Join-Path $repoRoot "config\users.json"

if (-not (Test-Path $usersJson)) {
    Write-Host "      config\users.json missing - seeding via @vss/server-b ..."
    npm run seed:users --workspace @vss/server-b
    if (-not $?) {
        Write-Error "ERROR: User seeding failed (npm run seed:users exited non-zero)."
        exit 1
    }
    Write-Host "      Demo users seeded."
} else {
    Write-Host "      Users already seeded, skipping."
}

# ---------------------------------------------------------------------------
# Step 4 - Start the compose stack.
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Starting Docker Compose stack (--build -d) ..."
Write-Host ""

docker compose up --build -d

if (-not $?) {
    Write-Error "ERROR: 'docker compose up --build -d' failed. Review the output above."
    exit 1
}

# ---------------------------------------------------------------------------
# Success banner
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=================================================="
Write-Host "  Stack is up!"
Write-Host ""
Write-Host "  Web client:   http://127.0.0.1:8080"
Write-Host "  Server B API: http://127.0.0.1:3000"
Write-Host ""
Write-Host "  Run .\scripts\docker-down.ps1 to stop."
Write-Host "  Run .\scripts\docker-down.ps1 -Volumes to stop and remove volumes."
Write-Host "=================================================="
Write-Host ""
