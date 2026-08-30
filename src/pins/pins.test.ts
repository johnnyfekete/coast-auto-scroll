import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { installFakeChrome, type FakeChrome } from './testing';
import { pinCandidates } from './patterns';
import { pinFor, pinSite, readPins, unpinSite } from './pins';

const GUITAR = 'https://tabs.ultimate-guitar.com/tab/a/b-1';
const [THIS_SITE, WHOLE_DOMAIN] = pinCandidates(GUITAR);

let chrome: FakeChrome;

beforeEach(() => {
  fakeBrowser.reset();
  chrome = installFakeChrome();
});

afterEach(() => {
  chrome.restore();
});

describe('pinning a site', () => {
  it('asks for the one origin the reader chose, and nothing else', async () => {
    await pinSite(THIS_SITE!);
    expect([...chrome.granted]).toEqual(['*://tabs.ultimate-guitar.com/*']);
  });

  it('registers a content script for exactly that pattern', async () => {
    await pinSite(THIS_SITE!);
    const scripts = [...chrome.registered.values()];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.matches).toEqual(['*://tabs.ultimate-guitar.com/*']);
  });

  it('remembers the pin, so it is there after a restart', async () => {
    await pinSite(THIS_SITE!);
    expect(await readPins()).toEqual([
      { pattern: '*://tabs.ultimate-guitar.com/*', host: 'tabs.ultimate-guitar.com', subdomains: false },
    ]);
  });

  it('says so when it worked', async () => {
    expect(await pinSite(THIS_SITE!)).toBe('pinned');
  });

  it('leaves nothing behind when the reader declines the dialog', async () => {
    chrome.answerWith(false);

    expect(await pinSite(THIS_SITE!)).toBe('declined');
    expect(await readPins()).toEqual([]);
    expect(chrome.registered.size).toBe(0);
    expect(chrome.granted.size).toBe(0);
  });

  it('pins a whole domain when that is what was chosen', async () => {
    await pinSite(WHOLE_DOMAIN!);
    expect([...chrome.granted]).toEqual(['*://*.ultimate-guitar.com/*']);
  });

  it('pinning the same site twice leaves one pin', async () => {
    await pinSite(THIS_SITE!);
    await pinSite(THIS_SITE!);
    expect(await readPins()).toHaveLength(1);
    expect(chrome.registered.size).toBe(1);
  });
});

describe('unpinning a site', () => {
  it('gives the permission back, so the browser stops saying we can reach it', async () => {
    await pinSite(THIS_SITE!);
    await unpinSite(THIS_SITE!.pattern);
    expect(chrome.granted.size).toBe(0);
  });

  it('unregisters the content script', async () => {
    await pinSite(THIS_SITE!);
    await unpinSite(THIS_SITE!.pattern);
    expect(chrome.registered.size).toBe(0);
  });

  it('forgets the pin', async () => {
    await pinSite(THIS_SITE!);
    await unpinSite(THIS_SITE!.pattern);
    expect(await readPins()).toEqual([]);
  });

  it('is harmless on a site that was never pinned', async () => {
    await expect(unpinSite('*://example.com/*')).resolves.toBeUndefined();
  });

  it('leaves other pins alone', async () => {
    await pinSite(THIS_SITE!);
    await pinSite(pinCandidates('https://medium.com/x')[0]!);
    await unpinSite(THIS_SITE!.pattern);
    expect((await readPins()).map((p) => p.host)).toEqual(['medium.com']);
  });
});

describe('which pin covers a page', () => {
  it('is the one whose pattern matches', async () => {
    await pinSite(THIS_SITE!);
    expect((await pinFor(GUITAR))?.host).toBe('tabs.ultimate-guitar.com');
  });

  it('is nothing on a site that was never pinned', async () => {
    await pinSite(THIS_SITE!);
    expect(await pinFor('https://example.com/')).toBeNull();
  });

  it('covers a subdomain when the whole domain was pinned', async () => {
    await pinSite(WHOLE_DOMAIN!);
    expect((await pinFor('https://www.ultimate-guitar.com/x'))?.subdomains).toBe(true);
  });
});
