import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SPEED_PX_PER_S, MAX_SPEED_PX_PER_S } from '@/scroll/speed';
import { readSettings, saveSpeed, watchSettings } from './settings';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('reading settings', () => {
  it('starts at the default speed before anything has been chosen', async () => {
    expect((await readSettings()).speed).toBe(DEFAULT_SPEED_PX_PER_S);
  });

  it('reads back a speed that was saved', async () => {
    await saveSpeed(120);
    expect((await readSettings()).speed).toBe(120);
  });

  it('holds a saved speed inside the range the slider can express', async () => {
    await saveSpeed(99_999);
    expect((await readSettings()).speed).toBe(MAX_SPEED_PX_PER_S);
  });

  it('falls back to the default when storage holds something that is not a speed', async () => {
    await fakeBrowser.storage.local.set({ settings: { speed: 'quite fast' } });
    expect((await readSettings()).speed).toBe(DEFAULT_SPEED_PX_PER_S);
  });
});

describe('watching settings', () => {
  it('reports a speed saved somewhere else', async () => {
    const seen: number[] = [];
    watchSettings((settings) => seen.push(settings.speed));

    await saveSpeed(60);

    expect(seen).toContain(60);
  });

  it('stops reporting once unsubscribed', async () => {
    const seen: number[] = [];
    const stop = watchSettings((settings) => seen.push(settings.speed));
    stop();

    await saveSpeed(60);

    expect(seen).toEqual([]);
  });
});
