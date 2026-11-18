import { useEffect, useState } from 'react';

type LookupState<T> = {
  orderNumber: string;
  record: T | null;
  loading: boolean;
  error: string | null;
};

/** Debounced SOP lookup shared by machine entry screens. */
export function useExistingMachineRecord<T>(
  orderNumber: string,
  findRecord: (normalizedOrderNumber: string) => Promise<T | null>,
  debounceMs = 300,
  enabled = true,
) {
  const normalized = orderNumber.trim().toUpperCase();
  const [state, setState] = useState<LookupState<T>>({
    orderNumber: '',
    record: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!normalized || !enabled) {
      setState({
        orderNumber: normalized,
        record: null,
        loading: Boolean(normalized),
        error: null,
      });
      return;
    }
    let active = true;
    setState((current) => ({
      orderNumber: normalized,
      record: current.orderNumber === normalized ? current.record : null,
      loading: true,
      error: null,
    }));
    const timer = window.setTimeout(async () => {
      try {
        const record = await findRecord(normalized);
        if (active) setState({ orderNumber: normalized, record, loading: false, error: null });
      } catch (reason) {
        if (active)
          setState({
            orderNumber: normalized,
            record: null,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : 'Unable to load the existing machine record.',
          });
      }
    }, debounceMs);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalized, findRecord, debounceMs, enabled]);

  const current = state.orderNumber === normalized;
  return {
    record: current ? state.record : null,
    loading: Boolean(normalized) && (!enabled || !current || state.loading),
    error: current ? state.error : null,
  };
}
