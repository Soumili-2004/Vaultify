import api from './api';

export const getVaultKeys = () =>
  api.get('/api/vault/keys').then(r => r.data);

export const storeVaultKey = (data) =>
  api.post('/api/vault/keys', data).then(r => r.data);

export const rotateVaultKey = (id, newRawKey) =>
  api.put(`/api/vault/keys/${id}/rotate`, { newRawKey }).then(r => r.data);

export const deleteVaultKey = (id) =>
  api.delete(`/api/vault/keys/${id}`).then(r => r.data);

export const getKeyTokenCount = (id) =>
  api.get(`/api/vault/keys/${id}/tokens-count`).then(r => r.data);

export const getActiveTokens = () =>
  api.get('/api/tokens').then(r => r.data);

export const getRecentActivity = (limit = 5) =>
  api.get(`/api/audit?limit=${limit}`).then(r => r.data);
