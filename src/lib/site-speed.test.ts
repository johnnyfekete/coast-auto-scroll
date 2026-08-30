import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { installFakeChrome, type FakeChrome } from '@/pins/testing';
import { pinCandidates } from '@/pins/patterns';
import { pinSite, readPins, unpinSite } from '@/pins/pins';
import { readSettings } from '@/lib/settings';
import { DEFAULT_SPEED_PX_PER_S } from '@/scroll/speed';
import { saveSpeedForSite, speedForSite } from './site-speed';

const GUITAR = 'https://tabs.ultimate-guitar.com/tab/a/b-1';
const FEED = 'https://medium.com/@someone/an-article';

let chrome: FakeChrome;

beforeEach(() => {
  fakeBrowser.reset();
  chrome = installFakeChrome();
});

afterEach(() => {
  chrome.restore();
});

describe('the speed a site scrolls at', () => {
  it('is the default on a site that was never pinned', async () => {
    expect(await speedForSite('https://example.com/')).toBe(DEFAULT_SPEED_PX_PER_S);
  });

  it('is the default on a pinned site that has no speed of its own yet', async () => {
    await pinSite(pinCandidates(GUITAR)[0]!);
    expect(await speedForSite(GUITAR)).toBe(DEFAULT_SPEED_PX_PER_S);
  });

  it('is the site’s own speed once one has been chosen there', async () => {
    await pinSite(pinCandidates(GUITAR)[0]!);
    await saveSpeedForSite(GUITAR, 8);
    expect(await speedForSite(GUITAR)).toBe(8);
  });

  it('lets two pinned sites disagree, which is the point of it', async () => {
    await pinSite(pinCandidates(GUITAR)[0]!);
    await pinSite(pinCandidates(FEED)[0]!);

    await saveSpeedForSite(GUITAR, 8);
    await saveSpeedForSite(FEED, 200);

    expect(await speedForSite(GUITAR)).toBe(8);
    expect(await speedForSite(FEED)).toBe(200);
  });

  it('does not let a pinned site change the speed everywhere else', async () => {
    await pinSite(pinCandidates(GUITAR)[0]!);
    await saveSpeedForSite(GUITAR, 8);

    expect((await readSettings()).speed).toBe(DEFAULT_SPEED_PX_PER_S);
    expect(await speedForSite('https://example.com/')).toBe(DEFAULT_SPEED_PX_PER_S);
  });

  it('changes the default when the site is not pinned, since there is nowhere else to put it', async () => {
    await saveSpeedForSite('https://example.com/', 120);
    expect((await readSettings()).speed).toBe(120);
  });

  it('holds a stored speed inside the range the slider can express', async () => {
    await pinSite(pinCandidates(GUITAR)[0]!);
    await saveSpeedForSite(GUITAR, 99_999);
    expect(await speedForSite(GUITAR)).toBeLessThanOrEqual(400);
  });

  it('forgets a site’s speed when it is unpinned', async () => {
    const candidate = pinCandidates(GUITAR)[0]!;
    await pinSite(candidate);
    await saveSpeedForSite(GUITAR, 8);

    await unpinSite(candidate.pattern);
    await pinSite(candidate);

    expect(await readPins()).toHaveLength(1);
    expect(await speedForSite(GUITAR)).toBe(DEFAULT_SPEED_PX_PER_S);
  });
});
