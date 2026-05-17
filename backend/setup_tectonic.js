const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  console.log('Windows detected. Using local tectonic.exe.');
  process.exit(0);
}

console.log('Linux/macOS detected. Checking/installing Tectonic...');
const binaryPath = path.join(__dirname, 'tectonic');

if (fs.existsSync(binaryPath)) {
  console.log('Tectonic binary already exists in backend root.');
  // Check if we need to redeploy the older compatible version
  try {
    const versionOutput = execSync(`"${binaryPath}" --version`).toString();
    console.log(`Current local Tectonic version: ${versionOutput.trim()}`);
    if (versionOutput.includes('0.16.')) {
      console.log('Found glibc-incompatible v0.16.x, removing to reinstall compatible v0.14.1...');
      fs.unlinkSync(binaryPath);
    }
  } catch (e) {
    console.log('Local binary check failed, proceeding to clean installation.');
    try { fs.unlinkSync(binaryPath); } catch (_) {}
  }
}

if (!fs.existsSync(binaryPath)) {
  console.log('Downloading precompiled Tectonic v0.14.1 (GLIBC 2.31+ compatible)...');
  try {
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    const osType = process.platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-gnu';
    const tarballName = `tectonic-0.14.1-${arch}-${osType}.tar.gz`;
    const downloadUrl = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.14.1/${tarballName}`;

    console.log(`Downloading from: ${downloadUrl}`);
    execSync(`curl -L "${downloadUrl}" | tar xz`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to download Tectonic v0.14.1:', err.message);
    console.log('Will fall back to global "tectonic" installation in PATH.');
  }
}

// Make sure it has executable permissions
if (fs.existsSync(binaryPath)) {
  try {
    fs.chmodSync(binaryPath, '755');
    console.log('Successfully set Tectonic binary permissions to 755 (executable).');
  } catch (err) {
    console.warn('Failed to set binary permissions:', err.message);
  }
}
