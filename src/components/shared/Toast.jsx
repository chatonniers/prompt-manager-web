import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';

export default function Toast() {
  const { state, dispatch } = useApp();
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const [remaining, setRemaining] = useState(0);

  const delay = state.toastUndo ? 10000 : 2200;

  useEffect(() => {
    if (state.toastMsg) {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);

      const endAt = Date.now() + delay;
      setRemaining(Math.ceil(delay / 1000));

      if (state.toastUndo) {
        intervalRef.current = setInterval(() => {
          const secs = Math.ceil((endAt - Date.now()) / 1000);
          if (secs <= 0) { clearInterval(intervalRef.current); setRemaining(0); }
          else setRemaining(secs);
        }, 200);
      }

      timerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), delay);
    }
    return () => { clearTimeout(timerRef.current); clearInterval(intervalRef.current); };
  }, [state.toastMsg, state.toastUndo]); // eslint-disable-line

  function handleUndo() {
    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);
    state.toastUndo?.();
    dispatch({ type: 'CLEAR_TOAST' });
  }

  const hasUndo = !!state.toastUndo;

  return (
    <div id="pm-toast" className={`${state.toastMsg ? 'visible' : ''}${hasUndo ? ' has-undo' : ''}`}>
      <span className="toast-msg">{state.toastMsg || ''}</span>
      {hasUndo && (
        <>
          <button className="toast-undo-btn" onClick={handleUndo}>Undo</button>
          <span className="toast-timer">{remaining}s</span>
        </>
      )}
    </div>
  );
}
