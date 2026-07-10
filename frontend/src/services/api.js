import axios from 'axios';

const TOKEN_KEY = 'et_token';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, remember = true) {
  clearToken();
  if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    const isAuthCall = config?.url?.startsWith('/auth/');
    if (response?.status === 401 && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        // Share one refresh across concurrent 401s
        refreshing ??= api.post('/auth/refresh').finally(() => (refreshing = null));
        const { data } = await refreshing;
        setToken(data.accessToken, !!localStorage.getItem(TOKEN_KEY) || !getToken());
        return api(config);
      } catch {
        clearToken();
        if (!location.pathname.startsWith('/login')) location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error?.message ?? fallback;
}

// Triggers a browser download from a blob response
export async function downloadFile(url, params, filename) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const objectUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
