@echo off
REM Build MediaHelper.exe for Windows x64

echo Building MediaHelper for Windows x64...
dotnet publish -c Release -r win-x64 --self-contained -o ..\..\resources\bin\win-x64

echo Building MediaHelper for Windows ARM64...
dotnet publish -c Release -r win-arm64 --self-contained -o ..\..\resources\bin\win-arm64

echo Build complete!
echo Executable location: resources\bin\win-x64\MediaHelper.exe
echo Executable location: resources\bin\win-arm64\MediaHelper.exe
