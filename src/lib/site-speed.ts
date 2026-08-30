import { pinFor, setPinSpeed } from '@/pins/pins';
import { readSettings, saveSpeed } from './settings';
import { clampSpeed } from '@/scroll/speed';

/**
 * Which speed applies on a page, and where a new one is written.
 *
 * A pinned site keeps its own: a guitar tab wants eight pixels a second and a
 * feed wants two hundred, and having to re-find each of them on every visit is
 * most of the reason a speed setting feels like work. Everywhere else uses the
 * default, which is also where a change made on an unpinned site goes — there
 * is nowhere else to put it, and the alternative would be to remember a speed
 * for every site ever scrolled, which is a growing record of where the reader
 * has been.
 *
 * The two paths that need this — the popup and the on-page panel — go through
 * one function rather than each deciding, so they cannot disagree about which
 * speed a page is at.
 */
export async function speedForSite(url: string): Promise<number> {
  const pin = await pinFor(url);
  if (pin?.speed !== undefined) return clampSpeed(pin.speed);
  return (await readSettings()).speed;
}

export async function saveSpeedForSite(url: string, speed: number): Promise<void> {
  const pin = await pinFor(url);
  if (pin === null) {
    await saveSpeed(speed);
    return;
  }
  await setPinSpeed(pin.pattern, clampSpeed(speed));
}
