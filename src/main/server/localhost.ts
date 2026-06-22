/**
 * Local-only HTTP server that exposes a small read-only API + static file
 * serving for the default workspace. Bound to 127.0.0.1 only (never LAN) so
 * nothing here is exposed beyond the local machine.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URL } from 'node:url';
import { app } from 'electron';
import { createLogger } from '../utils/logger';
import { getRepositories } from '../db/repositories';

const log = createLogger('localhost');

const APP_VERSION: string = (() => {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
})();

interface ServerHandle {
  server: http.Server;
  host: string;
  port: number;
  startedAt: number;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function sendError(res: http.ServerResponse, status: number, code: string, message: string): void {
  json(res, status, { error: message, code });
}

function contentTypeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css':  return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg':  return 'image/svg+xml';
    case '.png':  return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif':  return 'image/gif';
    case '.ico':  return 'image/x-icon';
    case '.txt':
    case '.md':   return 'text/plain; charset=utf-8';
    case '.pdf':  return 'application/pdf';
    default:      return 'application/octet-stream';
  }
}

function safeResolve(workspaceRoot: string, requested: string): string | null {
  // Decode + normalize; reject anything that escapes the workspace root.
  let decoded: string;
  try {
    decoded = decodeURIComponent(requested);
  } catch {
    return null;
  }
  // Strip query/fragment that may have leaked in via the URL parser.
  const cleaned = decoded.split('?')[0].split('#')[0];
  const stripped = cleaned.replace(/^[/\\]+/, '');
  const candidate = path.normalize(path.join(workspaceRoot, stripped));
  const rootWithSep = workspaceRoot.endsWith(path.sep)
    ? workspaceRoot
    : workspaceRoot + path.sep;
  if (candidate !== workspaceRoot && !candidate.startsWith(rootWithSep)) {
    return null;
  }
  return candidate;
}

export class LocalServer {
  private handle: ServerHandle | null = null;
  private readonly preferredPort: number;
  private readonly host: string;
  private readonly workspaceRoot: () => string;

  constructor(port = 3939, host = '127.0.0.1', workspaceRoot?: () => string) {
    this.preferredPort = port;
    this.host = host;
    this.workspaceRoot = workspaceRoot ?? defaultWorkspaceRoot;
  }

  get url(): string | null {
    if (!this.handle) return null;
    return `http://${this.handle.host}:${this.handle.port}`;
  }

  async start(): Promise<{ port: number; host: string }> {
    if (this.handle) {
      return { port: this.handle.port, host: this.handle.host };
    }
    const server = http.createServer((req, res) => this.handleRequest(req, res));
    const bound = await listenWithFallback(server, this.host, this.preferredPort);
    this.handle = {
      server,
      host: bound.host,
      port: bound.port,
      startedAt: Date.now(),
    };
    log.info(`listening on http://${bound.host}:${bound.port}`);
    return { port: bound.port, host: bound.host };
  }

  async stop(): Promise<void> {
    if (!this.handle) return;
    const server = this.handle.server;
    this.handle = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    log.info('stopped');
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const started = Date.now();
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        sendError(res, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed.`);
        this.logRequest(req, 405, started);
        return;
      }
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? this.host}`);
      const pathname = url.pathname;

      if (pathname === '/health') {
        json(res, 200, {
          status: 'ok',
          uptime: this.handle ? Date.now() - this.handle.startedAt : 0,
          version: APP_VERSION,
        });
        this.logRequest(req, 200, started);
        return;
      }
      if (pathname === '/api/info') {
        json(res, 200, {
          name: 'Office AI Agent',
          version: APP_VERSION,
          platform: process.platform,
          arch: process.arch,
          node: process.versions.node,
          electron: process.versions.electron ?? null,
        });
        this.logRequest(req, 200, started);
        return;
      }
      if (pathname === '/api/agents') {
        try {
          const { agents } = getRepositories();
          json(res, 200, { items: agents.findAll() });
        } catch (err) {
          sendError(res, 500, 'INTERNAL', errMsg(err));
        }
        this.logRequest(req, 200, started);
        return;
      }
      if (pathname === '/api/teams') {
        try {
          const { teams } = getRepositories();
          json(res, 200, { items: teams.findAll() });
        } catch (err) {
          sendError(res, 500, 'INTERNAL', errMsg(err));
        }
        this.logRequest(req, 200, started);
        return;
      }
      if (pathname === '/api/chatrooms') {
        try {
          const { chatrooms } = getRepositories();
          json(res, 200, { items: chatrooms.findAll() });
        } catch (err) {
          sendError(res, 500, 'INTERNAL', errMsg(err));
        }
        this.logRequest(req, 200, started);
        return;
      }
      if (pathname.startsWith('/workspace/')) {
        this.serveWorkspace(pathname.slice('/workspace'.length), res, req, started);
        return;
      }
      sendError(res, 404, 'NOT_FOUND', `No route for ${pathname}.`);
      this.logRequest(req, 404, started);
    } catch (err) {
      log.error('request handler crashed', err);
      if (!res.headersSent) sendError(res, 500, 'INTERNAL', errMsg(err));
      this.logRequest(req, 500, started);
    }
  }

  private serveWorkspace(
    subPath: string,
    res: http.ServerResponse,
    req: http.IncomingMessage,
    started: number,
  ): void {
    const root = this.workspaceRoot();
    if (!root || !fs.existsSync(root)) {
      sendError(res, 404, 'NO_WORKSPACE', 'No workspace configured.');
      this.logRequest(req, 404, started);
      return;
    }
    const resolved = safeResolve(root, subPath);
    if (!resolved) {
      sendError(res, 403, 'FORBIDDEN', 'Path escapes workspace root.');
      this.logRequest(req, 403, started);
      return;
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      sendError(res, 404, 'NOT_FOUND', 'File not found.');
      this.logRequest(req, 404, started);
      return;
    }
    if (stat.isDirectory()) {
      // Try index.html inside the directory.
      const indexPath = path.join(resolved, 'index.html');
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return this.sendFile(indexPath, res, req, started);
      }
      sendError(res, 404, 'NOT_FOUND', 'Directory listing is disabled.');
      this.logRequest(req, 404, started);
      return;
    }
    this.sendFile(resolved, res, req, started);
  }

  private sendFile(
    filePath: string,
    res: http.ServerResponse,
    req: http.IncomingMessage,
    started: number,
  ): void {
    try {
      const stat = fs.statSync(filePath);
      const maxBytes = 25 * 1024 * 1024; // 25MB cap on workspace file streaming
      const length = Math.min(stat.size, maxBytes);
      const headers: http.OutgoingHttpHeaders = {
        'Content-Type': contentTypeFor(filePath),
        'Content-Length': length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      };
      res.writeHead(200, headers);
      if ((req.method ?? 'GET').toUpperCase() === 'HEAD') {
        res.end();
        this.logRequest(req, 200, started);
        return;
      }
      const stream = fs.createReadStream(filePath, { end: length - 1 });
      stream.on('error', (err) => {
        log.error('workspace stream error', err);
        if (!res.headersSent) sendError(res, 500, 'INTERNAL', errMsg(err));
        try { res.end(); } catch { /* ignore */ }
      });
      stream.on('end', () => this.logRequest(req, 200, started));
      stream.pipe(res);
    } catch (err) {
      sendError(res, 500, 'INTERNAL', errMsg(err));
      this.logRequest(req, 500, started);
    }
  }

  private logRequest(
    req: http.IncomingMessage,
    status: number,
    started: number,
  ): void {
    const ms = Date.now() - started;
    log.info(`${status} ${(req.method ?? 'GET').toUpperCase()} ${req.url} (${ms}ms)`);
  }
}

function defaultWorkspaceRoot(): string {
  try {
    const repos = getRepositories();
    const ws = repos.workspaces.getDefault();
    if (ws && ws.path && fs.existsSync(ws.path)) return ws.path;
  } catch {
    /* ignore — no DB yet */
  }
  try {
    return app.getPath('userData');
  } catch {
    return process.cwd();
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function listenWithFallback(
  server: http.Server,
  host: string,
  preferredPort: number,
): Promise<{ host: string; port: number }> {
  return new Promise((resolve, reject) => {
    let port = preferredPort;
    const tryListen = (): void => {
      const onError = (err: NodeJS.ErrnoException): void => {
        server.off('error', onError);
        if (err.code === 'EADDRINUSE' && port < preferredPort + 50) {
          port += 1;
          log.warn(`port ${port - 1} in use, trying ${port}`);
          tryListen();
        } else {
          reject(err);
        }
      };
      server.once('error', onError);
      server.once('listening', () => {
        server.off('error', onError);
        resolve({ host, port });
      });
      try {
        server.listen(port, host);
      } catch (err) {
        server.off('error', onError);
        reject(err as Error);
      }
    };
    tryListen();
  });
}

let singleton: LocalServer | null = null;

export function getLocalServer(): LocalServer {
  if (!singleton) singleton = new LocalServer();
  return singleton;
}

export function setLocalServer(server: LocalServer | null): void {
  singleton = server;
}