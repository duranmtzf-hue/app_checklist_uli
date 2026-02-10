# Deploy del frontend (APP Checklist) a Netlify desde la CLI
# Requiere: Netlify CLI (npx netlify-cli) y sitio enlazado (netlify link) o variable NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID

$ErrorActionPreference = "Stop"
$RootDir = $PSScriptRoot

if (-not (Test-Path (Join-Path $RootDir "netlify.toml"))) {
    Write-Error "No se encontró netlify.toml. Ejecuta este script desde la raíz del proyecto."
    exit 1
}

Push-Location $RootDir
try {
    Write-Host "Desplegando frontend en Netlify desde $RootDir ..." -ForegroundColor Cyan
    npx --yes netlify-cli deploy --prod
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Deploy completado." -ForegroundColor Green
} finally {
    Pop-Location
}
