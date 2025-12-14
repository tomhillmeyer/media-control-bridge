const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Windows MediaHelper...');

const nativeDir = path.join(__dirname, '..', 'native', 'windows');
const outputDir = path.join(__dirname, '..', 'resources', 'bin');

// Check if .NET SDK is installed
try {
  execSync('dotnet --version', { stdio: 'pipe' });
} catch (error) {
  console.error('ERROR: .NET SDK is not installed.');
  console.error('Please install .NET 7.0 SDK or later from: https://dotnet.microsoft.com/download');
  console.error('You can build on Mac, Windows, or Linux with the .NET SDK.');
  process.exit(1);
}

// Create output directories
const x64OutputDir = path.join(outputDir, 'win-x64');
const arm64OutputDir = path.join(outputDir, 'win-arm64');

if (!fs.existsSync(x64OutputDir)) {
  fs.mkdirSync(x64OutputDir, { recursive: true });
}
if (!fs.existsSync(arm64OutputDir)) {
  fs.mkdirSync(arm64OutputDir, { recursive: true });
}

// Build options - enable Windows targeting on non-Windows platforms
const buildOptions = process.platform !== 'win32'
  ? '-p:EnableWindowsTargeting=true'
  : '';

// Build for x64
console.log('Building for Windows x64...');
try {
  execSync(
    `dotnet publish -c Release -r win-x64 --self-contained ${buildOptions} -o "${x64OutputDir}"`,
    { cwd: nativeDir, stdio: 'inherit' }
  );
  console.log('✓ Windows x64 build complete');
} catch (error) {
  console.error('ERROR: Failed to build Windows x64 helper');
  process.exit(1);
}

// Build for ARM64
console.log('Building for Windows ARM64...');
try {
  execSync(
    `dotnet publish -c Release -r win-arm64 --self-contained ${buildOptions} -o "${arm64OutputDir}"`,
    { cwd: nativeDir, stdio: 'inherit' }
  );
  console.log('✓ Windows ARM64 build complete');
} catch (error) {
  console.error('ERROR: Failed to build Windows ARM64 helper');
  process.exit(1);
}

// Verify the executables were created
const x64Exe = path.join(x64OutputDir, 'MediaHelper.exe');
const arm64Exe = path.join(arm64OutputDir, 'MediaHelper.exe');

if (!fs.existsSync(x64Exe)) {
  console.error('ERROR: MediaHelper.exe not found in win-x64 output');
  process.exit(1);
}

if (!fs.existsSync(arm64Exe)) {
  console.error('ERROR: MediaHelper.exe not found in win-arm64 output');
  process.exit(1);
}

console.log('\n✓ Windows MediaHelper build complete!');
console.log(`  x64:   ${x64Exe}`);
console.log(`  arm64: ${arm64Exe}`);
