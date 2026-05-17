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
} else {
  console.log('Downloading precompiled Tectonic binary...');
  try {
    execSync('curl --proto "=https" --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to download Tectonic via drop-sh installer:', err.message);
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
