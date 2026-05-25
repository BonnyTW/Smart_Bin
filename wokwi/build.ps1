# Build Wokwi firmware (works when "pio" is not on PATH)
Set-Location $PSScriptRoot
Write-Host "Building firmware for Wokwi..." -ForegroundColor Cyan
python -m platformio run
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS. Next: Wokwi Stop -> Play to load firmware.bin" -ForegroundColor Green
} else {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}
