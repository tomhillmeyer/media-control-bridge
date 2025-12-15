const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  // Only run for macOS
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  console.log('Removing problematic media-control framework files before packaging...');

  // The source directories that will be copied
  const arch = context.arch === 3 ? 'darwin-arm64' : 'darwin-x64';
  const projectDir = process.cwd();
  const sourcePath = path.join(projectDir, 'resources', 'bin', arch);
  const frameworksPath = path.join(sourcePath, 'Frameworks');
  const libPath = path.join(sourcePath, 'lib');

  // Remove the Frameworks directory that causes signing issues
  if (fs.existsSync(frameworksPath)) {
    fs.rmSync(frameworksPath, { recursive: true, force: true });
    console.log('Removed Frameworks directory from source');
  }

  // Remove the lib directory
  if (fs.existsSync(libPath)) {
    fs.rmSync(libPath, { recursive: true, force: true });
    console.log('Removed lib directory from source');
  }

  console.log('media-control binary will use system Perl as designed');
};
