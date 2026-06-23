const { spawn } = require('node:child_process');
const electronPath = require('electron');

const args = process.argv.slice(2);
const env = { ...process.env };

// Some automation shells set this to make Electron behave like plain Node.
// The desktop app needs the real Electron runtime APIs (`app`, `BrowserWindow`,
// `ipcMain`, etc.), so never pass this flag into the child Electron process.
delete env.ELECTRON_RUN_AS_NODE;

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
