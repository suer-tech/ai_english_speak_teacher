param(
    [string]$ApiHost = "0.0.0.0",
    [int]$ApiPort = 8000,
    [string]$FrontendHost = "0.0.0.0",
    [int]$FrontendPort = 3000,
    [switch]$SkipFrontendBuild,
    [switch]$UseDevFrontend
)

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "apps\api\.venv\Scripts\python.exe"
$npm = "C:\Program Files\nodejs\npm.cmd"
$nodeDir = "C:\Program Files\nodejs"

if (Test-Path $nodeDir) {
    $env:Path = "$nodeDir;$env:Path"
}

if (-not (Test-Path $python)) {
    throw "API virtual environment not found at $python"
}

if (-not (Test-Path $npm)) {
    throw "npm.cmd not found at $npm"
}

$apiDir = Join-Path $root "apps\api"
$frontendDir = Join-Path $root "apps\frontend"
$frontendDist = Join-Path $frontendDir "dist"

$apiLog = Join-Path $apiDir "uvicorn.server.log"
$apiErr = Join-Path $apiDir "uvicorn.server.err.log"
$frontendLog = Join-Path $frontendDir "frontend.server.log"
$frontendErr = Join-Path $frontendDir "frontend.server.err.log"

if (-not $UseDevFrontend -and (-not $SkipFrontendBuild -or -not (Test-Path $frontendDist))) {
    Write-Host "Building frontend bundle..."
    & $npm run build --prefix $frontendDir
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed"
    }
}

$apiProcess = Start-Process -FilePath $python `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", $ApiHost, "--port", "$ApiPort" `
    -WorkingDirectory $apiDir `
    -RedirectStandardOutput $apiLog `
    -RedirectStandardError $apiErr `
    -PassThru

if ($UseDevFrontend) {
    $frontendArgs = @("run", "dev", "--", "--host", $FrontendHost, "--port", "$FrontendPort")
} else {
    $frontendArgs = @("run", "preview", "--", "--host", $FrontendHost, "--port", "$FrontendPort")
}

$frontendProcess = Start-Process -FilePath $npm `
    -ArgumentList $frontendArgs `
    -WorkingDirectory $frontendDir `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError $frontendErr `
    -PassThru

@{
    api_pid = $apiProcess.Id
    frontend_pid = $frontendProcess.Id
    api_url = "http://$ApiHost`:$ApiPort"
    frontend_url = "http://$FrontendHost`:$FrontendPort"
    frontend_mode = $(if ($UseDevFrontend) { "dev" } else { "preview" })
    api_log = $apiLog
    frontend_log = $frontendLog
} | ConvertTo-Json
