import { LocalApiError, safeApiError } from './localApi.js';

const CAPSULE_ID_RE = /^[a-z0-9_]{1,40}$/;
const ASSISTANT_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FILE_ID_RE = /^[0-9a-f]{32}$/;
const POWER_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_MESSAGE_CHARS = 16_000;
const MAX_FILES = 8;

async function jsonObject(response) {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function requireCapsule(capsuleId) {
  if (!CAPSULE_ID_RE.test(capsuleId)) throw new LocalApiError('Invalid local chat request.');
}

export async function listCapsuleFiles(fetcher, capsuleId) {
  if (typeof fetcher !== 'function') throw new LocalApiError('Invalid local file request.');
  requireCapsule(capsuleId);
  const response = await fetcher(`/api/capsules/${encodeURIComponent(capsuleId)}/files`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body = await jsonObject(response);
  if (!response.ok) throw new LocalApiError(safeApiError(body, 'Capsule files are unavailable.'), response.status);
  if (!Array.isArray(body.files) || body.files.length > 256) {
    throw new LocalApiError('Capsule file inventory is invalid.', response.status);
  }
  return body.files.map((file) => {
    if (
      !file ||
      typeof file !== 'object' ||
      !FILE_ID_RE.test(file.id) ||
      typeof file.name !== 'string' ||
      !file.name ||
      file.name.length > 255 ||
      !Number.isSafeInteger(file.size) ||
      file.size < 1
    ) {
      throw new LocalApiError('Capsule file inventory is invalid.', response.status);
    }
    return { id: file.id, name: file.name, size: file.size };
  });
}

/** Send the exact browser contract. Provider/model/key are intentionally not accepted arguments. */
export async function sendChat(fetcher, capsuleId, turn) {
  if (typeof fetcher !== 'function') throw new LocalApiError('Invalid local chat request.');
  requireCapsule(capsuleId);
  if (!turn || typeof turn !== 'object' || Object.keys(turn).sort().join(',') !== 'assistant,files,message') {
    throw new LocalApiError('Chat accepts only assistant, message, and files.');
  }
  const message = typeof turn.message === 'string' ? turn.message.trim() : '';
  if (
    !ASSISTANT_ID_RE.test(turn.assistant) ||
    !message ||
    message.length > MAX_MESSAGE_CHARS ||
    !Array.isArray(turn.files) ||
    turn.files.length > MAX_FILES ||
    turn.files.some((fileId) => !FILE_ID_RE.test(fileId)) ||
    new Set(turn.files).size !== turn.files.length
  ) {
    throw new LocalApiError('Invalid local chat request.');
  }
  const payload = { assistant: turn.assistant, message, files: [...turn.files] };
  const response = await fetcher(`/api/capsules/${encodeURIComponent(capsuleId)}/chat`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await jsonObject(response);
  if (!response.ok) throw new LocalApiError(safeApiError(body, 'The Assistant could not answer.'), response.status);
  if (
    Object.keys(body).some((key) => !['assistant', 'power', 'reply'].includes(key)) ||
    body.assistant !== turn.assistant ||
    typeof body.reply !== 'string' ||
    !body.reply ||
    body.reply.length > 64 * 1024 ||
    (body.power !== null && !POWER_ID_RE.test(body.power))
  ) {
    throw new LocalApiError('The local chat response is invalid.', response.status);
  }
  return { assistant: body.assistant, reply: body.reply, power: body.power };
}

export async function stopChat(fetcher, capsuleId) {
  if (typeof fetcher !== 'function') throw new LocalApiError('Invalid local chat request.');
  requireCapsule(capsuleId);
  const response = await fetcher(`/api/capsules/${encodeURIComponent(capsuleId)}/chat/stop`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const body = await jsonObject(response);
  if (!response.ok) throw new LocalApiError(safeApiError(body, 'The active turn could not be stopped.'), response.status);
  if (body.capsule !== capsuleId || typeof body.stopped !== 'boolean') {
    throw new LocalApiError('The local chat stop response is invalid.', response.status);
  }
  return body.stopped;
}
