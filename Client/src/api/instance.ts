import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';
import { isLocalhost } from '@/lib/env';

/**
 * Public, read-only API client. There is no authentication in Red Alerts, so
 * there are no auth interceptors here.
 *
 * The base URL is derived purely from the current origin (no env vars / secrets
 * in the frontend):
 *  - localhost (dev)  -> http://localhost:8000/api  (the local backend)
 *  - anything else    -> <origin>/api               (CloudFront -> API Gateway)
 */
function resolveApiBaseUrl(): string {
  const root = isLocalhost() ? 'http://localhost:8000' : window.location.origin;
  return `${root}/api`;
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

export function toErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const axiosError = error as AxiosError<{ message?: string; detail?: string }>;
  const data = axiosError.response?.data;
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string') return data.message;
    if (typeof data.detail === 'string') return data.detail;
  }
  if (axiosError.message) return axiosError.message;
  return fallback;
}

export const api = {
  get: <T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig,
  ) => axiosInstance.get<T>(url, { params, ...config }),
  put: <T = unknown>(url: string, data?: unknown) => axiosInstance.put<T>(url, data),
};

export default axiosInstance;
