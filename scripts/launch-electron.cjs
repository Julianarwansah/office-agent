const { spawn } = require('node:child_process');
const electronPath = require('electron');

const rawArgs = process.argv.slice(2);
const isDev = rawArgs.includes('--dev');
const args = rawArgs.filter((a) => a !== '--dev');
const env = { ...process.env };

// Some automation shells set this to make Electron behave like plain Node.
// The desktop app needs the real Electron runtime APIs (`app`, `BrowserWindow`,
// `ipcMain`, etc.), so never pass this flag into the child Electron process.
delete env.ELECTRON_RUN_AS_NODE;

// In dev mode always point Electron at the running Vite dev server so that
// HMR works even when a stale dist-renderer/index.html exists on disk.
if (isDev && !env.VITE_DEV_SERVER_URL && !env.OFFICE_AI_DEV_URL) {
  env.VITE_DEV_SERVER_URL = 'http://localhost:5173';
}

const child = spawn(electronPath, args.length > 0 ? args : ['.'], {
  env,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('close', (code, signal) => {
  if (signal) {
    console.error(`${electronPath} exited with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
