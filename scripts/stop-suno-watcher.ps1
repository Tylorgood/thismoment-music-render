$ErrorActionPreference = "Stop"

$processes = Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -like "python*" -and $_.CommandLine -like "*suno_watcher.py*") -or
    ($_.Name -like "powershell*" -and $_.CommandLine -like "*start-suno-watcher.ps1*" -and $_.CommandLine -notlike "*start-suno-watcher-background.ps1*")
  }

if (-not $processes) {
  Write-Host "Suno watcher is not running."
  exit 0
}

foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force
  Write-Host "Stopped Suno watcher process $($process.ProcessId)."
}
