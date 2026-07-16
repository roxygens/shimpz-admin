export const STORE_ORIGIN = 'https://shimpz.com';
export const INSTALL_INTENT = Object.freeze({
  type: 'shimpz:assistant-install',
  version: 1,
  assistant: 'hello-pulse',
});
export const INSTALL_ACK_TYPE = 'shimpz:assistant-install-ack';

const INTENT_KEYS = Object.freeze(['assistant', 'type', 'version']);

/**
 * Accept one inert Store intent. The Store can nominate the released Assistant, but it never gets
 * a local token, Capsule id, or authority to install; the Captain must select and confirm locally.
 */
export function acceptsStoreInstallIntent(event, iframeWindow) {
  if (!event || event.origin !== STORE_ORIGIN || event.source !== iframeWindow || !iframeWindow) return false;
  const data = event.data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false;
  const keys = Reflect.ownKeys(data);
  if (keys.some((key) => typeof key !== 'string')) return false;
  keys.sort();
  if (keys.length !== INTENT_KEYS.length || keys.some((key, index) => key !== INTENT_KEYS[index])) return false;
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
