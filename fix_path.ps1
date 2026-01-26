$OpenCodePath = "C:\Users\Marcelo\AppData\Local\OpenCode"
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($CurrentPath -notlike "*$OpenCodePath*") {
    $NewPath = "$CurrentPath;$OpenCodePath"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "PATH updated successfully. Please restart your terminal/IDE for changes to take effect." -ForegroundColor Green
}
else {
    Write-Host "OpenCode is already in your PATH." -ForegroundColor Yellow
}
