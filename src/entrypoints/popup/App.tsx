import { useEffect, useRef, useState } from 'react';
import {
  canScrollPage,
  readTabStatus,
  resolveTargetTab,
  setTabSpeed,
  startTab,
  stopTab,
} from '@/lib/tabs';
import { readSettings, saveSpeed } from '@/lib/settings';
import PinControl from './PinControl';
import {
  DEFAULT_SPEED_PX_PER_S,
  formatSpeed,
  fractionToSpeed,
  speedToFraction,
} from '@/scroll/speed';

/**
 * The slider is an integer input mapped onto the speed curve, rather than a
 * float input over the speeds themselves. A range input's own steps are linear
 * whatever its bounds, so putting speeds on it directly would put every
 * readable speed in the first few pixels of the track — the thing `speed.ts`
 * exists to avoid.
 */
const SLIDER_STEPS = 1000;

type Page =
  | { kind: 'loading' }
  /** A page nothing can be injected into: a browser page, or the Web Store. */
  | { kind: 'closed' }
  | { kind: 'open'; tabId: number; url: string; running: boolean; scrollable: boolean };

export default function App() {
  const [page, setPage] = useState<Page>({ kind: 'loading' });
  const [speed, setSpeed] = useState(DEFAULT_SPEED_PX_PER_S);
  const dragging = useRef(false);

  useEffect(() => {
    void (async () => {
      const settings = await readSettings();
      setSpeed(settings.speed);

      const tab = await resolveTargetTab();
      if (tab?.id === undefined || !canScrollPage(tab.url ?? '')) {
        setPage({ kind: 'closed' });
        return;
      }

      // A plain read, with no injection behind it: opening the popup on a page
      // is not a request to install anything in it.
      const status = await readTabStatus(tab.id);
      setPage({
        kind: 'open',
        tabId: tab.id,
        url: tab.url ?? '',
        running: status?.running ?? false,
        scrollable: status?.scrollable ?? true,
      });
      if (status !== null) setSpeed(status.speed);
    })();
  }, []);

  async function toggle() {
    if (page.kind !== 'open') return;
    const status = page.running ? await stopTab(page.tabId) : await startTab(page.tabId, speed);
    setPage({
      ...page,
      running: status?.running ?? false,
      // A start that found nothing to scroll says so in the same breath, which
      // is how the control greys itself out rather than failing silently.
      scrollable: status?.scrollable ?? false,
    });
  }

  function onSlide(value: number) {
    dragging.current = true;
    const next = fractionToSpeed(value / SLIDER_STEPS);
    setSpeed(next);
    if (page.kind === 'open') void setTabSpeed(page.tabId, next);
  }

  // The write happens when the thumb is let go, not on every pixel of the drag:
  // `input` fires per pixel, and a storage write per pixel is a hundred writes
  // for one choice.
  function onCommit() {
    dragging.current = false;
    void saveSpeed(speed);
  }

  const running = page.kind === 'open' && page.running;
  const disabled = page.kind !== 'open' || !page.scrollable;

  return (
    <main className="w-72 bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="toggle"
          onClick={() => void toggle()}
          disabled={disabled}
          aria-label={running ? 'Stop scrolling' : 'Start scrolling'}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-neutral-950 transition-colors hover:bg-amber-400 disabled:bg-neutral-200 disabled:text-neutral-400 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600"
        >
          {running ? (
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
              <path d="M8 5l11 7-11 7z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            data-testid="speed"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={Math.round(speedToFraction(speed) * SLIDER_STEPS)}
            disabled={disabled}
            aria-label="Scroll speed"
            onChange={(event) => onSlide(Number(event.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            className="w-full accent-amber-500"
          />
          <p
            data-testid="readout"
            className="mt-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
          >
            {formatSpeed(speed)}
          </p>
        </div>
      </div>

      {page.kind === 'open' && (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <PinControl url={page.url} />
        </div>
      )}

      {page.kind === 'closed' && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          This page can’t be scrolled by an extension.
        </p>
      )}
      {page.kind === 'open' && !page.scrollable && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          There’s nothing to scroll on this page.
        </p>
      )}
    </main>
  );
}
