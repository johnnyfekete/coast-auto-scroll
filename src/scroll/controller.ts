import { browser } from 'wxt/browser';
import { createEngine, type Engine } from './engine';
import {
  isScrollRequest,
  SET_SPEED,
  START,
  STOP,
  type ScrollRequest,
  type ScrollStatus,
} from './protocol';
import { readSettings, watchSettings } from '@/lib/settings';
import { DEFAULT_SPEED_PX_PER_S } from './speed';

/**
 * One crawl per frame, whoever asked for it.
 *
 * The popup reaches a page by injecting the controller script; a pinned site
 * already has one from its content script. Both want the same engine, and two
 * engines scrolling one page would race each other into a jitter with no
 * obvious cause.
 *
 * The rendezvous is a property on `globalThis` rather than a module-level
 * singleton, because a module-level one would not be shared: the content script
 * and the injected script are separate bundles, so each carries its own copy of
 * this file's module scope. What they *do* share is the isolated world — Chrome
 * gives one extension one world per frame — and that world has one global
 * object. This is the only place in the codebase that reaches for it.
 */
const CONTROLLER_KEY = '__coastController';

export type ScrollController = {
  status: () => ScrollStatus;
  /** Starts, or reports why it could not. Already running is a success. */
  start: () => ScrollStatus;
  stop: () => ScrollStatus;
  setSpeed: (speed: number) => ScrollStatus;
  /** Fires whenever the status changes, for a panel drawing it. Returns the unsubscribe. */
  subscribe: (fn: (status: ScrollStatus) => void) => () => void;
};

type ControllerHost = typeof globalThis & { [CONTROLLER_KEY]?: ScrollController };

function build(): ScrollController {
  const listeners = new Set<(status: ScrollStatus) => void>();

  function status(): ScrollStatus {
    return {
      running: engine.running(),
      speed: engine.speed(),
      // Answered from the engine's own resolution rather than remembered from
      // the last start: a page that had nothing to scroll a minute ago may have
      // finished loading since, and a button greyed out on a stale answer never
      // ungreys itself.
      scrollable: engine.running() || engine.scrollable(),
    };
  }

  function announce() {
    const current = status();
    for (const fn of listeners) fn(current);
  }

  // Both `status` and `announce` are hoisted declarations, so neither runs
  // before this line even though both name `engine`.
  const engine: Engine = createEngine(DEFAULT_SPEED_PX_PER_S, announce);

  // The stored speed arrives a tick late, which only matters if something
  // started scrolling inside that tick — at the default, and then corrected.
  // Better than a controller that cannot answer a status request until storage
  // has replied.
  void readSettings().then((settings) => {
    engine.setSpeed(settings.speed);
    announce();
  });

  watchSettings((settings) => {
    engine.setSpeed(settings.speed);
    announce();
  });

  const controller: ScrollController = {
    status,
    start() {
      engine.start();
      announce();
      return status();
    },
    stop() {
      engine.stop();
      announce();
      return status();
    },
    setSpeed(speed) {
      engine.setSpeed(speed);
      announce();
      return status();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  // Returning a value from this listener resolves the sender's `sendMessage`
  // promise, which is how the popup tells a page that has a controller from one
  // that does not: no controller, no answer, and the send rejects.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isScrollRequest(message)) return undefined;
    const request = message as ScrollRequest;
    if (request.type === START) {
      controller.setSpeed(request.speed);
      return Promise.resolve(controller.start());
    }
    if (request.type === STOP) return Promise.resolve(controller.stop());
    if (request.type === SET_SPEED) return Promise.resolve(controller.setSpeed(request.speed));
    return Promise.resolve(controller.status());
  });

  return controller;
}

/**
 * The controller for this frame, building it on first ask. Idempotent, which is
 * what makes a second injection into a page that already has one harmless
 * rather than a second engine.
 */
export function installController(): ScrollController {
  const host = globalThis as ControllerHost;
  const existing = host[CONTROLLER_KEY];
  if (existing !== undefined) return existing;
  const controller = build();
  host[CONTROLLER_KEY] = controller;
  return controller;
}
