const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

exports.default = async function(context) {
  // Only run for macOS
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = context.appOutDir + `/${context.packager.appInfo.productFilename}.app`;
  const resourcesPath = path.join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'resources', 'bin', 'darwin-arm64');
  const frameworksPath = path.join(resourcesPath, 'Frameworks');
  const libPath = path.join(resourcesPath, 'lib');

  console.log('Removing problematic media-control framework files...');

  // Remove the Frameworks directory that causes signing issues
  if (fs.existsSync(frameworksPath)) {
    fs.rmSync(frameworksPath, { recursive: true, force: true });
    console.log('Removed Frameworks directory');
  }

  // Remove the lib directory
  if (fs.existsSync(libPath)) {
    fs.rmSync(libPath, { recursive: true, force: true });
    console.log('Removed lib directory');
  }

  console.log('media-control binary will use system Perl as designed');
};
