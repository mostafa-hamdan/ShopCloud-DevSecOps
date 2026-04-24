Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Checking Docker Compose configuration..."
docker compose config | Out-Null
Write-Host "Compose configuration is valid."