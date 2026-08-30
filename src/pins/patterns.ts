import { canScrollPage } from '@/lib/tabs';

/**
 * What a pin is allowed to cover, worked out from the page the reader is
 * standing on.
 *
 * Candidates are built by **dropping one leading label at a time**, and by
 * nothing cleverer than that. The obvious alternative is to compute the
 * registrable domain — "keep the last two labels" — and it is wrong in a way
 * that only shows up on other people's sites: `someone.github.io` becomes
 * `github.io`, which is every GitHub Pages site there is, and `bbc.co.uk`
 * becomes `co.uk`, which Chrome refuses outright, so the pin fails with an
 * error about a pattern the reader never typed. Getting that right needs the
 * Public Suffix List, thirty kilobytes that go stale.
 *
 * So nothing here guesses. The exact host is always first and is what a single
 * click pins; anything wider is a second choice the reader makes deliberately,
 * and Chrome's own dialog names it before it is granted.
 */

export type PinCandidate = {
  /** A Chrome match pattern. */
  pattern: string;
  /** The host or domain it covers, for showing to the reader. */
  host: string;
  /** Whether it reaches subdomains as well as the domain itself. */
  subdomains: boolean;
};

/** Hosts that have no name structure to take apart. */
function isAddress(host: string): boolean {
  // IPv4, or a bracketed IPv6 literal.
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

export function pinCandidates(url: string): PinCandidate[] {
  if (!canScrollPage(url)) return [];

  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return [];
    host = parsed.hostname;
  } catch {
    return [];
  }
  if (host === '') return [];

  const exact: PinCandidate = { pattern: `*://${host}/*`, host, subdomains: false };
  if (isAddress(host)) return [exact];

  const labels = host.split('.');
  const wider: PinCandidate[] = [];
  // Stop before the last two labels would become one: `*.com` is not a site.
  for (let drop = 1; labels.length - drop >= 2; drop++) {
    const parent = labels.slice(drop).join('.');
    wider.push({ pattern: `*://*.${parent}/*`, host: parent, subdomains: true });
  }

  return [exact, ...wider];
}

/**
 * Whether a pin's pattern covers a page.
 *
 * Chrome does the real matching when it decides where to run a registered
 * content script; this is for the parts of the extension that have to answer
 * the same question themselves — chiefly the popup, working out whether the
 * site in front of it is already pinned.
 */
export function patternMatches(pattern: string, url: string): boolean {
  const parsed = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);
  if (parsed === null) return false;
  const [, scheme, hostPattern, pathPattern] = parsed as unknown as [string, string, string, string];

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }

  const wantedScheme = target.protocol.slice(0, -1);
  if (scheme === '*') {
    if (wantedScheme !== 'http' && wantedScheme !== 'https') return false;
  } else if (wantedScheme !== scheme) {
    return false;
  }

  if (hostPattern.startsWith('*.')) {
    const domain = hostPattern.slice(2);
    // A leading wildcard covers the domain itself as well as anything under it,
    // which is what Chrome does and what a reader widening a pin expects.
    if (target.hostname !== domain && !target.hostname.endsWith(`.${domain}`)) return false;
  } else if (target.hostname !== hostPattern) {
    return false;
  }

  const path = target.pathname + target.search;
  const escaped = pathPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(path);
}
