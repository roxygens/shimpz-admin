const CAPSULE_ID_RE = /^[a-z0-9_]{1,40}$/;
const HELLO_ID = 'hello-pulse';

export class LocalApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'LocalApiError';
    this.status = status;
  }
}

export function safeApiError(body, fallback) {
  const candidate = body?.error ?? body?.detail;
  return typeof candidate === 'string' && candidate.length <= 300 ? candidate : fallback;
}

async function jsonObject(response) {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

/** Always let the idempotent install endpoint reconcile runtime state before invoking hello. */
export async function evaluateHelloPulse(fetcher, capsuleId, name = 'Captain') {
  if (typeof fetcher !== 'function' || !CAPSULE_ID_RE.test(capsuleId)) {
    throw new LocalApiError('Invalid local Assistant request.');
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\r\n]/.test(name)) {
    throw new LocalApiError('Invalid hello input.');
  }

  const base = `/api/capsules/${encodeURIComponent(capsuleId)}/assistants`;
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const installResponse = await fetcher(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({ assistant: HELLO_ID }),
  });
  const installBody = await jsonObject(installResponse);
  // 409 remains safe for a concurrent installer; both paths still prove readiness through hello.
  if (!installResponse.ok && installResponse.status !== 409) {
    throw new LocalApiError(
      safeApiError(installBody, 'The local evaluation could not be completed.'),
      installResponse.status,
    );
  }

  const helloResponse = await fetcher(`${base}/${HELLO_ID}/operations/hello`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: name.trim() }),
  });
  const helloBody = await jsonObject(helloResponse);
  if (!helloResponse.ok) {
    throw new LocalApiError(
      safeApiError(helloBody, 'The local evaluation could not be completed.'),
      helloResponse.status,
    );
  }
  const message = helloBody.message ?? helloBody.result?.message;
  if (typeof message !== 'string' || !message || message.length > 256) {
    throw new LocalApiError('The local evaluation could not be completed.', helloResponse.status);
  }
  return { message };
}
