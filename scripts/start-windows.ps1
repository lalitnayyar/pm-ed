$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir '..')
$ImageName = 'pm-mvp:dev'
$ContainerName = 'pm-mvp'

Set-Location $RootDir

docker build -t $ImageName .

$existing = docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$ContainerName$"
if ($existing) {
  docker rm -f $ContainerName | Out-Null
}

docker run -d --name $ContainerName -p 8000:8000 $ImageName | Out-Null

Write-Output "Started $ContainerName at http://127.0.0.1:8000"
