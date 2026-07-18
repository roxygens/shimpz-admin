import { LocalApiError, safeApiError } from './localApi.js';

const CAPSULE_ID_RE = /^[a-z0-9_]{1,40}$/;
const EXPECTED_CATALOG = Object.freeze({
  openai: Object.freeze({
    title: 'OpenAI',
    default_model: 'gpt-5.6-terra',
    models: Object.freeze([
      Object.freeze({ id: 'gpt-5.6-sol', title: 'GPT-5.6 Sol', input_usd_per_million_cents: 500, output_usd_per_million_cents: 3000 }),
      Object.freeze({ id: 'gpt-5.6-terra', title: 'GPT-5.6 Terra', input_usd_per_million_cents: 250, output_usd_per_million_cents: 1500 }),
      Object.freeze({ id: 'gpt-5.6-luna', title: 'GPT-5.6 Luna', input_usd_per_million_cents: 100, output_usd_per_million_cents: 600 }),
      Object.freeze({ id: 'gpt-5.5', title: 'GPT-5.5', input_usd_per_million_cents: 500, output_usd_per_million_cents: 3000 }),
    ]),
  }),
  anthropic: Object.freeze({
    title: 'Anthropic',
    default_model: 'claude-sonnet-5',
    models: Object.freeze([
      Object.freeze({ id: 'claude-fable-5', title: 'Claude Fable 5', input_usd_per_million_cents: 1000, output_usd_per_million_cents: 5000 }),
      Object.freeze({ id: 'claude-opus-4-8', title: 'Claude Opus 4.8', input_usd_per_million_cents: 500, output_usd_per_million_cents: 2500 }),
      Object.freeze({ id: 'claude-sonnet-5', title: 'Claude Sonnet 5', input_usd_per_million_cents: 300, output_usd_per_million_cents: 1500 }),
      Object.freeze({ id: 'claude-haiku-4-5-20251001', title: 'Claude Haiku 4.5', input_usd_per_million_cents: 100, output_usd_per_million_cents: 500 }),
    ]),
  }),
});
const PROVIDER_IDS = new Set(Object.keys(EXPECTED_CATALOG));
const MAX_PROVIDERS = PROVIDER_IDS.size;
const MODEL_FIELDS = ['id', 'input_usd_per_million_cents', 'output_usd_per_million_cents', 'title'];
const PROVIDER_FIELDS = ['configured', 'default_model', 'id', 'masked', 'models', 'title'];

function exactKeys(value, expected) {
  return Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

async function jsonObject(response) {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function validProvider(entry) {
  const expected = EXPECTED_CATALOG[entry?.id];
  return (
    entry &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    exactKeys(entry, PROVIDER_FIELDS) &&
    expected &&
    entry.title === expected.title &&
    entry.default_model === expected.default_model &&
    Array.isArray(entry.models) &&
    entry.models.length === expected.models.length &&
    entry.models.every((model, index) => (
      model &&
      typeof model === 'object' &&
      !Array.isArray(model) &&
      exactKeys(model, MODEL_FIELDS) &&
      MODEL_FIELDS.every((field) => model[field] === expected.models[index][field])
    )) &&
    typeof entry.configured === 'boolean' &&
    (entry.masked === null || (typeof entry.masked === 'string' && /^••••[!-~]{4}$/.test(entry.masked)))
  );
}

function validSelection(provider, model) {
  return PROVIDER_IDS.has(provider) && EXPECTED_CATALOG[provider].models.some((entry) => entry.id === model);
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
  if (
    !exactKeys(body, ['capsule', 'model', 'provider']) ||
    body.capsule !== capsuleId ||
    !validSelection(body.provider, body.model)
  ) {
    throw new LocalApiError('Capsule inference settings are invalid.', response.status);
  }
  return { provider: body.provider, model: body.model };
}

/** Save a key to the backend first, then send only provider/model to the Capsule controller. */
export async function saveModelSetup(fetcher, capsuleId, setup, providers) {
  if (
    typeof fetcher !== 'function' ||
    !CAPSULE_ID_RE.test(capsuleId) ||
    !validSelection(setup?.provider, setup?.model) ||
    !Array.isArray(providers) ||
    providers.length !== MAX_PROVIDERS ||
    !providers.every(validProvider)
  ) {
    throw new LocalApiError('Invalid model provider settings.');
  }
  const current = providers.find((entry) => entry.id === setup.provider);
  if (!current || !current.models.some((entry) => entry.id === setup.model)) {
    throw new LocalApiError('Invalid model provider settings.');
  }
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
  if (
    !exactKeys(inferenceBody, ['capsule', 'model', 'provider']) ||
    inferenceBody.capsule !== capsuleId ||
    inferenceBody.provider !== setup.provider ||
    inferenceBody.model !== setup.model
  ) {
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
