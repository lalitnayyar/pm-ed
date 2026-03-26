$ErrorActionPreference = 'Stop'

$ContainerName = 'pm-mvp'
$existing = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$"

if ($existing) {
  docker rm -f $ContainerName | Out-Null
  Write-Output "Stopped $ContainerName"
} else {
  Write-Output "Container $ContainerName is not running"
}
