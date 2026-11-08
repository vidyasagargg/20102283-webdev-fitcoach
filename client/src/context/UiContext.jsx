/**
 * App-wide UI state: the selected date (kept in the URL as ?date=, so a
 * refresh or shared link opens the same day) and toast notifications.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isIso, todayIso } from '../utils/dates.js';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [params, setParams] = useSearchParams();
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const raw = params.get('date');
  const date = isIso(raw) ? raw : todayIso();

  const setDate = useCallback(
    (d) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (d === todayIso()) next.delete('date');
          else next.set('date', d);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const toast = useCallback((message, tone = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ date, setDate, isToday: date === todayIso(), toast }), [date, setDate, toast]);
  return (
    <UiContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);
