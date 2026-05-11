start /d "./release/bin/" grafana-server.exe
timeout /t 3
set "grafanahost=http://localhost:3000"
start "" "%grafanahost%"

