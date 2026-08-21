import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';

export default function Toast() {
  const { state, dispatch } = useApp();
  const timerRef = useRef(null);

  useEffect(() => {
    if (state.toastMsg) {
      clearTimeout(timerRef.current);
      const delay = state.toastUndo ? 10000 : 2200;
      timerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), delay);
    }
    return () => clearTimeout(timerRef.current);
  }, [state.toastMsg, state.toastUndo, dispatch]);

  function handleUndo() {
    clearTimeout(timerRef.current);
    state.toastUndo?.();
    dispatch({ type: 'CLEAR_TOAST' });
  }

  return (
    <div id="pm-toast" className={state.toastMsg ? 'visible' : ''}>
      <span>{state.toastMsg || ''}</span>
      {state.toastUndo && (
        <button className="toast-undo-btn" onClick={handleUndo}>Undo</button>
      )}
    </div>
  );
}
