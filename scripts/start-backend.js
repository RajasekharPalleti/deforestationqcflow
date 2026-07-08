// Cross-platform backend launcher — resolves the venv python path per OS.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const backendDir = path.join(__dirname, '..', 'backend');
const venvDir = path.join(backendDir, '.venv');
const isWindows = process.platform === 'win32';
const venvPython = isWindows
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

const result = spawnSync(
  venvPython,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000', '--app-dir', backendDir],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
