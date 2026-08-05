const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  console.log('Windows detected. Using local typst.exe.');
  process.exit(0);
}

console.log('Linux/macOS detected. Checking/installing Typst...');
const binaryPath = path.join(__dirname, 'typst');

if (fs.existsSync(binaryPath)) {
  console.log('Typst binary already exists in backend root.');
  try {
    const versionOutput = execSync(`"${binaryPath}" --version`).toString();
    console.log(`Current local Typst version: ${versionOutput.trim()}`);
  } catch (e) {
    console.log('Local binary check failed, proceeding to clean installation.');
    try { fs.unlinkSync(binaryPath); } catch (_) {}
  }
}

if (!fs.existsSync(binaryPath)) {
  console.log('Downloading precompiled Typst binary...');
  try {
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
    const osType = process.platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-musl';
    const tarballName = `typst-${arch}-${osType}.tar.xz`;
    // Typst releases follow the pattern: https://github.com/typst/typst/releases/latest
    // We download the latest stable release
    const downloadUrl = `https://github.com/typst/typst/releases/latest/download/${tarballName}`;

    console.log(`Downloading from: ${downloadUrl}`);
    execSync(`curl -L "${downloadUrl}" | tar xJ --strip-components=1 -C "${__dirname}"`, {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to download Typst:', err.message);
    console.log('Will fall back to global "typst" installation in PATH.');
  }
}

// Make sure it has executable permissions
if (fs.existsSync(binaryPath)) {
  try {
    fs.chmodSync(binaryPath, '755');
    console.log('Successfully set Typst binary permissions to 755 (executable).');
  } catch (err) {
    console.warn('Failed to set binary permissions:', err.message);
  }
}
