/**
 * Global type declarations for the sandboxed renderer.
 *
 * The preload script (see `./preload.ts`) exposes two globals onto `window`:
 *   - `officeAPI` — the typed API surface (see `./api.ts`).
 *   - `office`    — small bundle of static info (platform, versions).
 *
 * The renderer must NEVER touch `ipcRenderer` directly. These declarations
 * make `window.officeAPI` fully typed without bringing any Node/Electron
 * types into the renderer build.
 */

import type { OfficeAPI, OfficeGlobals } from './api';

declare global {
  interface Window {
    officeAPI: OfficeAPI;
    office: OfficeGlobals;
  }
}

export {};
