import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Ejecuta `fetcher` al montar (y cuando cambian `deps`) y expone el estado de la carga.
 * Ignora respuestas de peticiones obsoletas.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, deps);

  return { data, loading, error, reload: load, setData };
}

/** Mensaje legible para un error capturado en una acción. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Ocurrió un error inesperado.';
}
