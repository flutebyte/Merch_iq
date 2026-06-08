import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export function useFetch(path) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const { token }             = useAuth();

  const run = useCallback(() => {
    if (!token || !path) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    api.get(path, token)
      .then((d) => setData(d))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [path, token]);

  useEffect(() => { run(); }, [run]);

  // Listen for manual mutation events and refetch when they occur
  useEffect(() => {
    const handler = () => { if (path) run(); };
    window.addEventListener('inv:mutation', handler);
    return () => window.removeEventListener('inv:mutation', handler);
  }, [path, run]);

  return { data, loading, error, refetch: run };
}

export function useApiRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const { token }             = useAuth();

  const request = useCallback(async (method, path, data) => {
    setLoading(true);
    setError(null);
    try {
      return await api[method](path, data, token);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    loading,
    error,
    get:   (path)       => request('get',    path),
    post:  (path, data) => request('post',   path, data),
    patch: (path, data) => request('patch',  path, data),
    del:   (path)       => request('delete', path),
  };
}
