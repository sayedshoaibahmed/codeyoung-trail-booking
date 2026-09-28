import { fetchApi } from '../../../shared/api/base';

export const adminAuthApi = {
  login: (username: string, password: string) =>
    fetchApi<{ authenticated: true }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    fetchApi<{ authenticated: false }>('/admin/logout', { method: 'POST' }),
  getSession: () =>
    fetchApi<{ authenticated: true }>('/admin/session'),
};
