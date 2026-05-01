param(
  [string]$Profile = "shopcloud-new",
  [string]$Region = "us-east-1",
  [string]$EndpointId,
  [string]$ClientCertPath,
  [string]$ClientKeyPath,
  [string]$OutFile = "runtime/client-vpn/shopcloud-dev-admin.ovpn"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $EndpointId) {
  throw "EndpointId is required."
}

$base = aws ec2 export-client-vpn-client-configuration `
  --client-vpn-endpoint-id $EndpointId `
  --profile $Profile `
  --region $Region

$cert = Get-Content $ClientCertPath -Raw
$key = Get-Content $ClientKeyPath -Raw

$config = @"
$base
<cert>
$cert
</cert>
<key>
$key
</key>
"@

Set-Content -Path $OutFile -Value $config
Write-Host "Wrote $OutFile"
