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
  // Check if we need to redeploy the statically-linked musl-compiled version
  try {
    const versionOutput = execSync(`"${binaryPath}" --version`).toString();
    console.log(`Current local Tectonic version: ${versionOutput.trim()}`);
    // If it is not version 0.15.0, replace it to ensure static musl version
    if (!versionOutput.includes('0.15.0')) {
      console.log('Replacing current binary with self-contained, statically-linked Musl compiler (v0.15.0)...');
      fs.unlinkSync(binaryPath);
    }
  } catch (e) {
    console.log('Local binary check failed, proceeding to clean installation.');
    try { fs.unlinkSync(binaryPath); } catch (_) {}
  }
}

if (!fs.existsSync(binaryPath)) {
  console.log('Downloading precompiled static Tectonic v0.15.0 (statically-linked Musl binary, zero host dependencies)...');
  try {
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    // Mac uses apple-darwin. Linux uses unknown-linux-musl for static self-contained binary!
    const osType = process.platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-musl';
    const tarballName = `tectonic-0.15.0-${arch}-${osType}.tar.gz`;
    const downloadUrl = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/${tarballName}`;

    console.log(`Downloading from: ${downloadUrl}`);
    execSync(`curl -L "${downloadUrl}" | tar xz`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to download Tectonic v0.15.0 musl:', err.message);
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
