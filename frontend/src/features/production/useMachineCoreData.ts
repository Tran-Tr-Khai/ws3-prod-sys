import { useEffect, useRef, useState } from 'react';

export type MachineCoreData<T> = {
  data: T | null;
  loading: boolean;
  failed: boolean;
};

/** Shared cancellable loader for both core and independent enrichment stages. */
export function useMachineCoreData<T>(
  key: string,
  enabled: boolean,
  load: (signal: AbortSignal) => Promise<T | null>,
): MachineCoreData<T> {
  const loadRef = useRef(load);
  loadRef.current = load;
  const requestKey = `${enabled ? 'enabled' : 'disabled'}:${key}`;
  const [state, setState] = useState<{ requestKey: string; data: T | null; loading: boolean; failed: boolean }>({
    requestKey: '', data: null, loading: true, failed: false,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ requestKey, data: null, loading: false, failed: false });
      return;
    }

    const controller = new AbortController();
    setState({ requestKey, data: null, loading: true, failed: false });
    void loadRef.current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ requestKey, data, loading: false, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ requestKey, data: null, loading: false, failed: true });
      });
    return () => controller.abort();
  }, [enabled, requestKey]);

  if (state.requestKey !== requestKey) {
    return { data: null, loading: enabled, failed: false };
  }
  return { data: enabled ? state.data : null, loading: state.loading, failed: state.failed };
}
