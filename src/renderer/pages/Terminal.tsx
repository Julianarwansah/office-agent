import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, Plus, X, Loader2, ChevronRight } from 'lucide-react';
import { api, unwrap } from '../lib/api';
import { cn } from '../lib/utils';
import { useAppStore } from '../stores/app';

interface Session {
  id: string;
  sessionId: string;
  label: string;
  output: string;
  running: boolean;
  exitCode: number | null;
}

const TerminalPage: React.FC = () => {
  const appSettings = useAppStore((s) => s.appSettings);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [creating, setCreating] = useState(false);

  const unsubRef = useRef<Array<() => void>>([]);
  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(1);

  useEffect(() => {
    setCurrentPage('Terminal');
    return () => {
      for (const off of unsubRef.current) off();
    };
  }, [setCurrentPage]);

  const appendOutput = useCallback((sessionId: string, data: string) => {
    setSessions((prev) =>
      prev.map((s) => s.sessionId === sessionId ? { ...s, output: s.output + data } : s),
    );
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [sessions]);

  async function createSession() {
    setCreating(true);
    try {
      const shell = appSettings?.terminalShell || undefined;
      const { sessionId } = unwrap(await api.terminal.create({ shell }));
      const id = String(counterRef.current++);
      const session: Session = {
        id,
        sessionId,
        label: `Session ${id}`,
        output: '',
        running: true,
        exitCode: null,
      };

      const offData = api.events.onTerminalData((evt) => {
        if (evt.sessionId !== sessionId) return;
        appendOutput(sessionId, evt.data);
      });
      const offExit = api.events.onTerminalExit((evt) => {
        if (evt.sessionId !== sessionId) return;
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === sessionId
              ? { ...s, running: false, exitCode: evt.code ?? 0, output: s.output + `\r\n[Process exited with code ${evt.code ?? 0}]\r\n` }
              : s,
          ),
        );
      });
      unsubRef.current.push(offData, offExit);

      setSessions((prev) => [...prev, session]);
      setActiveId(id);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create terminal session');
    } finally {
      setCreating(false);
    }
  }

  async function killSession(s: Session) {
    try { await api.terminal.kill(s.sessionId); } catch { /* ignore */ }
    const nextSessions = sessions.filter((x) => x.id !== s.id);
    setSessions(nextSessions);
    if (activeId === s.id) {
      setActiveId(nextSessions[nextSessions.length - 1]?.id ?? null);
    }
  }

  async function sendCommand(e: React.FormEvent) {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd || !activeSession) return;
    setInput('');
    appendOutput(activeSession.sessionId, `$ ${cmd}\n`);
    try {
      await api.terminal.write({ sessionId: activeSession.sessionId, data: cmd + '\n' });
    } catch (err) {
      appendOutput(activeSession.sessionId, `[write error] ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      {/* Tab bar */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setActiveId(s.id); setTimeout(() => inputRef.current?.focus(), 30); }}
              className={cn(
                'group flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeId === s.id
                  ? 'bg-slate-900 text-white dark:bg-slate-700'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50',
              )}
            >
              <TerminalIcon size={11} />
              {s.label}
              {!s.running && <span className="text-slate-400">(done)</span>}
              <span
                onClick={(e) => { e.stopPropagation(); void killSession(s); }}
                className="ml-0.5 rounded p-0.5 opacity-0 hover:bg-slate-700/20 group-hover:opacity-100"
                role="button"
                aria-label="Close"
              >
                <X size={10} />
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void createSession()}
          disabled={creating}
          className="flex flex-shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          New
        </button>
      </div>

      {/* Output / empty state */}
      {!activeSession ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-slate-100 shadow-lg dark:bg-slate-700">
            <TerminalIcon size={28} />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">No terminal sessions</h2>
          <p className="max-w-xs text-sm text-slate-500">
            Start a new session to run shell commands. Output is streamed in real-time.
          </p>
          <button
            type="button"
            onClick={() => void createSession()}
            disabled={creating}
            className="btn-primary"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            New Session
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
          <pre
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed text-slate-100 scrollbar-thin"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {activeSession.output || <span className="text-slate-500">Session started. Type a command below.</span>}
          </pre>

          <form
            onSubmit={(e) => void sendCommand(e)}
            className="flex flex-shrink-0 items-center gap-2 border-t border-slate-700 bg-slate-900 px-4 py-2"
          >
            <ChevronRight size={14} className="flex-shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!activeSession.running}
              placeholder={activeSession.running ? 'Enter command…' : 'Session ended'}
              className="flex-1 bg-transparent font-mono text-sm text-slate-100 outline-none placeholder-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!activeSession.running || !input.trim()}
              className="rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-700 disabled:opacity-40"
            >
              Run
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TerminalPage;
