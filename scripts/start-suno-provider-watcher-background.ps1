$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $repoRoot "MusicLibrary\Logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stdout = Join-Path $logDir "suno-provider-watcher.log"
$stderr = Join-Path $logDir "suno-provider-watcher.err.log"
$launcher = Join-Path $repoRoot "scripts\start-suno-provider-watcher.ps1"

$existing = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -like "python*" -and $_.CommandLine -like "*suno_provider_watcher.py*") -or
    ($_.Name -like "powershell*" -and $_.CommandLine -like "*start-suno-provider-watcher.ps1*" -and $_.CommandLine -notlike "*start-suno-provider-watcher-background.ps1*")
  }

if ($existing) {
  Write-Host "Suno provider watcher is already running."
  exit 0
}

Start-Process powershell.exe `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$launcher`"") `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Write-Host "Suno provider watcher started."
Write-Host "Log: $stdout"
