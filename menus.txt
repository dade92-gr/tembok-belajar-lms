@echo off
color 0A
title Menu Otomatis - Tembok Belajar LMS

:MENU
cls
echo ==================================================
echo        MENU OTOMATIS - TEMBOK BELAJAR LMS
echo ==================================================
echo.
echo   [1] Build JS (node build.js)
echo   [2] Git Push (add, commit, push)
echo   [3] Build + Git Push (gabungan)
echo   [4] Buka folder di Explorer
echo   [5] Buka CMD di folder project
echo   [0] Keluar
echo.
echo ==================================================
set /p pilihan="Masukkan pilihan [0-5]: "

if "%pilihan%"=="1" goto BUILD
if "%pilihan%"=="2" goto GITPUSH
if "%pilihan%"=="3" goto BUILDANDPUSH
if "%pilihan%"=="4" goto OPENFOLDER
if "%pilihan%"=="5" goto OPENCMD
if "%pilihan%"=="0" goto EXIT
echo Pilihan tidak valid!
pause
goto MENU

:BUILD
cls
echo [BUILD] Menjalankan node build.js...
cd /d "%~dp0assets\js"
node build.js
echo.
echo [SELESAI] Build selesai.
pause
goto MENU

:GITPUSH
cls
set /p pesan="Masukkan pesan commit: "
if "%pesan%"=="" set pesan=Update: perubahan otomatis
echo.
echo [GIT] Menambahkan file...
cd /d "%~dp0"
git add -A
echo.
echo [GIT] Commit: %pesan%
git commit -m "%pesan%"
echo.
echo [GIT] Push ke GitHub...
git push
echo.
echo [SELESAI] Push selesai.
pause
goto MENU

:BUILDANDPUSH
cls
echo [1/2] Menjalankan node build.js...
cd /d "%~dp0assets\js"
node build.js
echo.
set /p pesan="Masukkan pesan commit: "
if "%pesan%"=="" set pesan=Update: perubahan otomatis
echo.
echo [2/2] Push ke GitHub...
cd /d "%~dp0"
git add -A
git commit -m "%pesan%"
git push
echo.
echo [SELESAI] Build + Push selesai.
pause
goto MENU

:OPENFOLDER
start "" "%~dp0"
goto MENU

:OPENCMD
start cmd /k "cd /d "%~dp0""
goto MENU

:EXIT
echo Terima kasih!
timeout /t 2 >nul
exit