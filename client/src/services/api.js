/**
 * @file api.js
 * @description Centralized HTTP client communicating with backend endpoints on /api/*.
 * Handles response normalization and descriptive error parsing.
 */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';
let BASE_URL = RAW_BASE.trim().replace(/\/+$/, '');
// If absolute URL provided without /api suffix, automatically append /api
if (BASE_URL.startsWith('http') && !BASE_URL.endsWith('/api')) {
  BASE_URL = `${BASE_URL}/api`;
}

/**
 * Helper to dispatch HTTP requests with proper error handling.
 */
async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.details = data?.details;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const isLocal = !RAW_BASE.startsWith('http');
      throw new Error(
        isLocal
          ? 'Unable to connect to the backend server. Is it running on port 5000?'
          : 'Unable to connect to the backend server. The service may be waking up (Render cold start) or unreachable.'
      );
    }
    throw err;
  }
}

export const api = {
  // System Health
  getHealth: () => request('/health'),

  // Dashboard Stats
  getStats: () => request('/stats'),

  // Knowledge Library Items
  getItems: (params = {}) => {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'all') query.append('type', params.type);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/items${queryString}`);
  },

  getItemById: (id) => request(`/items/${id}`),

  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),

  // Ingestion
  ingest: (payload) => request('/ingest', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  // Semantic Vector Search
  search: (q, topK = 5, minSimilarity = 0.0) => {
    const query = new URLSearchParams({ q, topK, minSimilarity });
    return request(`/search?${query.toString()}`);
  },

  // RAG Query
  query: (payload) => request('/query', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};
