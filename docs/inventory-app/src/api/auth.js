import { api } from './client';

export const authApi = {
  signup: (email, password, brandName) =>
    api.post('/auth/signup', { email, password, brandName }),

  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  logout: (token) =>
    api.post('/auth/logout', {}, token),

  me: (token) =>
    api.get('/auth/me', token),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }),
};
