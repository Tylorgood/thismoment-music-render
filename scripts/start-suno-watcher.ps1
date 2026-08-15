$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$configPath = Join-Path $repoRoot ".suno-watcher.env"

if (Test-Path $configPath) {
  Get-Content $configPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }
    $key, $value = $line.Split("=", 2)
    [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
  }
}

if (-not $env:SUNO_WATCH_DIR) {
  $env:SUNO_WATCH_DIR = Join-Path $env:USERPROFILE "Downloads\Suno"
}

python (Join-Path $repoRoot "scripts\suno_watcher.py")
