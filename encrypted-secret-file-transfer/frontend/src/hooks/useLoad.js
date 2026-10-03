import { useCallback, useEffect, useState } from 'react';

// Runs an async loader; exposes { data, error, loading, reload }.
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await loader(), error: null, loading: false }); }
    catch (e) { setState({ data: null, error: e.message, loading: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
