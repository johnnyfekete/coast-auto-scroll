import { browser } from 'wxt/browser';
import { vi } from 'vitest';

/**
 * A stand-in for the two Chrome APIs pinning is built out of.
 *
 * WXT's fake browser implements storage but throws for `permissions.request`
 * and `scripting.registerContentScripts`, which are exactly the two calls the
 * pin lifecycle is made of — so this keeps their state in memory instead, and
 * lets a test say in advance whether the reader grants the permission or
 * declines it.
 *
 * Imported only by tests. Nothing in the extension itself reaches for it, so it
 * is never bundled.
 */

export type FakeChrome = {
  /** Origins the reader has granted. */
  granted: Set<string>;
  /** Content scripts Chrome currently has registered, by id. */
  registered: Map<string, { matches: string[] }>;
  /** What the next permission dialog answers. Defaults to granting. */
  answerWith: (granted: boolean) => void;
  /** Fires the event Chrome sends when access is revoked from its own UI. */
  revokeExternally: (origin: string) => Promise<void>;
  restore: () => void;
};

export function installFakeChrome(): FakeChrome {
  const granted = new Set<string>();
  const registered = new Map<string, { matches: string[] }>();
  let grantNext = true;

  const originals = {
    request: browser.permissions.request,
    contains: browser.permissions.contains,
    remove: browser.permissions.remove,
    register: browser.scripting.registerContentScripts,
    unregister: browser.scripting.unregisterContentScripts,
    getRegistered: browser.scripting.getRegisteredContentScripts,
  };

  const removedListeners = new Set<(permissions: { origins?: string[] }) => void>();

  browser.permissions.request = vi.fn(async ({ origins }: { origins?: string[] }) => {
    if (!grantNext) return false;
    for (const origin of origins ?? []) granted.add(origin);
    return true;
  }) as unknown as typeof browser.permissions.request;

  browser.permissions.contains = vi.fn(async ({ origins }: { origins?: string[] }) =>
    (origins ?? []).every((origin) => granted.has(origin)),
  ) as unknown as typeof browser.permissions.contains;

  browser.permissions.remove = vi.fn(async ({ origins }: { origins?: string[] }) => {
    for (const origin of origins ?? []) granted.delete(origin);
    return true;
  }) as unknown as typeof browser.permissions.remove;

  browser.scripting.registerContentScripts = vi.fn(
    async (scripts: { id: string; matches?: string[] }[]) => {
      for (const script of scripts) {
        if (registered.has(script.id)) throw new Error(`Duplicate script ID ${script.id}`);
        registered.set(script.id, { matches: script.matches ?? [] });
      }
    },
  ) as unknown as typeof browser.scripting.registerContentScripts;

  browser.scripting.unregisterContentScripts = vi.fn(async (filter?: { ids?: string[] }) => {
    for (const id of filter?.ids ?? [...registered.keys()]) registered.delete(id);
  }) as unknown as typeof browser.scripting.unregisterContentScripts;

  browser.scripting.getRegisteredContentScripts = vi.fn(async () =>
    [...registered.entries()].map(([id, script]) => ({ id, ...script })),
  ) as unknown as typeof browser.scripting.getRegisteredContentScripts;

  const onRemoved = browser.permissions.onRemoved as unknown as {
    addListener: (fn: (permissions: { origins?: string[] }) => void) => void;
  };
  const originalAdd = onRemoved.addListener;
  onRemoved.addListener = (fn) => removedListeners.add(fn);

  return {
    granted,
    registered,
    answerWith(next) {
      grantNext = next;
    },
    async revokeExternally(origin) {
      granted.delete(origin);
      for (const listener of removedListeners) listener({ origins: [origin] });
      // Listeners are fired synchronously by Chrome but do their work in a
      // promise; letting the microtask queue drain is what a caller would
      // otherwise have to remember to do by hand.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    restore() {
      browser.permissions.request = originals.request;
      browser.permissions.contains = originals.contains;
      browser.permissions.remove = originals.remove;
      browser.scripting.registerContentScripts = originals.register;
      browser.scripting.unregisterContentScripts = originals.unregister;
      browser.scripting.getRegisteredContentScripts = originals.getRegistered;
      onRemoved.addListener = originalAdd;
      removedListeners.clear();
    },
  };
}
