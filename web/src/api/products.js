import { api } from './client';

export const productsApi = {
  list: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/products${qs ? '?' + qs : ''}`, token);
  },
  get: (id, token) => api.get(`/products/${id}`, token),
  create: (data, token) => api.post('/products', data, token),
  update: (id, data, token) => api.patch(`/products/${id}`, data, token),
};
