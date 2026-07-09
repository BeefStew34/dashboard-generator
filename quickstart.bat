rmdir /S /Q "%~dp0release\plugins-bundled\aut-dashboardgenerator-app"

xcopy "%~dp0custom-plugins\aut-dashboardgenerator-app\dist\*" ^
      "%~dp0release\plugins-bundled\aut-dashboardgenerator-app\" ^
      /E /I /Y
start /d "./pgsql/bin/" pg_ctl.exe -D ../data -U postgres start 
start /d "./release/bin/" grafana-server.exe
timeout /t 3
set "grafanahost=http://localhost:3000"
start "" "%grafanahost%"

