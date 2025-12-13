const { notarize } = require('@electron/notarize');
require('dotenv').config();

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName !== 'darwin') {
        return;
    }

    // Skip notarization if credentials are not set
    if (!process.env.APPLE_ID || !process.env.APPLE_PASSWORD || !process.env.APPLE_TEAM_ID) {
        console.warn('⚠️  Skipping notarization: Apple credentials not found in environment variables');
        console.warn('   To enable notarization, set APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID');
        return;
    }

    const appName = context.packager.appInfo.productFilename;

    console.log('🔐 Notarizing application...');

    return await notarize({
        appBundleId: 'com.creativeland.mediacontrolbridge',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
        tool: 'notarytool',
    });
};
