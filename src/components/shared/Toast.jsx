import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';

export default function Toast() {
  const { state, dispatch } = useApp();
  const timerRef = useRef(null);

  useEffect(() => {
    if (state.toastMsg) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2200);
    }
    return () => clearTimeout(timerRef.current);
  }, [state.toastMsg, dispatch]);

  return (
    <div
      id="pm-toast"
      className={state.toastMsg ? 'visible' : ''}
    >
      {state.toastMsg || ''}
    </div>
  );
}
