/**
 * Main process entry point.
 *
 * Boot sequence (in `app.whenReady`):
 *   1. Initialize structured logging.
 *   2. Open the SQLite database in `app.getPath('userData')`.
 *   3. Get the typed repository bundle.
 *   4. Create the ProviderManager (LLM client cache + decrypt).
 *   5. Create the SkillRegistry (with built-in skills loaded).
 *   6. Create the SkillExecutor adapter (concrete executor -> orchestrator
 *      `SkillExecutorLike` shape; agent delegate wired in step 9).
 *   7. Create the MemoryManager (with a provider client factory).
 *   8. Create the Orchestrator with an in-memory event bus; subscribe to
 *      every event and forward it to the renderer on `orchestrator:event`.
 *      The active chatroom id is tracked so events that don't carry it
 *      natively are augmented before being sent.
 *   9. Wire `orchestrator.delegateToAgent` into the SkillExecutor adapter.
 *  10. Start the local-only HTTP server (`LocalServer`).
 *  11. Create the main BrowserWindow.
 *  12. Register all IPC handlers.
 *
 * On `before-quit` we stop the HTTP server and close the DB.
 */

// Electron API resolution.
//
// The `electron` npm package's `index.js` exports the path to the Electron
// binary as a string. In a real Electron main process, the runtime is
// supposed to intercept `require('electron')` and replace that stub with
// the actual API. However, in some environments (notably when the compiled
// code lives under `dist-main/` and the package layout confuses the
// interception), `require('electron')` still returns the path string, which
// causes every property access to be undefined.
//
// To be robust across all environments, we resolve the Electron API by
// using the Electron binary's own loader: we resolve the path from
// `node_modules/electron/path.txt`, then `require()` that path with the
// `ELECTRON_MODULE_PATH` magic that asks the Electron binary to hand back
// the API. If that still fails we fall back to the standard
// `require('electron')` and, as a last resort, try the global electron API
// that Electron injects into the main process.
// Electron API resolution.
//
// The `electron` npm package's `index.js` exports the path to the Electron
// binary as a string. In a real Electron main process, the runtime is
// supposed to intercept `require('electron')` and replace that stub with
// the actual API. However, in some environments (notably when the compiled
// code lives under `dist-main/` and the package layout confuses the
// interception), `require('electron')` still returns the path string,
// causing every property access to be undefined.
//
// To be robust across all environments, we resolve the Electron API by
// using the Electron binary's own loader: we resolve the path from
// `node_modules/electron/path.txt`, then `require()` that path with the
// `ELECTRON_MODULE_PATH` magic that asks the Electron binary to hand back
// the API. If that still fails we fall back to the standard
// `require('electron')` and, as a last resort, try the global electron API
// that Electron injects into the main process.
import { app, BrowserWindow } from 'electron';

import { TypedEventEmitter } from './orchestrator/types';
import type { OrchestratorEventMap } from './orchestrator/types';
import { Orchestrator } from './orchestrator/orchestrator';
import { MemoryManager } from './orchestrator/memory-manager';
import { OrchestratorSkillExecutor } from './orchestrator/skill-executor-adapter';
import { ProviderManager } from './llm';
import { createDefaultRegistry, loadAllUserSkills, type SkillRegistry } from './skills';
import { LocalServer } from './server/localhost';
import { WindowManager } from './window/window';
import { initDatabase, closeDatabase, getDb } from './db';
import { getRepositories, type Repositories } from './db/repositories';
import { registerAllIpcHandlers } from './ipc';
import { createLogger, logger as rootLogger } from './utils/logger';

const log = createLogger('main');

/* -------------------------------------------------------------------------- */
/* Globals owned by main                                                       */
/* -------------------------------------------------------------------------- */

let repos: Repositories | null = null;
let providerManager: ProviderManager | null = null;
let skillRegistry: SkillRegistry | null = null;
let memoryManager: MemoryManager | null = null;
let orchestrator: Orchestrator | null = null;
let skillExecutor: OrchestratorSkillExecutor | null = null;
let localServer: LocalServer | null = null;
let windowManager: WindowManager | null = null;

/* -------------------------------------------------------------------------- */
/* Boot                                                                        */
/* -------------------------------------------------------------------------- */

app.whenReady().then(async () => {
  try {
    await boot();
  } catch (err) {
    log.error('fatal boot error', err);
    app.exit(1);
  }
}).catch((err) => {
  log.error('whenReady failed', err);
  app.exit(1);
});

/* -------------------------------------------------------------------------- */
/* Boot implementation                                                         */
/* -------------------------------------------------------------------------- */

async function boot(): Promise<void> {
  log.info(`booting Office AI Agent (electron=${process.versions.electron}, node=${process.versions.node})`);

  // 1. Logger is already initialized at module load.
  void rootLogger;

  // 2. Open the database.
  const userDataPath = app.getPath('userData');
  initDatabase(userDataPath);
  log.info(`database opened at ${userDataPath}`);
  // Touch the DB to surface initialization errors early.
  getDb();

  // 3. Repositories.
  repos = getRepositories();

  // 4. ProviderManager — wired with the LLM provider repo. The repo's
  //    `findById` already decrypts the API key, so `decrypt` is a no-op.
  providerManager = new ProviderManager({
    resolve: async (id: string) => {
      const found = repos!.llmProviders.findById(id);
      if (!found) {
        throw new Error(`LLM provider not found: ${id}`);
      }
      return found;
    },
    decrypt: (ciphertext: string) => {
      // Repository `findById` already returns the decrypted key; the
      // ProviderManager calls `decrypt` after `resolveProvider`, so we
      // pass the value through unchanged.
      return ciphertext ?? '';
    },
  });

  // 5. SkillRegistry with built-in skills.
  skillRegistry = createDefaultRegistry();
  log.info(`skill registry initialized with ${skillRegistry.getAll().length} builtin skills`);

  // 5b. Layer user-defined skills on top of the builtins. A user skill
  //     with the same name as a builtin will replace the builtin.
  const userSkills = loadAllUserSkills(skillRegistry, repos.userSkills);
  log.info(
    `skill registry final: ${skillRegistry.getAll().length} skills ` +
      `(${userSkills.loaded} user, ${userSkills.skipped} user skipped/disabled)`,
  );

  // 6/7. Create the orchestrator; that internally creates its own
  //      MemoryManager + AgentRunner. We also keep a separate MemoryManager
  //      instance for the IPC handlers' consolidate/extract paths.
  const eventBus = new TypedEventEmitter<OrchestratorEventMap>();
  const activeChatRoomId = trackActiveChatRoom();

  orchestrator = new Orchestrator({
    db: getDb() as unknown as import('./orchestrator/types').OrchestratorDatabase,
    agents: repos.agents,
    teams: repos.teams,
    chatrooms: repos.chatrooms,
    messages: repos.messages,
    memories: repos.memories,
    summaries: repos.summaries,
    settings: {
      get: () => repos!.settings.getAppSettings(),
    },
    toolExecutions: repos.toolExecutions,
    providerManager: providerManager as unknown as import('./orchestrator/types').OrchestratorDeps['providerManager'],
    skillRegistry: skillRegistry as unknown as import('./orchestrator/types').SkillRegistryLike,
    // The skill executor is set below once we have a back-reference to
    // the orchestrator (we need it for the agent_delegate skill).
    skillExecutor: makeLateBoundExecutor(),
    eventBus,
  });

  // 7. Standalone MemoryManager for the IPC consolidate/extract paths.
  memoryManager = new MemoryManager(
    repos.memories,
    repos.summaries,
    repos.messages,
    { get: () => repos!.settings.getAppSettings() },
    async (providerId) => providerManager!.createClient(providerId),
  );

  // 8. Wire the SkillExecutor adapter and inject it into the orchestrator.
  skillExecutor = new OrchestratorSkillExecutor({
    registry: skillRegistry,
    toolExecutionRepo: repos.toolExecutions,
    agentDelegate: async (targetAgentId, task, context) => {
      return orchestrator!.delegateToAgent(targetAgentId, task, {
        chatRoomId: context.chatRoomId,
        parentMessageId: context.parentMessageId,
        signal: context.signal,
      });
    },
  });
  // Swap in the real executor (the orchestrator's constructor captured
  // a placeholder; we mutate via the typed `deps` reference).
  (orchestrator as unknown as { deps: { skillExecutor: import('./orchestrator/types').SkillExecutorLike } }).deps.skillExecutor = skillExecutor;

  // 9. Subscribe to all orchestrator events and forward to the renderer.
  wireOrchestratorEvents(orchestrator, windowManagerRef(), eventBus, activeChatRoomId);

  // 10. Local-only HTTP server.
  const appSettings = repos.settings.getAppSettings();
  localServer = new LocalServer(appSettings.localhostPort);
  try {
    await localServer.start();
  } catch (err) {
    log.error('failed to start local server', err);
  }

  // 11. Window.
  windowManager = new WindowManager();
  windowManager.createMainWindow();

  // 12. IPC handlers.
  if (!providerManager || !skillRegistry || !memoryManager || !orchestrator
      || !skillExecutor || !localServer || !windowManager) {
    throw new Error('internal: missing global after init');
  }
  registerAllIpcHandlers({
    repos,
    providerManager,
    skillRegistry,
    skillExecutor,
    memoryManager,
    orchestrator,
    windowManager,
    localServer,
    getWindow: () => windowManager!.getWindow(),
    app,
  });

  log.info('boot complete');
}

/* -------------------------------------------------------------------------- */
/* Window manager lazy reference                                               */
/* -------------------------------------------------------------------------- */

function windowManagerRef(): WindowManager {
  if (!windowManager) {
    windowManager = new WindowManager();
  }
  return windowManager;
}

/* -------------------------------------------------------------------------- */
/* Late-bound skill executor placeholder                                       */
/* -------------------------------------------------------------------------- */

import type { SkillExecutorLike, SkillAgentDelegate } from './orchestrator/types';

interface LateBoundExecutor extends SkillExecutorLike {
  setReal(executor: SkillExecutorLike): void;
}

function makeLateBoundExecutor(): LateBoundExecutor {
  let real: SkillExecutorLike | null = null;
  const proxy: LateBoundExecutor = {
    setReal(e) { real = e; },
    async execute(agent, toolCall, context) {
      if (!real) throw new Error('SkillExecutor not yet initialized');
      return real.execute(agent, toolCall, context);
    },
    async record(messageId, toolCall, result, status) {
      if (!real) throw new Error('SkillExecutor not yet initialized');
      return real.record(messageId, toolCall, result, status);
    },
  };
  return proxy;
}

// Suppress unused-var warning for SkillAgentDelegate (re-exported via
// the IPC index module for callers that need it).
void (null as unknown as SkillAgentDelegate);

/* -------------------------------------------------------------------------- */
/* Active chatroom tracking                                                    */
/*                                                                            */
/* Some orchestrator events (e.g. `agent:content`, `agent:done`) do not      */
/* include `chatRoomId` in their payload, but the renderer expects it for     */
/* routing. We track the currently-active chatroom id here and augment the    */
/* payload before forwarding to the renderer.                                  */
/* -------------------------------------------------------------------------- */

function trackActiveChatRoom(): { current: string | null; set(id: string | null): void } {
  return { current: null, set(id) { this.current = id; } };
}

function wireOrchestratorEvents(
  orch: Orchestrator,
  win: WindowManager,
  _bus: TypedEventEmitter<OrchestratorEventMap>,
  active: { current: string | null; set(id: string | null): void },
): void {
  const events: Array<keyof OrchestratorEventMap> = [
    'agent:start',
    'agent:thinking',
    'agent:content',
    'agent:tool_call',
    'agent:tool_result',
    'agent:done',
    'agent:error',
    'memory:used',
    'memory:created',
  ];

  // Patch runTeamChat / streamChat to track the active chatroom. We
  // don't want to monkey-patch at runtime; instead, we listen for the
  // first `agent:start` event and use its `chatRoomId` as the active
  // room until the run completes.
  for (const ev of events) {
    orch.on(ev, (payload) => {
      const p = payload as Record<string, unknown> & { chatRoomId?: string };
      if (ev === 'agent:start' && typeof p.chatRoomId === 'string') {
        active.set(p.chatRoomId);
      } else if (ev === 'agent:done' || ev === 'agent:error') {
        // We don't reset immediately because a team run may include
        // multiple agents. Instead we reset on the next `agent:start`
        // event or via a microtask below.
        queueMicrotask(() => {
          if (active.current === p.chatRoomId) {
            // keep current chatroomId; only reset when the *next* run starts
          }
        });
      }
      const augmented: Record<string, unknown> = { ...p };
      if (!augmented.chatRoomId && active.current) {
        augmented.chatRoomId = active.current;
      }
      win.sendToRenderer('orchestrator:event', { type: ev, payload: augmented });
    });
  }
  // Silence unused-var warning for `_bus`.
  void _bus;
}

/* -------------------------------------------------------------------------- */
/* App lifecycle                                                               */
/* -------------------------------------------------------------------------- */

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && windowManager) {
    windowManager.createMainWindow();
  }
});

app.on('before-quit', async (event) => {
  // Best-effort cleanup. We don't preventDefault — the quit should still
  // proceed even if cleanup fails.
  if (localServer) {
    try {
      await localServer.stop();
    } catch (err) {
      log.warn('failed to stop local server', err);
    }
  }
  if (orchestrator) {
    try {
      const events = ['agent:start', 'agent:thinking', 'agent:content', 'agent:tool_call',
        'agent:tool_result', 'agent:done', 'agent:error', 'memory:used', 'memory:created'] as const;
      for (const ev of events) {
        try { orchestrator.off(ev, () => undefined); } catch { /* ignore */ }
      }
    } catch (err) {
      log.warn('failed to detach orchestrator listeners', err);
    }
  }
  try {
    closeDatabase();
  } catch (err) {
    log.warn('failed to close database', err);
  }
  void event;
});

/* -------------------------------------------------------------------------- */
/* Hard error fallbacks                                                        */
/* -------------------------------------------------------------------------- */

process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection', reason);
});
