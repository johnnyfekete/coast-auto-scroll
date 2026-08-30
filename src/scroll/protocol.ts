/**
 * What the popup, the on-page panel and the page's controller say to each
 * other. One module so both ends of every message are described in one place.
 */

export const STATUS = 'coast:status';
export const START = 'coast:start';
export const STOP = 'coast:stop';
export const SET_SPEED = 'coast:set-speed';

export type StatusRequest = { type: typeof STATUS };
export type StartRequest = { type: typeof START; speed: number };
export type StopRequest = { type: typeof STOP };
export type SetSpeedRequest = { type: typeof SET_SPEED; speed: number };

export type ScrollRequest = StatusRequest | StartRequest | StopRequest | SetSpeedRequest;

/**
 * What a page's controller answers with, to every request. One shape for all
 * four, because the caller always wants the same thing back — what is true
 * *now* — and a start that found nothing to scroll has to say so in the same
 * breath a status read would.
 */
export type ScrollStatus = {
  running: boolean;
  speed: number;
  /** False when the page has nothing scrollable in it, so `running` cannot become true. */
  scrollable: boolean;
};

/** Whether `message` is one of ours. */
export function isScrollRequest(message: unknown): message is ScrollRequest {
  const type = (message as { type?: unknown } | null)?.type;
  return type === STATUS || type === START || type === STOP || type === SET_SPEED;
}
