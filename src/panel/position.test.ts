import { describe, it, expect } from 'vitest';
import { clampPosition, DEFAULT_POSITION, positionFromDrag } from './position';

const VIEWPORT = { width: 1000, height: 800 };
const PANEL = { width: 240, height: 44 };

describe('where the panel may sit', () => {
  it('leaves a position that is already on screen alone', () => {
    expect(clampPosition({ right: 200, bottom: 300 }, VIEWPORT, PANEL)).toEqual({
      right: 200,
      bottom: 300,
    });
  });

  it('will not let the panel be dragged off the right-hand edge', () => {
    expect(clampPosition({ right: -80, bottom: 20 }, VIEWPORT, PANEL).right).toBe(0);
  });

  it('will not let the panel be dragged off the left-hand edge either', () => {
    // Measured from the right, so falling off the left is a very large offset.
    const { right } = clampPosition({ right: 5_000, bottom: 20 }, VIEWPORT, PANEL);
    expect(right).toBe(VIEWPORT.width - PANEL.width);
  });

  it('keeps it inside the top and bottom', () => {
    expect(clampPosition({ right: 20, bottom: -50 }, VIEWPORT, PANEL).bottom).toBe(0);
    expect(clampPosition({ right: 20, bottom: 5_000 }, VIEWPORT, PANEL).bottom).toBe(
      VIEWPORT.height - PANEL.height,
    );
  });

  it('brings a position saved on a bigger screen back into view on a smaller one', () => {
    const saved = { right: 1_800, bottom: 900 };
    const onLaptop = clampPosition(saved, { width: 1_200, height: 700 }, PANEL);
    expect(onLaptop.right).toBeLessThanOrEqual(1_200 - PANEL.width);
    expect(onLaptop.bottom).toBeLessThanOrEqual(700 - PANEL.height);
  });

  it('starts in the bottom right, out of the way of most reading', () => {
    expect(DEFAULT_POSITION).toEqual({ right: 16, bottom: 16 });
  });
});

describe('turning a drag into a position', () => {
  it('measures from the edges the panel is anchored to', () => {
    // The pointer moved 30px left and 50px up from where it started, so the
    // panel's distance from the right and bottom edges each grow by that much.
    const moved = positionFromDrag({ right: 16, bottom: 16 }, { x: -30, y: -50 }, VIEWPORT, PANEL);
    expect(moved).toEqual({ right: 46, bottom: 66 });
  });

  it('clamps as it goes, so a drag cannot fling it off screen', () => {
    const moved = positionFromDrag({ right: 16, bottom: 16 }, { x: 400, y: 400 }, VIEWPORT, PANEL);
    expect(moved.right).toBe(0);
    expect(moved.bottom).toBe(0);
  });
});
