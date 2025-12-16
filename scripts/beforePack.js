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

  // Remove only the Frameworks directory that causes signing issues
  // Keep the lib directory as it contains necessary Perl scripts
  if (fs.existsSync(frameworksPath)) {
    fs.rmSync(frameworksPath, { recursive: true, force: true });
    console.log('Removed Frameworks directory from source');
  } else {
    console.log('Frameworks directory not found (may have been removed already)');
  }

  console.log('Keeping lib directory (contains required Perl scripts)');
};
