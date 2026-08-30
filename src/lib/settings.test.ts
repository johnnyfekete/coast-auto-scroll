import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SPEED_PX_PER_S, MAX_SPEED_PX_PER_S } from '@/scroll/speed';
import { DEFAULT_POSITION } from '@/panel/position';
import { readSettings, savePanelPosition, saveSpeed, watchSettings } from './settings';

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

describe('where the panel sits', () => {
  it('starts in the corner', async () => {
    expect((await readSettings()).panelPosition).toEqual(DEFAULT_POSITION);
  });

  it('reads back a position that was saved', async () => {
    await savePanelPosition({ right: 300, bottom: 120 });
    expect((await readSettings()).panelPosition).toEqual({ right: 300, bottom: 120 });
  });

  it('does not lose the speed when the position is saved', async () => {
    await saveSpeed(88);
    await savePanelPosition({ right: 4, bottom: 4 });
    expect((await readSettings()).speed).toBe(88);
  });

  it('does not lose the position when the speed is saved', async () => {
    await savePanelPosition({ right: 4, bottom: 4 });
    await saveSpeed(88);
    expect((await readSettings()).panelPosition).toEqual({ right: 4, bottom: 4 });
  });

  it('falls back to the corner when storage holds nonsense', async () => {
    await fakeBrowser.storage.local.set({ settings: { panelPosition: 'over there' } });
    expect((await readSettings()).panelPosition).toEqual(DEFAULT_POSITION);
  });
});
