
import axios from 'axios';

// On server: use the real backend URL directly
// On client: use the Next.js proxy route
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.API_URL;
  }
  return '/api/proxy';
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: typeof window !== 'undefined',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Token refresh lock ───────────────────────────────────────────────────────
// Ensures only one refresh request is in-flight at a time.
// All 401s that arrive while a refresh is pending share the same promise
// instead of each firing their own refresh call.
let refreshPromise: Promise<void> | null = null;

function refreshToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = apiClient
    .post('/auths/refresh')
    .then(() => {
      refreshPromise = null;
    })
    .catch((err) => {
      refreshPromise = null;
      throw err;
    });

  return refreshPromise;
}

// ─── Response interceptor ─────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // No config means a network-level error — nothing to retry.
      if (!originalRequest) return Promise.reject(error);

      const status: number = error.response?.status ?? 0;
      const url: string = originalRequest.url ?? '';

      // Never retry the refresh endpoint itself, and never retry wallet auth
      // endpoints (a 401 there means "no account / bad signature", not an
      // expired token).
      const isRefreshCall = url.includes('/auths/refresh');
      const isWalletAuth  =
        url.includes('/auths/wallet/') || url.includes('/auth/bnb/');

      // If the refresh endpoint itself fails (any status), redirect to login
      // immediately — do NOT retry. This is the key fix for the 503 loop.
      if (isRefreshCall) {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Only attempt a token refresh on 401, once per original request.
      if (status === 401 && !originalRequest._retry && !isWalletAuth) {
        originalRequest._retry = true;
        try {
          await refreshToken(); // shared promise — deduplicates concurrent 401s
          return apiClient(originalRequest);
        } catch {
          // Refresh failed — redirect to login (refreshToken() already cleared
          // the lock so the next login attempt starts fresh).
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );
}

export default apiClient;
