import { LocalApiError, safeApiError } from './localApi.js';

const CAPSULE_ID_RE = /^[a-z0-9_]{1,40}$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const PROVIDER_IDS = new Set(['anthropic', 'openai']);
const MAX_PROVIDERS = PROVIDER_IDS.size;

async function jsonObject(response) {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function validProvider(entry) {
  const keys = Object.keys(entry ?? {}).sort();
  return (
    entry &&
    typeof entry === 'object' &&
    keys.every((key) => ['configured', 'default_model', 'id', 'masked', 'title'].includes(key)) &&
    PROVIDER_IDS.has(entry.id) &&
    typeof entry.title === 'string' &&
    entry.title.length <= 40 &&
    MODEL_RE.test(entry.default_model) &&
    typeof entry.configured === 'boolean' &&
    (entry.masked === null || (typeof entry.masked === 'string' && /^••••[!-~]{4}$/.test(entry.masked)))
  );
}

/** Read masked provider state. A response containing any secret-shaped extra field fails closed. */
export async function listModelProviders(fetcher) {
  if (typeof fetcher !== 'function') throw new LocalApiError('Invalid model provider request.');
  const response = await fetcher('/api/model-providers', {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body = await jsonObject(response);
  if (!response.ok) {
    throw new LocalApiError(safeApiError(body, 'Model provider settings are unavailable.'), response.status);
  }
  if (!Array.isArray(body.providers) || body.providers.length !== MAX_PROVIDERS) {
    throw new LocalApiError('Model provider settings are invalid.', response.status);
  }
  const ids = new Set();
  for (const provider of body.providers) {
    if (!validProvider(provider) || ids.has(provider.id)) {
      throw new LocalApiError('Model provider settings are invalid.', response.status);
    }
    ids.add(provider.id);
  }
  return body.providers;
}

/** Read only provider/model metadata from one Capsule. HTTP 409 means it has no selection yet. */
export async function loadInference(fetcher, capsuleId) {
  if (typeof fetcher !== 'function' || !CAPSULE_ID_RE.test(capsuleId)) {
    throw new LocalApiError('Invalid Capsule inference request.');
  }
  const response = await fetcher(`/api/capsules/${encodeURIComponent(capsuleId)}/inference`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const body = await jsonObject(response);
  if (response.status === 409) return null;
  if (!response.ok) {
    throw new LocalApiError(safeApiError(body, 'Capsule inference settings are unavailable.'), response.status);
  }
  if (!PROVIDER_IDS.has(body.provider) || !MODEL_RE.test(body.model)) {
    throw new LocalApiError('Capsule inference settings are invalid.', response.status);
  }
  return { provider: body.provider, model: body.model };
}

/** Save a key to the backend first, then send only provider/model to the Capsule controller. */
export async function saveModelSetup(fetcher, capsuleId, setup, providers) {
  if (
    typeof fetcher !== 'function' ||
    !CAPSULE_ID_RE.test(capsuleId) ||
    !PROVIDER_IDS.has(setup?.provider) ||
    !MODEL_RE.test(setup?.model) ||
    !Array.isArray(providers)
  ) {
    throw new LocalApiError('Invalid model provider settings.');
  }
  const current = providers.find((entry) => entry.id === setup.provider);
  if (!current) throw new LocalApiError('Invalid model provider settings.');
  const apiKey = typeof setup.apiKey === 'string' ? setup.apiKey.trim() : '';
  let providerState = current;

  if (apiKey) {
    const credentialResponse = await fetcher(`/api/model-providers/${encodeURIComponent(setup.provider)}`, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const credentialBody = await jsonObject(credentialResponse);
    if (!credentialResponse.ok) {
      throw new LocalApiError(safeApiError(credentialBody, 'The API key could not be saved.'), credentialResponse.status);
    }
    if (!validProvider(credentialBody) || credentialBody.id !== setup.provider || !credentialBody.configured) {
      throw new LocalApiError('The model provider response is invalid.', credentialResponse.status);
    }
    providerState = credentialBody;
  } else if (!current.configured) {
    throw new LocalApiError('Add an API key for the selected provider.');
  }

  const inferenceResponse = await fetcher(`/api/capsules/${encodeURIComponent(capsuleId)}/inference`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: setup.provider, model: setup.model }),
  });
  const inferenceBody = await jsonObject(inferenceResponse);
  if (!inferenceResponse.ok) {
    throw new LocalApiError(
      safeApiError(inferenceBody, 'The Capsule model selection could not be saved.'),
      inferenceResponse.status,
    );
  }
  if (inferenceBody.provider !== setup.provider || inferenceBody.model !== setup.model) {
    throw new LocalApiError('The Capsule inference response is invalid.', inferenceResponse.status);
  }
  return { providerState, inference: { provider: setup.provider, model: setup.model } };
}

export async function removeModelKey(fetcher, provider) {
  if (typeof fetcher !== 'function' || !PROVIDER_IDS.has(provider)) {
    throw new LocalApiError('Invalid model provider request.');
  }
  const response = await fetcher(`/api/model-providers/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  const body = await jsonObject(response);
  if (!response.ok) throw new LocalApiError(safeApiError(body, 'The API key could not be removed.'), response.status);
  if (!validProvider(body) || body.id !== provider || body.configured) {
    throw new LocalApiError('The model provider response is invalid.', response.status);
  }
  return body;
}
