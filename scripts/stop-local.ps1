$ports = 3000, 8000

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
        } catch {
            Write-Output "Could not stop process on port $port"
        }
    }
}

Write-Output "Stopped local SpeakAI processes on ports 3000 and 8000 if they were running."
