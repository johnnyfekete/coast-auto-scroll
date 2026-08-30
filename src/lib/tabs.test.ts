import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { browser } from 'wxt/browser';
import {
  CONTROLLER_SCRIPT,
  canScrollPage,
  readTabStatus,
  resolveTargetTab,
  setTabSpeed,
  startTab,
  stopTab,
} from './tabs';
import { START, STATUS, STOP } from '@/scroll/protocol';

const TAB = 7;
const RUNNING = { running: true, speed: 20, scrollable: true };

describe('canScrollPage', () => {
  it('takes an ordinary page', () => {
    expect(canScrollPage('https://example.com/article')).toBe(true);
  });

  it('refuses the pages no script can be injected into', () => {
    expect(canScrollPage('chrome://settings')).toBe(false);
    expect(canScrollPage('chrome-extension://abc/options.html')).toBe(false);
    expect(canScrollPage('https://chromewebstore.google.com/detail/x')).toBe(false);
    expect(canScrollPage('')).toBe(false);
  });
});

describe('talking to a tab', () => {
  let send: ReturnType<typeof vi.fn>;
  let execute: ReturnType<typeof vi.fn>;
  let originalSend: typeof browser.tabs.sendMessage;
  let originalExecute: typeof browser.scripting.executeScript;

  beforeEach(() => {
    send = vi.fn();
    execute = vi.fn().mockResolvedValue([]);
    originalSend = browser.tabs.sendMessage;
    originalExecute = browser.scripting.executeScript;
    browser.tabs.sendMessage = send as unknown as typeof browser.tabs.sendMessage;
    browser.scripting.executeScript = execute as unknown as typeof browser.scripting.executeScript;
  });

  afterEach(() => {
    browser.tabs.sendMessage = originalSend;
    browser.scripting.executeScript = originalExecute;
  });

  it('reads the status of a tab that already has a controller', async () => {
    send.mockResolvedValue(RUNNING);
    expect(await readTabStatus(TAB)).toEqual(RUNNING);
    expect(send).toHaveBeenCalledWith(TAB, { type: STATUS });
  });

  it('never installs a controller in order to read a status', async () => {
    // A popup opened on a page is not a request to install anything in it. A
    // status read that injected would leave a controller in every page the
    // popup was ever opened on.
    send.mockRejectedValue(new Error('Receiving end does not exist'));
    expect(await readTabStatus(TAB)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('starts a tab that already has a controller without injecting again', async () => {
    send.mockResolvedValue(RUNNING);
    expect(await startTab(TAB, 40)).toEqual(RUNNING);
    expect(send).toHaveBeenCalledWith(TAB, { type: START, speed: 40 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('installs the controller when nothing answers, then asks again', async () => {
    send.mockRejectedValueOnce(new Error('Receiving end does not exist')).mockResolvedValue(RUNNING);
    expect(await startTab(TAB, 40)).toEqual(RUNNING);
    expect(execute).toHaveBeenCalledWith({ target: { tabId: TAB }, files: [CONTROLLER_SCRIPT] });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('reports a page it could not be injected into rather than throwing', async () => {
    send.mockRejectedValue(new Error('Receiving end does not exist'));
    execute.mockRejectedValue(new Error('Cannot access contents of the page'));
    expect(await startTab(TAB, 40)).toBeNull();
  });

  it('never installs a controller in order to stop one', async () => {
    // A tab with no controller in it is already stopped. Installing one to tell
    // it to do nothing is the wrong shape of work.
    send.mockRejectedValue(new Error('Receiving end does not exist'));
    expect(await stopTab(TAB)).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('retunes a running tab without injecting', async () => {
    send.mockResolvedValue({ ...RUNNING, speed: 80 });
    expect(await setTabSpeed(TAB, 80)).toEqual({ ...RUNNING, speed: 80 });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('choosing the tab the reader means', () => {
  let query: ReturnType<typeof vi.fn>;
  let getCurrent: ReturnType<typeof vi.fn>;
  let originalQuery: typeof browser.tabs.query;
  let originalGetCurrent: typeof browser.tabs.getCurrent;

  const article = { id: 1, url: 'https://example.com/article', active: true, lastAccessed: 100 };
  const older = { id: 3, url: 'https://example.com/other', active: false, lastAccessed: 50 };
  /** An extension page opened in a tab. Chrome reports no url for it. */
  const ourPage = { id: 2, active: true, lastAccessed: 200 };

  beforeEach(() => {
    query = vi.fn().mockResolvedValue([]);
    getCurrent = vi.fn().mockResolvedValue(undefined);
    originalQuery = browser.tabs.query;
    originalGetCurrent = browser.tabs.getCurrent;
    browser.tabs.query = query as unknown as typeof browser.tabs.query;
    browser.tabs.getCurrent = getCurrent as unknown as typeof browser.tabs.getCurrent;
  });

  afterEach(() => {
    browser.tabs.query = originalQuery;
    browser.tabs.getCurrent = originalGetCurrent;
  });

  it('is the active tab, which is the page the popup is hanging over', async () => {
    query.mockResolvedValue([article]);
    expect((await resolveTargetTab())?.id).toBe(1);
  });

  it('is still the active tab when that page cannot be scrolled, so the reader is told', async () => {
    // Opening the popup over a browser page and quietly scrolling a different
    // tab would be worse than saying this one cannot be scrolled.
    const settings = { id: 9, url: 'chrome://settings', active: true, lastAccessed: 300 };
    query.mockResolvedValue([settings]);
    expect((await resolveTargetTab())?.url).toBe('chrome://settings');
  });

  it('is never the popup itself when the popup was opened as a tab', async () => {
    // A real popup is not a tab, so `getCurrent` answers nothing there. When it
    // answers, this page *is* a tab and scrolling it is never what was meant.
    getCurrent.mockResolvedValue(ourPage);
    query.mockResolvedValue([ourPage, article, older]);
    expect((await resolveTargetTab())?.id).toBe(1);
  });

  it('falls back to the page looked at most recently', async () => {
    getCurrent.mockResolvedValue(ourPage);
    query.mockResolvedValue([ourPage, older, article]);
    expect((await resolveTargetTab())?.id).toBe(1);
  });

  it('has no answer when there is no other tab at all', async () => {
    getCurrent.mockResolvedValue(ourPage);
    query.mockResolvedValue([ourPage]);
    expect(await resolveTargetTab()).toBeNull();
  });
});
