# Deploy del backend (app-checklist-uli) a Fly.io desde la CLI
# Requiere: flyctl instalado y autenticado (fly auth login)

$ErrorActionPreference = "Stop"
$BackendDir = Join-Path $PSScriptRoot "backend"

if (-not (Test-Path (Join-Path $BackendDir "fly.toml"))) {
    Write-Error "No se encontró backend/fly.toml. Ejecuta este script desde la raíz del proyecto."
    exit 1
}

Push-Location $BackendDir
try {
    Write-Host "Desplegando backend en Fly.io desde $BackendDir ..." -ForegroundColor Cyan
    fly deploy
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Deploy completado." -ForegroundColor Green
} finally {
    Pop-Location
}
