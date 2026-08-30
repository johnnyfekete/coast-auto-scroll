import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SPEED_PX_PER_S,
  MAX_SPEED_PX_PER_S,
  MIN_SPEED_PX_PER_S,
  clampSpeed,
  formatSpeed,
  fractionToSpeed,
  speedToFraction,
} from './speed';

describe('clampSpeed', () => {
  it('keeps a speed inside the range', () => {
    expect(clampSpeed(50)).toBe(50);
  });

  it('pulls speeds outside the range back to the edges', () => {
    expect(clampSpeed(0)).toBe(MIN_SPEED_PX_PER_S);
    expect(clampSpeed(10_000)).toBe(MAX_SPEED_PX_PER_S);
    expect(clampSpeed(-30)).toBe(MIN_SPEED_PX_PER_S);
  });

  it('answers a nonsense number with the default', () => {
    expect(clampSpeed(Number.NaN)).toBe(DEFAULT_SPEED_PX_PER_S);
    expect(clampSpeed(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SPEED_PX_PER_S);
  });
});

describe('the slider curve', () => {
  it('puts the slowest speed at the bottom and the fastest at the top', () => {
    expect(fractionToSpeed(0)).toBe(MIN_SPEED_PX_PER_S);
    expect(fractionToSpeed(1)).toBe(MAX_SPEED_PX_PER_S);
  });

  it('is exponential, so the midpoint is the geometric mean rather than the average', () => {
    // 4 and 400 are two orders of magnitude apart; halfway along the track is
    // 40 px/s, not the 202 px/s a linear slider would give.
    expect(fractionToSpeed(0.5)).toBe(40);
  });

  it('spends most of the track on speeds anyone reads at', () => {
    // Everything up to a brisk 40 px/s sits in the lower half of the slider.
    expect(speedToFraction(40)).toBeCloseTo(0.5, 5);
    expect(fractionToSpeed(0.25)).toBeLessThan(15);
  });

  it('round-trips a speed through the slider and back', () => {
    for (const speed of [4, 8, 20, 60, 150, 400]) {
      expect(fractionToSpeed(speedToFraction(speed))).toBe(speed);
    }
  });

  it('holds a fraction outside 0 to 1 to the ends of the track', () => {
    expect(fractionToSpeed(-1)).toBe(MIN_SPEED_PX_PER_S);
    expect(fractionToSpeed(4)).toBe(MAX_SPEED_PX_PER_S);
  });
});

describe('formatSpeed', () => {
  it('keeps a decimal at the slow end, where one pixel a second is a quarter of the speed', () => {
    expect(formatSpeed(4.25)).toBe('4.3 px/s');
  });

  it('drops the decimal above 20, where it is a rounding error', () => {
    expect(formatSpeed(123.4)).toBe('123 px/s');
  });

  it('does not write a trailing zero', () => {
    expect(formatSpeed(8)).toBe('8 px/s');
  });
});
