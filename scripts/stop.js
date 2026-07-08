// Best-effort kill of the dev servers on ports 8000 (backend) and 4200 (frontend).
//
// uvicorn --reload runs a parent "reloader" process that instantly respawns a
// new worker if only the worker (the one actually bound to the port) is
// killed. So on Windows we also walk up to the parent PID and kill that too,
// and we sweep each port twice in case a respawn slips in between.
const { execSync } = require('node:child_process');

const PORTS = [8000, 4200];
const isWindows = process.platform === 'win32';
const SYSTEM_PIDS = new Set(['0', '4']); // PID 0 (Idle) / 4 (System) — never real listeners

function sleepSync(ms) {
  // execSync('timeout ...') fails without a real console (no stdin to redirect),
  // so block synchronously in-process instead of shelling out.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function killWindowsPort(port) {
  let out;
  try {
    out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  } catch {
    return false;
  }
  const pids = new Set(
    out
      .split('\n')
      .filter((l) => l.includes('LISTENING'))
      .map((l) => l.trim().split(/\s+/).pop())
      .filter((pid) => pid && /^\d+$/.test(pid) && !SYSTEM_PIDS.has(pid))
  );
  if (pids.size === 0) return false;

  const toKill = new Set(pids);
  for (const pid of pids) {
    try {
      const info = execSync(`wmic process where (ProcessId=${pid}) get ParentProcessId /value`, {
        encoding: 'utf8',
      });
      const match = info.match(/ParentProcessId=(\d+)/);
      if (match && !SYSTEM_PIDS.has(match[1])) toKill.add(match[1]);
    } catch {
      /* wmic unavailable or process already gone — ignore */
    }
  }

  for (const pid of toKill) {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'pipe' });
      console.log(`Stopped process ${pid} on port ${port}`);
    } catch {
      /* already gone */
    }
  }
  return true;
}

function killUnixPort(port) {
  let out;
  try {
    out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
  } catch {
    return false;
  }
  const pids = out.split('\n').filter(Boolean);
  if (pids.length === 0) return false;
  for (const pid of pids) {
    try {
      execSync(`kill -9 ${pid}`);
      console.log(`Stopped process ${pid} on port ${port}`);
    } catch {
      /* already gone */
    }
  }
  return true;
}

for (const port of PORTS) {
  const kill = isWindows ? killWindowsPort : killUnixPort;
  const first = kill(port);
  // Give a respawned reloader worker a moment to bind, then sweep again.
  sleepSync(1000);
  const second = kill(port);
  if (!first && !second) console.log(`Nothing running on port ${port}`);
}
