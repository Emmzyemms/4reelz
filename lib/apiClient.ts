
import axios from 'axios';

// On server: use the real backend URL directly
// On client: use the Next.js proxy route
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Server side: call backend directly
    return process.env.API_URL;
  }
  // Client side: always use the proxy route to avoid CORS errors
  return '/api/proxy';
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: typeof window !== 'undefined', // Only on client side
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for auto-refreshing tokens (only on client side)
if (typeof window !== 'undefined') {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // If error doesn't have config (e.g. network error), just reject
      if (!originalRequest) {
        return Promise.reject(error);
      }

      // If error is 401 and we haven't retried yet.
      // Skip refresh for wallet auth endpoints — a 401 there means
      // "no account found" or "bad signature", not an expired token.
      const isWalletAuth =
        originalRequest.url?.includes('/auths/wallet/') ||
        originalRequest.url?.includes('/auth/bnb/');
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        originalRequest.url !== '/auths/refresh' &&
        !isWalletAuth
      ) {
        originalRequest._retry = true;
        try {
          // Refresh also goes through our proxy
          await apiClient.post('/auths/refresh');
          return apiClient(originalRequest);
        } catch (refreshError) {
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
}

export default apiClient;
