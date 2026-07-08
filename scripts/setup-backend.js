// Cross-platform backend venv bootstrap: python -m venv + pip install.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const backendDir = path.join(__dirname, '..', 'backend');
const venvDir = path.join(backendDir, '.venv');
const isWindows = process.platform === 'win32';
const pythonCmd = isWindows ? 'python' : 'python3';
const venvPip = isWindows
  ? path.join(venvDir, 'Scripts', 'pip.exe')
  : path.join(venvDir, 'bin', 'pip');

console.log(`Creating virtual environment at ${venvDir}...`);
execFileSync(pythonCmd, ['-m', 'venv', venvDir], { stdio: 'inherit' });

console.log('Installing backend dependencies...');
execFileSync(venvPip, ['install', '-r', path.join(backendDir, 'requirements.txt')], { stdio: 'inherit' });
