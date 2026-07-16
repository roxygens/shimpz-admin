export const STORE_ORIGIN = 'https://shimpz.com';
export const INSTALL_INTENT = Object.freeze({
  type: 'shimpz:assistant-install',
  version: 1,
  assistant: 'hello-pulse',
});
export const INSTALL_ACK_TYPE = 'shimpz:assistant-install-ack';
export const STORE_FRAME_TYPE = 'shimpz:assistant-store-frame';
export const STORE_CONTEXT_TYPE = 'shimpz:assistant-store-context';
export const STORE_FRAME_MIN_HEIGHT = 320;
export const STORE_FRAME_MAX_HEIGHT = 5000;

const INTENT_KEYS = Object.freeze(['assistant', 'type', 'version']);
const FRAME_KEYS = Object.freeze(['height', 'type', 'version']);

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) return false;
  keys.sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isTrustedStoreEvent(event, iframeWindow) {
  return Boolean(event && event.origin === STORE_ORIGIN && event.source === iframeWindow && iframeWindow);
}

/**
 * Accept one inert Store intent. The Store can nominate the released Assistant, but it never gets
 * a local token, Capsule id, or authority to install; the Captain must select and confirm locally.
 */
export function acceptsStoreInstallIntent(event, iframeWindow) {
  if (!isTrustedStoreEvent(event, iframeWindow)) return false;
  const data = event.data;
  if (!hasExactKeys(data, INTENT_KEYS)) return false;
  return (
    data.type === INSTALL_INTENT.type &&
    data.version === INSTALL_INTENT.version &&
    data.assistant === INSTALL_INTENT.assistant
  );
}

/**
 * Acknowledge only the exact inert Store intent. The response deliberately contains no Capsule,
 * inventory, token, runtime, or installation state; local admission remains entirely in the Admin.
 */
export function acknowledgeStoreInstallIntent(event, iframeWindow) {
  if (!acceptsStoreInstallIntent(event, iframeWindow)) return false;
  event.source.postMessage(
    {
      type: INSTALL_ACK_TYPE,
      version: INSTALL_INTENT.version,
      assistant: INSTALL_INTENT.assistant,
      accepted: true,
    },
    event.origin,
  );
  return true;
}

/**
 * Return the Store document height only for the exact, bounded frame protocol. The Store never
 * learns local state through this message; it only proves that its embedded UI is ready to show.
 */
export function storeFrameHeight(event, iframeWindow) {
  if (!isTrustedStoreEvent(event, iframeWindow)) return null;
  const data = event.data;
  if (!hasExactKeys(data, FRAME_KEYS)) return null;
  if (
    data.type !== STORE_FRAME_TYPE ||
    data.version !== INSTALL_INTENT.version ||
    !Number.isInteger(data.height) ||
    data.height < STORE_FRAME_MIN_HEIGHT ||
    data.height > STORE_FRAME_MAX_HEIGHT
  ) return null;
  return data.height;
}

/** Acknowledge a valid frame measurement with a deliberately data-free parent context. */
export function acknowledgeStoreFrame(event, iframeWindow) {
  const height = storeFrameHeight(event, iframeWindow);
  if (height === null) return null;
  event.source.postMessage(
    { type: STORE_CONTEXT_TYPE, version: INSTALL_INTENT.version },
    STORE_ORIGIN,
  );
  return height;
}
