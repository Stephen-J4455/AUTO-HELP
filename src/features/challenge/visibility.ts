import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../supabase/supabase';

export const ChallengeVisibilityContext = createContext({ enabled: false, hideChallenge: () => {} });

export function useChallengeVisibility() {
  const [enabled, setEnabled] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const hideChallenge = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setEnabled(false);
  }, []);

  useEffect(() => {
    async function refresh() {
      if (requestRef.current) return;
      const request = new AbortController();
      requestRef.current = request;
      try {
        const { data, error } = await supabase.rpc('challenge_is_enabled').abortSignal(request.signal);
        if (!request.signal.aborted) setEnabled(!error && data === true);
      } catch {
        if (!request.signal.aborted) setEnabled(false);
      } finally {
        if (requestRef.current === request) requestRef.current = null;
      }
    }

    void refresh();
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 10_000);
    return () => {
      listener.remove();
      clearInterval(timer);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  return { enabled, hideChallenge };
}
