/**
 * Lightweight leveled logger for the main process. Avoids `console.log` spam
 * and gives consistent formatting + a single place to wire future sinks
 * (file rotation, forwarding to renderer, etc.).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const raw = process.env.OFFICE_AI_LOG_LEVEL?.toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

const MIN_LEVEL = LEVEL_RANK[resolveMinLevel()];

function fmt(level: LogLevel, scope: string, message: string, extra?: unknown): string {
  const ts = new Date().toISOString();
  const head = `${ts} [${level.toUpperCase()}] [${scope}] ${message}`;
  if (extra === undefined) return head;
  try {
    return `${head} ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`;
  } catch {
    return `${head} [unserializable extra]`;
  }
}

function emit(level: LogLevel, scope: string, message: string, extra?: unknown): void {
  if (LEVEL_RANK[level] < MIN_LEVEL) return;
  const line = fmt(level, scope, message, extra);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export interface Logger {
  debug(message: string, extra?: unknown): void;
  info(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
  child(subScope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, extra) => emit('debug', scope, msg, extra),
    info: (msg, extra) => emit('info', scope, msg, extra),
    warn: (msg, extra) => emit('warn', scope, msg, extra),
    error: (msg, extra) => emit('error', scope, msg, extra),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

export const logger = createLogger('main');