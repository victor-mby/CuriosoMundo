@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 servidor.py 8080
  goto fin
)
where python >nul 2>nul
if %errorlevel%==0 (
  python servidor.py 8080
  goto fin
)
echo.
echo No se encontro Python 3 en este equipo.
echo Instale Python 3 o abra el proyecto con un servidor estatico local.
echo.
pause
:fin
endlocal