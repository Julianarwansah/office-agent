/**
 * Lightweight singleton event bus used by the orchestrator and IPC layer to
 * broadcast agent lifecycle events to the renderer / other consumers.
 */

import {
  OrchestratorEventMap,
  OrchestratorEventName,
  OrchestratorListener,
  TypedEventEmitter,
} from './types';

let _bus: TypedEventEmitter<OrchestratorEventMap> | null = null;

/**
 * Returns the process-wide orchestrator event bus. Lazily created on first use.
 */
export function getEventBus(): TypedEventEmitter<OrchestratorEventMap> {
  if (!_bus) {
    _bus = new TypedEventEmitter<OrchestratorEventMap>();
  }
  return _bus;
}

/**
 * Replace the singleton (used in tests).
 */
export function setEventBus(bus: TypedEventEmitter<OrchestratorEventMap>): void {
  _bus = bus;
}

/**
 * Reset the singleton to a fresh, empty event bus.
 */
export function resetEventBus(): void {
  if (_bus) _bus.removeAllListeners();
  _bus = null;
}

/**
 * Subscribe to an orchestrator event. Returns an unsubscribe function.
 */
export function on<K extends OrchestratorEventName>(
  event: K,
  listener: OrchestratorListener<K>,
): () => void {
  return getEventBus().on(event, listener);
}

/**
 * Unsubscribe from an orchestrator event.
 */
export function off<K extends OrchestratorEventName>(
  event: K,
  listener: OrchestratorListener<K>,
): void {
  getEventBus().off(event, listener);
}

/**
 * Emit an orchestrator event. Wraps the singleton for convenience.
 */
export function emit<K extends OrchestratorEventName>(
  event: K,
  payload: OrchestratorEventMap[K],
): void {
  getEventBus().emit(event, payload);
}

export { TypedEventEmitter };