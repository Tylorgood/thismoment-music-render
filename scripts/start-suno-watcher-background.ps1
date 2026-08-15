$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = Join-Path $repoRoot "MusicLibrary\Logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stdout = Join-Path $logDir "suno-watcher.log"
$stderr = Join-Path $logDir "suno-watcher.err.log"
$launcher = Join-Path $repoRoot "scripts\start-suno-watcher.ps1"

$existing = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -like "python*" -and $_.CommandLine -like "*suno_watcher.py*") -or
    ($_.Name -like "powershell*" -and $_.CommandLine -like "*start-suno-watcher.ps1*" -and $_.CommandLine -notlike "*start-suno-watcher-background.ps1*")
  }

if ($existing) {
  Write-Host "Suno watcher is already running."
  exit 0
}

Start-Process powershell.exe `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$launcher`"") `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Write-Host "Suno watcher started."
Write-Host "Log: $stdout"
