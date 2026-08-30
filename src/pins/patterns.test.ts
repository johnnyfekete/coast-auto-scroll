import { describe, it, expect } from 'vitest';
import { pinCandidates, patternMatches } from './patterns';

describe('what a pin can cover', () => {
  it('offers one choice on a bare domain, so pinning it takes no thinking', () => {
    expect(pinCandidates('https://medium.com/@someone/an-article')).toEqual([
      { pattern: '*://medium.com/*', host: 'medium.com', subdomains: false },
    ]);
  });

  it('offers the site and its parent domain on a subdomain', () => {
    expect(pinCandidates('https://tabs.ultimate-guitar.com/tab/a/b-1')).toEqual([
      { pattern: '*://tabs.ultimate-guitar.com/*', host: 'tabs.ultimate-guitar.com', subdomains: false },
      { pattern: '*://*.ultimate-guitar.com/*', host: 'ultimate-guitar.com', subdomains: true },
    ]);
  });

  it('offers every parent, by dropping one leading label at a time', () => {
    expect(pinCandidates('https://a.b.example.com/x').map((c) => c.pattern)).toEqual([
      '*://a.b.example.com/*',
      '*://*.b.example.com/*',
      '*://*.example.com/*',
    ]);
  });

  it('never offers a whole top-level domain', () => {
    // Dropping one more label from example.com would be `*.com`, which is not
    // a site and which Chrome refuses to grant anyway.
    const patterns = pinCandidates('https://example.com/').map((c) => c.pattern);
    expect(patterns).not.toContain('*://*.com/*');
  });

  it('never widens a public suffix into everyone else who uses it', () => {
    // Naively, someone.github.io has a parent of github.io — which is every
    // GitHub Pages site there is. It is still offered, because the reader may
    // genuinely mean it and Chrome names it plainly in its own dialog, but it
    // is never the first choice and never what a single click pins.
    const [first] = pinCandidates('https://someone.github.io/blog');
    expect(first?.pattern).toBe('*://someone.github.io/*');
    expect(first?.subdomains).toBe(false);
  });

  it('does not take an address apart as if it were a name', () => {
    // `*.168.1.1` is not a thing. An address is only ever itself.
    expect(pinCandidates('http://192.168.1.1/status').map((c) => c.pattern)).toEqual([
      '*://192.168.1.1/*',
    ]);
  });

  it('handles a single-label host', () => {
    expect(pinCandidates('http://localhost:3000/app').map((c) => c.pattern)).toEqual([
      '*://localhost/*',
    ]);
  });

  it('has nothing to offer for a page that cannot be pinned', () => {
    expect(pinCandidates('chrome://settings')).toEqual([]);
    expect(pinCandidates('https://chromewebstore.google.com/detail/x')).toEqual([]);
    expect(pinCandidates('')).toEqual([]);
  });
});

describe('whether a pin covers a page', () => {
  it('matches the exact host it names', () => {
    expect(patternMatches('*://medium.com/*', 'https://medium.com/an-article')).toBe(true);
    expect(patternMatches('*://medium.com/*', 'https://blog.medium.com/x')).toBe(false);
  });

  it('matches subdomains, and the bare domain too, when it was widened', () => {
    expect(patternMatches('*://*.medium.com/*', 'https://blog.medium.com/x')).toBe(true);
    expect(patternMatches('*://*.medium.com/*', 'https://medium.com/x')).toBe(true);
    expect(patternMatches('*://*.medium.com/*', 'https://notmedium.com/x')).toBe(false);
  });

  it('respects a path a reader narrowed a pin to', () => {
    expect(patternMatches('*://example.com/docs/*', 'https://example.com/docs/intro')).toBe(true);
    expect(patternMatches('*://example.com/docs/*', 'https://example.com/blog/intro')).toBe(false);
  });

  it('takes either scheme, and nothing else', () => {
    expect(patternMatches('*://example.com/*', 'http://example.com/')).toBe(true);
    expect(patternMatches('*://example.com/*', 'ftp://example.com/')).toBe(false);
  });
});
