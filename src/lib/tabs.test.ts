import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { CONTROLLER_SCRIPT, canScrollPage, readTabStatus, setTabSpeed, startTab, stopTab } from './tabs';
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
