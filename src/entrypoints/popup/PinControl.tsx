import { useEffect, useState } from 'react';
import { pinCandidates, type PinCandidate } from '@/pins/patterns';
import { pinFor, pinSite, type Pin } from '@/pins/pins';

/**
 * Pinning, from the popup.
 *
 * A bare domain has exactly one thing a pin could mean, so it takes one click
 * and no choice. Only a subdomain offers anything to pick between, and even
 * then the exact site is chosen by default — widening is a deliberate act, and
 * Chrome's own dialog is what finally names what is being granted.
 */
export default function PinControl({ url }: { url: string }) {
  const [candidates, setCandidates] = useState<PinCandidate[]>([]);
  const [chosen, setChosen] = useState(0);
  const [pinned, setPinned] = useState<Pin | null>(null);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCandidates(pinCandidates(url));
    void pinFor(url).then(setPinned);
  }, [url]);

  async function pin() {
    const candidate = candidates[chosen];
    if (candidate === undefined) return;

    setBusy(true);
    setDeclined(false);
    const outcome = await pinSite(candidate);
    setBusy(false);

    if (outcome !== 'pinned') {
      setDeclined(true);
      return;
    }
    // Nothing here makes the panel appear. The worker watches for a pin being
    // written and shows the panel on every open tab the pin covers — including
    // this one — because a reader who pins and immediately looks back at the
    // page closes this popup, and any work still in flight closes with it.
    setPinned(await pinFor(url));
  }

  if (candidates.length === 0) return null;

  if (pinned !== null) {
    return (
      <p data-testid="pin-state" className="text-xs text-neutral-500 dark:text-neutral-400">
        Pinned on <span className="font-medium text-amber-600 dark:text-amber-400">{pinned.host}</span>
        {pinned.subdomains ? ' and its subdomains' : ''}.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {candidates.length > 1 && (
        <select
          data-testid="pin-scope"
          value={chosen}
          onChange={(event) => setChosen(Number(event.target.value))}
          className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {candidates.map((candidate, index) => (
            <option key={candidate.pattern} value={index}>
              {candidate.subdomains ? `All of ${candidate.host}` : candidate.host}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        data-testid="pin"
        disabled={busy}
        onClick={() => void pin()}
        className="w-full rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-400"
      >
        Pin on page
      </button>

      {declined && (
        <p data-testid="pin-declined" className="text-xs text-neutral-500 dark:text-neutral-400">
          Not pinned — Coast needs access to this site to show the control on it.
        </p>
      )}
    </div>
  );
}
