import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { changePin, readPins, setPinSpeed, unpinSite, type Pin } from '@/pins/pins';
import { DEFAULT_POSITION } from '@/panel/position';
import { readSettings, saveManualScroll, savePanelPosition, saveSpeed } from '@/lib/settings';
import type { ManualScroll } from '@/scroll/step';
import {
  DEFAULT_SPEED_PX_PER_S,
  formatSpeed,
  fractionToSpeed,
  speedToFraction,
} from '@/scroll/speed';

const SLIDER_STEPS = 1000;

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 py-8 first:border-t-0 dark:border-neutral-800">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {blurb !== undefined && (
        <p className="mt-1 max-w-prose text-sm text-neutral-500 dark:text-neutral-400">{blurb}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PinRow({
  pin,
  fallbackSpeed,
  onChanged,
}: {
  pin: Pin;
  /** Shown when this site has no speed of its own yet. */
  fallbackSpeed: number;
  onChanged: () => void;
}) {
  const [pattern, setPattern] = useState(pin.pattern);
  const [siteSpeed, setSiteSpeedValue] = useState(pin.speed ?? fallbackSpeed);
  const [touched, setTouched] = useState(false);

  function setSiteSpeed(next: number) {
    setTouched(true);
    setSiteSpeedValue(next);
  }

  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const edited = pattern.trim() !== pin.pattern;

  async function save() {
    setBusy(true);
    setNote(null);
    // Whether this prompts is Chrome's decision rather than ours: widening
    // asks, narrowing inside an origin already granted does not.
    const outcome = await changePin(pin.pattern, {
      pattern: pattern.trim(),
      host: pin.host,
      subdomains: pattern.includes('://*.'),
    });
    setBusy(false);

    if (outcome === 'pinned') onChanged();
    else if (outcome === 'declined') setNote('Not changed — Coast needs access to that pattern.');
    else setNote('That pattern could not be used.');
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <input
        value={pattern}
        onChange={(event) => setPattern(event.target.value)}
        spellCheck={false}
        aria-label={`Pattern for ${pin.host}`}
        className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 font-mono text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
      />
      {edited && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Save
        </button>
      )}
      <button
        type="button"
        data-testid="unpin"
        disabled={busy}
        onClick={() => void unpinSite(pin.pattern).then(onChanged)}
        className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        Unpin
      </button>
      <div className="flex w-full items-center gap-3 pl-1">
        <input
          type="range"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={Math.round(speedToFraction(siteSpeed) * SLIDER_STEPS)}
          aria-label={`Speed on ${pin.host}`}
          onChange={(event) =>
            setSiteSpeed(fractionToSpeed(Number(event.target.value) / SLIDER_STEPS))
          }
          onPointerUp={() => void setPinSpeed(pin.pattern, siteSpeed)}
          onKeyUp={() => void setPinSpeed(pin.pattern, siteSpeed)}
          className="w-48 accent-amber-500"
        />
        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {pin.speed === undefined && !touched ? 'Default speed' : formatSpeed(siteSpeed)}
        </span>
      </div>
      {note !== null && (
        <p className="w-full text-xs text-neutral-500 dark:text-neutral-400">{note}</p>
      )}
    </li>
  );
}

export default function App() {
  const [pins, setPins] = useState<Pin[] | null>(null);
  const [speed, setSpeed] = useState(DEFAULT_SPEED_PX_PER_S);
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [manualScroll, setManualScroll] = useState<ManualScroll>('pause');

  function refresh() {
    void readPins().then(setPins);
  }

  useEffect(() => {
    refresh();
    void readSettings().then((settings) => {
      setSpeed(settings.speed);
      setManualScroll(settings.manualScroll);
    });
    void browser.commands?.getAll().then((commands) => {
      const toggle = commands.find((command) => command.name === 'toggle-scroll');
      setShortcut(toggle?.shortcut === undefined || toggle.shortcut === '' ? null : toggle.shortcut);
    });
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-6 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="flex items-center gap-3 pb-6">
        <img src="/icon/48.png" alt="" width={40} height={40} className="rounded-[9px]" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Coast</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Auto scroll for reading. Coast can only reach the sites listed below.
          </p>
        </div>
      </header>

      <Section
        title="Pinned sites"
        blurb="Sites showing the on-page control. Each one is a permission you granted, and unpinning gives it back."
      >
        {pins === null ? null : pins.length === 0 ? (
          <p data-testid="no-pins" className="text-sm text-neutral-500 dark:text-neutral-400">
            Nothing pinned yet. Open the Coast popup on a site you read often and press{' '}
            <span className="font-medium text-neutral-700 dark:text-neutral-200">Pin on page</span>.
          </p>
        ) : (
          <ul data-testid="pins" className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {pins.map((pin) => (
              <PinRow key={pin.pattern} pin={pin} fallbackSpeed={speed} onChanged={refresh} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Default speed" blurb="Used on any site that has no speed of its own.">
        <div className="flex items-center gap-4">
          <input
            type="range"
            data-testid="default-speed"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={Math.round(speedToFraction(speed) * SLIDER_STEPS)}
            aria-label="Default scroll speed"
            onChange={(event) =>
              setSpeed(fractionToSpeed(Number(event.target.value) / SLIDER_STEPS))
            }
            onPointerUp={() => void saveSpeed(speed)}
            onKeyUp={() => void saveSpeed(speed)}
            className="w-64 accent-amber-500"
          />
          <span
            data-testid="default-speed-readout"
            className="text-sm tabular-nums text-neutral-500 dark:text-neutral-400"
          >
            {formatSpeed(speed)}
          </span>
        </div>
      </Section>

      <Section
        title="When I scroll manually"
        blurb="Coast notices the page moving, however you moved it — the wheel, the scrollbar, a link to a section further down."
      >
        <div className="space-y-2">
          {(
            [
              ['pause', 'Pause, then carry on', 'It waits until you stop, then continues from where you left it.'],
              ['stop', 'Stop scrolling', 'The crawl ends, and you press play again when you want it back.'],
            ] as const
          ).map(([value, label, blurb]) => (
            <label key={value} className="flex cursor-pointer gap-3">
              <input
                type="radio"
                name="manual-scroll"
                data-testid={`manual-${value}`}
                checked={manualScroll === value}
                onChange={() => {
                  setManualScroll(value);
                  void saveManualScroll(value);
                }}
                className="mt-0.5 accent-amber-500"
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-sm text-neutral-500 dark:text-neutral-400">{blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="On-page control"
        blurb="Drag the control anywhere on a pinned page. If it ends up somewhere you can’t reach, put it back."
      >
        <button
          type="button"
          data-testid="reset-position"
          onClick={() => void savePanelPosition(DEFAULT_POSITION)}
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Reset its position
        </button>
      </Section>

      <Section
        title="Keyboard shortcut"
        blurb="Coast ships with no shortcut assigned, so it cannot collide with one you already use."
      >
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {shortcut === null ? 'No shortcut set.' : `Currently ${shortcut}.`} Set one at{' '}
          <span className="font-mono text-xs text-neutral-700 dark:text-neutral-200">
            chrome://extensions/shortcuts
          </span>{' '}
          — Chrome does not allow a page to open that for you.
        </p>
      </Section>
    </main>
  );
}
