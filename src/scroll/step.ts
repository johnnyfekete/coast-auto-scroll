/**
 * One frame of scrolling, as arithmetic.
 *
 * Pure: the caller reads the real scroll position and hands the numbers over,
 * and gets back where to put the page next — or nothing, when the page should
 * be left exactly where it is.
 *
 * The whole of the "you scrolled, so I got out of the way" rule lives here, and
 * it is expressed as a *comparison of positions* rather than as wheel and key
 * listeners. Two reasons, the second of which decides it:
 *
 * - Input events miss things. Dragging the scrollbar fires no `wheel`; a page's
 *   own jump-to-section link fires no key. Both move the page, and both should
 *   pause the crawl.
 * - We already know where we put the page last frame. Anything else moving it
 *   shows up as a discrepancy on the very next frame, whatever caused it. That
 *   makes the check total, rather than a list of the ways a page can be
 *   scrolled — a list that is never finished.
 */

/** How long the crawl holds still after something else moved the page. */
export const OVERRIDE_PAUSE_MS = 500;

/**
 * How far the page may sit from where we put it before we conclude somebody
 * else moved it.
 *
 * Not zero. A browser stores the scroll offset at device-pixel resolution, so a
 * fractional target comes back rounded, and at the slowest speeds one frame of
 * travel is a tenth of a pixel — below what the page can represent at all. Two
 * pixels absorbs that and still catches the smallest deliberate scroll anyone
 * makes.
 */
export const DRIFT_TOLERANCE_PX = 2;

/**
 * The longest gap between frames the crawl will bill for. A backgrounded tab
 * runs no animation frames, so the first frame after returning to it reports
 * every second it was away — and would scroll the page by minutes of travel in
 * a single jump.
 */
export const MAX_STEP_MS = 100;

/**
 * How long the crawl sits at the bottom of a page, finding no more page, before
 * it calls the reading finished.
 *
 * The alternatives are both wrong, each for one case. Stopping the instant the
 * bottom is reached kills a crawl on an infinite feed that has merely paused to
 * load; never stopping at all leaves the control claiming to run for the rest
 * of the afternoon after an article has ended. Waiting is what tells those two
 * apart, and three seconds is long enough for a feed to fetch and short enough
 * that a finished article does not sit there.
 */
export const BOTTOM_STALL_MS = 3_000;

export type ScrollState = {
  /** Where we last asked the page to be, in fractional pixels. */
  position: number;
  /** Time until which the crawl keeps its hands off. */
  pausedUntil: number;
  /**
   * When the page first stopped having anywhere left to go, or null while it
   * still does. This is the whole of the end-of-page rule's memory, which is
   * why the rule lives here rather than as a timer in the animation loop: a
   * timer would have to be started, cancelled and re-started by the loop, and
   * none of that could be tested without a real page.
   */
  stalledSince: number | null;
};

export type ScrollInput = {
  now: number;
  /** Milliseconds since the previous step. */
  elapsed: number;
  /** Where the page actually is, right now. */
  actual: number;
  /** The furthest the page can scroll: its full height less what is on screen. */
  max: number;
  /** Pixels per second. */
  speed: number;
};

export type ScrollStep = {
  state: ScrollState;
  /** Where to put the page, or null to leave it exactly where it is. */
  scrollTo: number | null;
  /** True once the page has ended: at the bottom, with no more of it arriving. */
  finished: boolean;
};

/** A state that will not move the page until the next step says to. */
export function initialState(actual: number, now: number): ScrollState {
  return { position: actual, pausedUntil: now, stalledSince: null };
}

export function step(state: ScrollState, input: ScrollInput): ScrollStep {
  const max = Number.isFinite(input.max) && input.max > 0 ? input.max : 0;
  const actual = Math.min(Math.max(input.actual, 0), max);

  // Somebody else moved the page. Adopt their position — resuming from where
  // the reader put it is the whole point — and start the clock again. Held
  // rather than extended: a wheel gesture arrives as a run of frames, so this
  // fires on each one and the pause ends shortly after the *last* of them
  // rather than shortly after the first.
  if (Math.abs(actual - state.position) > DRIFT_TOLERANCE_PX) {
    return {
      state: {
        position: actual,
        pausedUntil: input.now + OVERRIDE_PAUSE_MS,
        // A reader who moves the page is not a page that has ended, even if
        // they moved it while sitting at the bottom.
        stalledSince: null,
      },
      scrollTo: null,
      finished: false,
    };
  }

  // Still inside the pause. Keep tracking the page, so a reader who nudges it
  // once and stops resumes from where they left it rather than from where the
  // pause began.
  if (input.now < state.pausedUntil) {
    return {
      state: { position: actual, pausedUntil: state.pausedUntil, stalledSince: state.stalledSince },
      scrollTo: null,
      finished: false,
    };
  }

  const elapsed = Number.isFinite(input.elapsed)
    ? Math.min(Math.max(input.elapsed, 0), MAX_STEP_MS)
    : 0;
  const speed = Number.isFinite(input.speed) && input.speed > 0 ? input.speed : 0;

  // Clamped to the bottom rather than stopped there: an infinite feed grows
  // underneath us, and a crawl that switched itself off on first touching the
  // end would never see the content that arrived a moment later.
  const next = Math.min(max, state.position + (speed * elapsed) / 1000);

  // Being at the bottom is the clamp having bitten: there was further to go and
  // the page had nowhere to put it. A page that grows lifts `max` above `next`
  // again on the very next step, which is what clears the wait without anything
  // having to watch for growth explicitly.
  const atBottom = next >= max;
  const stalledSince = atBottom ? (state.stalledSince ?? input.now) : null;

  return {
    state: { position: next, pausedUntil: state.pausedUntil, stalledSince },
    scrollTo: next,
    finished: stalledSince !== null && input.now - stalledSince >= BOTTOM_STALL_MS,
  };
}
