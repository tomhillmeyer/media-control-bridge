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

  console.log('Signing media-control components for notarization...');

  try {
    // Use the certificate hash directly (the identity string from config doesn't work for codesign)
    const identity = 'ED9FCC06726F735AE56AC81A779CA2EF82F295B1';

    console.log(`Using signing identity: ${identity}`);

    // Skip signing media-control binary (it's a Perl script, not a binary)
    // Skip signing lib directory (all Perl scripts)

    // Handle framework - fix structure and sign binaries
    const frameworkPath = path.join(resourcesPath, 'Frameworks', 'MediaRemoteAdapter.framework');
    if (fs.existsSync(frameworkPath)) {
      console.log('Fixing MediaRemoteAdapter.framework structure...');

      // Fix the framework structure - delete duplicates and create proper symlinks
      const rootBinary = path.join(frameworkPath, 'MediaRemoteAdapter');
      const rootResources = path.join(frameworkPath, 'Resources');
      const versionsCurrent = path.join(frameworkPath, 'Versions', 'Current');

      // Remove root-level duplicates
      if (fs.existsSync(rootBinary) && !fs.lstatSync(rootBinary).isSymbolicLink()) {
        console.log('Removing duplicated root-level binary...');
        fs.unlinkSync(rootBinary);
      }
      if (fs.existsSync(rootResources) && !fs.lstatSync(rootResources).isSymbolicLink()) {
        console.log('Removing duplicated root-level Resources...');
        fs.rmSync(rootResources, { recursive: true, force: true });
      }

      // Fix Versions/Current - should be symlink to A, not a copy
      if (fs.existsSync(versionsCurrent) && !fs.lstatSync(versionsCurrent).isSymbolicLink()) {
        console.log('Removing duplicated Versions/Current directory...');
        fs.rmSync(versionsCurrent, { recursive: true, force: true });
      }

      // Create proper symlinks
      console.log('Creating proper framework symlinks...');
      if (!fs.existsSync(versionsCurrent)) {
        fs.symlinkSync('A', versionsCurrent);
      }
      if (!fs.existsSync(rootBinary)) {
        fs.symlinkSync('Versions/Current/MediaRemoteAdapter', rootBinary);
      }
      if (!fs.existsSync(rootResources)) {
        fs.symlinkSync('Versions/Current/Resources', rootResources);
      }

      // Now sign the actual binary WITHOUT hardened runtime (framework doesn't need it)
      const actualBinary = path.join(frameworkPath, 'Versions', 'A', 'MediaRemoteAdapter');
      if (fs.existsSync(actualBinary)) {
        console.log(`Signing ${actualBinary}...`);
        try {
          // Sign without --options runtime since this is a bundled framework
          await execAsync(`codesign --sign "${identity}" --force --timestamp --identifier "com.github.samuelmeuli.MediaRemoteAdapter" "${actualBinary}"`);
          console.log('Successfully signed MediaRemoteAdapter binary');
        } catch (e) {
          console.error(`Failed to sign ${actualBinary}: ${e.message}`);
          throw e;
        }
      }
    }

    // Re-sign the entire app bundle since we modified its contents
    console.log('Re-signing entire app bundle...');
    const entitlementsPath = path.join(__dirname, '..', 'entitlements.plist');
    await execAsync(`codesign --sign "${identity}" --force --timestamp --options runtime --entitlements "${entitlementsPath}" --deep "${appPath}"`);
    console.log('Successfully re-signed app bundle');

    console.log('All media-control components signed for notarization');
  } catch (error) {
    console.error('Error signing media-control components:', error.message);
    throw error; // Fail the build if signing fails
  }
};
