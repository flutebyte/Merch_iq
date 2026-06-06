import { api } from './client';

export const stockLotsApi = {
  list: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/stock-lots${qs ? '?' + qs : ''}`, token);
  },
  get: (id, token) => api.get(`/stock-lots/${id}`, token),
  create: (data, token) => api.post('/stock-lots', data, token),
  update: (id, data, token) => api.patch(`/stock-lots/${id}`, data, token),
};
