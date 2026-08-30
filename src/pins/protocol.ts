/**
 * What the on-page panel asks the worker to do.
 *
 * A content script cannot call `permissions` or `scripting` at all, so unpin —
 * which is made of both — has to be asked for rather than done. The panel knows
 * which page it is on and nothing else; the worker looks up which pin covers
 * that page, which keeps the panel from having to be told what it was pinned as.
 */

export const UNPIN = 'coast:unpin';
export const OPEN_OPTIONS = 'coast:open-options';

export type UnpinRequest = { type: typeof UNPIN; url: string };
export type OpenOptionsRequest = { type: typeof OPEN_OPTIONS };

export type PinRequest = UnpinRequest | OpenOptionsRequest;

export function isPinRequest(message: unknown): message is PinRequest {
  const type = (message as { type?: unknown } | null)?.type;
  return type === UNPIN || type === OPEN_OPTIONS;
}
