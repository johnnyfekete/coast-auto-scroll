/**
 * Where the panel sits, as arithmetic.
 *
 * Measured from the **right and bottom edges** rather than from the top left,
 * because that is what survives a window being resized: a panel parked near the
 * bottom-right corner stays near it when the window narrows, where a saved
 * left/top would drift into the middle of the page or off the edge entirely.
 *
 * One position for every site, not one per site. The thing a panel collides
 * with is usually a *class* of widget rather than a particular site — chat
 * bubbles are always bottom-right, cookie banners always along the bottom — so
 * a reader who moves it once has answered the question everywhere.
 */

export type Position = {
  /** Distance from the viewport's right edge, in pixels. */
  right: number;
  /** Distance from the viewport's bottom edge, in pixels. */
  bottom: number;
};

export type Size = { width: number; height: number };

/** Out of the way of most reading, and where a reader expects a floating control. */
export const DEFAULT_POSITION: Position = { right: 16, bottom: 16 };

/**
 * Hold a position inside the viewport.
 *
 * Applied on the way in as well as during a drag, because a position saved on a
 * large monitor would otherwise put the panel somewhere unreachable when the
 * same profile opens on a laptop.
 */
export function clampPosition(position: Position, viewport: Size, panel: Size): Position {
  const maxRight = Math.max(0, viewport.width - panel.width);
  const maxBottom = Math.max(0, viewport.height - panel.height);
  return {
    right: Math.min(Math.max(position.right, 0), maxRight),
    bottom: Math.min(Math.max(position.bottom, 0), maxBottom),
  };
}

/**
 * Where a drag leaves the panel.
 *
 * The pointer's movement is subtracted rather than added: the offsets grow as
 * the panel moves *away* from the edges they are measured from.
 */
export function positionFromDrag(
  start: Position,
  moved: { x: number; y: number },
  viewport: Size,
  panel: Size,
): Position {
  return clampPosition(
    { right: start.right - moved.x, bottom: start.bottom - moved.y },
    viewport,
    panel,
  );
}
