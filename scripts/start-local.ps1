$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "apps\api\.venv\Scripts\python.exe"
$npm = "C:\Program Files\nodejs\npm.cmd"

if (-not (Test-Path $python)) {
    throw "API virtual environment not found at $python"
}

$apiDir = Join-Path $root "apps\api"
$webDir = Join-Path $root "apps\web"

$apiLog = Join-Path $apiDir "uvicorn.log"
$apiErr = Join-Path $apiDir "uvicorn.err.log"
$webLog = Join-Path $webDir "next.log"
$webErr = Join-Path $webDir "next.err.log"

$apiProcess = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory $apiDir `
    -RedirectStandardOutput $apiLog `
    -RedirectStandardError $apiErr `
    -PassThru

$webProcess = Start-Process -FilePath $npm `
    -ArgumentList "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000" `
    -WorkingDirectory $webDir `
    -RedirectStandardOutput $webLog `
    -RedirectStandardError $webErr `
    -PassThru

@{
    api_pid = $apiProcess.Id
    web_pid = $webProcess.Id
    api_url = "http://127.0.0.1:8000"
    web_url = "http://127.0.0.1:3000"
} | ConvertTo-Json
