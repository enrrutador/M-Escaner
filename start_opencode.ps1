# Script to start OpenCode with the correct configuration for Antigravity
$OpenCodePath = "C:\Users\Marcelo\AppData\Local\OpenCode\opencode-cli.exe"

if (Test-Path $OpenCodePath) {
    Write-Host "Starting OpenCode on port 21388..." -ForegroundColor Cyan
    & $OpenCodePath serve --port 21388
} else {
    Write-Error "OpenCode executable not found at $OpenCodePath"
}
