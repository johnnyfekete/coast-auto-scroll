import { browser } from 'wxt/browser';
import { initialState, step, type ScrollState } from './step';
import { resolveScroller, type Scroller } from './scroller';
import { clampSpeed } from './speed';

/**
 * The animation-frame loop. Everything with a decision in it lives in
 * `step.ts`; this file is the part that reads a real page and writes to it, and
 * it is deliberately the only part that cannot be tested without one. What it
 * does is covered end to end, against real Chrome.
 */

export type Engine = {
  /** Starts the crawl. False when this page has nothing that scrolls. */
  start: () => boolean;
  stop: () => void;
  running: () => boolean;
  /** Whether the page has anything to scroll, checked fresh. */
  scrollable: () => boolean;
  speed: () => number;
  setSpeed: (speed: number) => void;
};

/** `onStop` fires only for a stop the engine decided on by itself. */
export function createEngine(initialSpeed: number, onStop: () => void): Engine {
  let speed = clampSpeed(initialSpeed);
  let scroller: Scroller | null = null;
  let state: ScrollState | null = null;
  let previous = 0;
  let frame: number | null = null;

  function halt() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    scroller = null;
    state = null;
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);

    // An extension reload tears down this world's access to the extension but
    // not the loop itself, and a page that goes on scrolling under a panel that
    // has stopped answering is the worst of both. The property read is free.
    if (browser.runtime?.id === undefined) {
      halt();
      return;
    }

    // The pane we were scrolling was unmounted — a single-page navigation, or a
    // panel that closed. Re-resolving beats stopping: the reader did not ask
    // for this and would only have to press play again.
    if (scroller === null || !scroller.alive()) {
      scroller = resolveScroller();
      if (scroller === null) {
        halt();
        onStop();
        return;
      }
      state = initialState(scroller.position(), now);
      previous = now;
      return;
    }

    const result = step(state ?? initialState(scroller.position(), now), {
      now,
      elapsed: now - previous,
      actual: scroller.position(),
      max: scroller.max(),
      speed,
    });
    previous = now;
    state = result.state;
    if (result.scrollTo !== null) scroller.scrollTo(result.scrollTo);

    // The page ended: the bottom stopped moving and stayed still. Scroll to the
    // last position first, then stop — the reader should be left looking at the
    // end of the page rather than a frame short of it.
    if (result.finished) {
      halt();
      onStop();
    }
  }

  return {
    start() {
      if (frame !== null) return true;
      scroller = resolveScroller();
      if (scroller === null) return false;

      // `performance.now()` because that is the clock `requestAnimationFrame`
      // hands its callback, and the first frame's elapsed time is a subtraction
      // between the two. `Date.now()` would make that difference an epoch.
      const now = performance.now();
      state = initialState(scroller.position(), now);
      previous = now;
      frame = requestAnimationFrame(tick);
      return true;
    },
    stop: halt,
    running: () => frame !== null,
    scrollable: () => resolveScroller() !== null,
    speed: () => speed,
    setSpeed(next) {
      speed = clampSpeed(next);
    },
  };
}
