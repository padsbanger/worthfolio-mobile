@echo off
setlocal
rem Keep Java, SDK, and short-path settings scoped to this launcher.
for %%I in ("%~dp0..") do set "WF_PROJECT_NAME=%%~nxI"
for %%I in ("%~dp0..\..") do set "WF_PARENT=%%~fI"
set "JAVA_HOME=%LOCALAPPDATA%\Worthfolio\jdk17\jdk-17.0.20.1+1"
if defined WORTHFOLIO_JAVA_HOME set "JAVA_HOME=%WORTHFOLIO_JAVA_HOME%"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo JDK 17 not found. Set WORTHFOLIO_JAVA_HOME to your JDK 17 directory.
  exit /b 1
)
findstr /B /L /C:"JAVA_VERSION=" "%JAVA_HOME%\release" | findstr /L /C:"17." >nul
if errorlevel 1 (
  echo This launcher requires JDK 17. Check WORTHFOLIO_JAVA_HOME.
  exit /b 1
)
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not exist "%ANDROID_HOME%\platform-tools\adb.exe" (
  echo Android SDK not found. Set ANDROID_HOME to your SDK directory.
  exit /b 1
)
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
if not exist W:\ subst W: "%WF_PARENT%"
set "WF_MATCH="
for /f "tokens=1,2,*" %%A in ('subst') do if /I "%%A"=="W:\:" if /I "%%C"=="%WF_PARENT%" set "WF_MATCH=1"
if not defined WF_MATCH (
  echo W: must be a drive alias for "%WF_PARENT%". It is occupied or could not be created.
  exit /b 1
)
pushd "W:\%WF_PROJECT_NAME%"
if errorlevel 1 exit /b 1
echo JAVA_HOME=%JAVA_HOME%
echo Project=%CD%
if /I "%~1"=="build" goto build
if not "%~1"=="" goto usage
call npx.cmd expo run:android --device Pixel_10 --port 8082
goto finish

:build
rem Compile an emulator APK without installing it or starting Metro.
pushd android
call gradlew.bat app:assembleDebug -x lint -x test --build-cache -PreactNativeArchitectures=x86_64 -PreactNativeDevServerPort=8082 --console=plain
set "WF_RESULT=%ERRORLEVEL%"
popd
goto done

:usage
echo Usage: scripts\android-local.cmd [build]
set "WF_RESULT=1"
goto done

:finish
set "WF_RESULT=%ERRORLEVEL%"
:done
popd
exit /b %WF_RESULT%
