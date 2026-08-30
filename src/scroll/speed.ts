/**
 * The slider's arithmetic, kept in its own module because it is the part that
 * is easy to get subtly wrong and impossible to eyeball against a moving page.
 *
 * Speeds are CSS pixels per second, the only unit the engine ever deals in.
 * "Lines per second" or "percent of viewport" would both need the page's own
 * measurements to mean anything, and the engine would have to re-derive them
 * every time a page reflowed mid-crawl.
 */

/** Below this, a page takes longer to read than anyone would sit still for. */
export const MIN_SPEED_PX_PER_S = 4;

/** Above this the page is a blur and nothing on it can be read. */
export const MAX_SPEED_PX_PER_S = 400;

/** A comfortable reading crawl: roughly a screen every forty seconds. */
export const DEFAULT_SPEED_PX_PER_S = 20;

/**
 * The useful range spans two orders of magnitude, and almost all of the reading
 * happens in its bottom fifth — so the slider is exponential. Linear, the first
 * few pixels of the track would hold every speed anyone actually reads at, and
 * the rest would hold speeds that differ only in how unreadable they are.
 */
const RATIO = MAX_SPEED_PX_PER_S / MIN_SPEED_PX_PER_S;

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return DEFAULT_SPEED_PX_PER_S;
  return Math.min(MAX_SPEED_PX_PER_S, Math.max(MIN_SPEED_PX_PER_S, speed));
}

/**
 * Coarser as the number grows, because what is felt is the *proportion*: one
 * pixel per second is a quarter of the slowest speed and a rounding error at
 * the fastest.
 */
export function roundSpeed(speed: number): number {
  const clamped = clampSpeed(speed);
  return clamped < 20 ? Math.round(clamped * 10) / 10 : Math.round(clamped);
}

/** A slider position, 0 to 1, as a speed. */
export function fractionToSpeed(fraction: number): number {
  const at = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return roundSpeed(MIN_SPEED_PX_PER_S * RATIO ** at);
}

/** Where a speed sits along the slider, 0 to 1. The inverse of `fractionToSpeed`. */
export function speedToFraction(speed: number): number {
  return Math.log(clampSpeed(speed) / MIN_SPEED_PX_PER_S) / Math.log(RATIO);
}

/** The speed as a label, with no trailing `.0` on whole numbers. */
export function formatSpeed(speed: number): string {
  return `${roundSpeed(speed)} px/s`;
}
