import { useState, useEffect, useRef } from 'react';
import { isPinSet, setPin, verifyPin, generateResetToken, verifyResetToken, clearPin, openResetEmail, ADMIN_EMAIL } from '../../lib/pin.js';

const PIN_LEN = 4;

function PinDots({ value, length = PIN_LEN, error }) {
  return (
    <div className="pin-dots">
      {Array.from({ length }).map((_, i) => (
        <div key={i} className={`pin-dot${i < value.length ? ' filled' : ''}${error ? ' error' : ''}`} />
      ))}
    </div>
  );
}

export default function PinModal({ onUnlock, onCancel }) {
  const pinSet = isPinSet();
  const [mode, setMode] = useState(pinSet ? 'enter' : 'setup'); // enter | setup | confirm | reset-send | reset-verify
  const [pin, setPin_] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetInput, setResetInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  function handleKey(e, current, setCurrent, maxLen, onComplete) {
    if (e.key >= '0' && e.key <= '9' && current.length < maxLen) {
      const next = current + e.key;
      setCurrent(next);
      setError('');
      if (next.length === maxLen) onComplete(next);
    } else if (e.key === 'Backspace') {
      setCurrent(current.slice(0, -1));
      setError('');
    }
  }

  async function onEnterComplete(val) {
    const ok = await verifyPin(val);
    if (ok) { onUnlock(); }
    else { setError('Incorrect PIN'); setTimeout(() => { setPin_(''); setError(''); }, 600); }
  }

  function onSetupComplete(val) {
    setPin_(val);
    setMode('confirm');
  }

  async function onConfirmComplete(val) {
    if (val !== pin) { setError('PINs do not match'); setTimeout(() => { setConfirm(''); setError(''); }, 600); return; }
    await setPin(val);
    onUnlock();
  }

  function handleSendReset() {
    const token = generateResetToken();
    setResetToken(token);
    openResetEmail(token);
    setMode('reset-verify');
  }

  async function handleVerifyReset() {
    if (!verifyResetToken(resetInput)) { setError('Invalid or expired token'); return; }
    clearPin();
    setMode('reset-newpin');
    setNewPin('');
    setNewPinConfirm('');
    setError('');
  }

  async function onNewPinComplete(val) {
    setNewPin(val);
    setMode('reset-confirmpin');
  }

  async function onNewPinConfirmComplete(val) {
    if (val !== newPin) { setError('PINs do not match'); setTimeout(() => { setNewPinConfirm(''); setError(''); }, 600); return; }
    await setPin(val);
    onUnlock();
  }

  return (
    <div className="pin-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="pin-modal">
        <div className="pin-modal-header">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="pin-lock-icon">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
          </svg>
          <span className="pin-modal-title">
            {mode === 'enter' && 'Admin PIN'}
            {mode === 'setup' && 'Set Admin PIN'}
            {mode === 'confirm' && 'Confirm PIN'}
            {mode === 'reset-send' && 'Reset PIN'}
            {mode === 'reset-verify' && 'Enter Reset Token'}
            {mode === 'reset-newpin' && 'New PIN'}
            {mode === 'reset-confirmpin' && 'Confirm New PIN'}
          </span>
          <button className="pin-modal-close" onClick={onCancel}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="pin-modal-body">
          {(mode === 'enter' || mode === 'setup' || mode === 'confirm') && (
            <>
              <p className="pin-modal-hint">
                {mode === 'enter' && 'Enter your 4-digit admin PIN to access settings.'}
                {mode === 'setup' && 'No PIN is set yet. Choose a 4-digit PIN to protect admin settings.'}
                {mode === 'confirm' && 'Enter the same PIN again to confirm.'}
              </p>
              <PinDots value={mode === 'confirm' ? confirm : pin} error={!!error} />
              {error && <p className="pin-error">{error}</p>}
              <input
                ref={inputRef}
                className="pin-hidden-input"
                type="tel"
                inputMode="numeric"
                maxLength={PIN_LEN}
                value={mode === 'confirm' ? confirm : pin}
                onKeyDown={e => {
                  if (mode === 'confirm') handleKey(e, confirm, setConfirm, PIN_LEN, onConfirmComplete);
                  else handleKey(e, pin, setPin_, PIN_LEN, mode === 'enter' ? onEnterComplete : onSetupComplete);
                }}
                readOnly
              />
              <div className="pin-numpad">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                  <button
                    key={i}
                    className={`pin-key${k === '' ? ' pin-key-empty' : ''}`}
                    disabled={k === ''}
                    onClick={() => {
                      if (k === '⌫') {
                        if (mode === 'confirm') { setConfirm(c => c.slice(0, -1)); setError(''); }
                        else { setPin_(p => p.slice(0, -1)); setError(''); }
                      } else {
                        const digit = String(k);
                        if (mode === 'confirm') {
                          if (confirm.length < PIN_LEN) {
                            const next = confirm + digit;
                            setConfirm(next);
                            setError('');
                            if (next.length === PIN_LEN) onConfirmComplete(next);
                          }
                        } else {
                          if (pin.length < PIN_LEN) {
                            const next = pin + digit;
                            setPin_(next);
                            setError('');
                            if (next.length === PIN_LEN) {
                              if (mode === 'enter') onEnterComplete(next);
                              else onSetupComplete(next);
                            }
                          }
                        }
                      }
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
              {mode === 'enter' && (
                <button className="pin-reset-link" onClick={() => setMode('reset-send')}>
                  Forgot PIN? Reset via email
                </button>
              )}
            </>
          )}

          {mode === 'reset-send' && (
            <>
              <p className="pin-modal-hint">
                A reset token will be generated and your email client will open a pre-filled message to <strong>{ADMIN_EMAIL}</strong>.
              </p>
              <p className="pin-modal-hint" style={{ marginTop: 6, opacity: 0.7 }}>
                Once Sylvain confirms the token, come back here to enter it and set a new PIN.
              </p>
              <div className="pin-reset-actions">
                <button className="pin-btn-secondary" onClick={() => setMode('enter')}>Back</button>
                <button className="pin-btn-primary" onClick={handleSendReset}>Open email & get token</button>
              </div>
              <button className="pin-reset-link" style={{ marginTop: 8 }} onClick={() => { setMode('reset-verify'); }}>
                I already have a token
              </button>
            </>
          )}

          {mode === 'reset-verify' && (
            <>
              <p className="pin-modal-hint">
                Enter the reset token that was confirmed by {ADMIN_EMAIL}.
              </p>
              {resetToken && (
                <p className="pin-modal-hint" style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 15, color: 'var(--pm-accent)', letterSpacing: 2 }}>
                  Your token: {resetToken}
                </p>
              )}
              <input
                ref={inputRef}
                className="pin-token-input"
                type="text"
                placeholder="Enter token (e.g. A1B2C3D4E5F6)"
                value={resetInput}
                onChange={e => { setResetInput(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleVerifyReset(); }}
                autoFocus
              />
              {error && <p className="pin-error">{error}</p>}
              <div className="pin-reset-actions">
                <button className="pin-btn-secondary" onClick={() => setMode('reset-send')}>Back</button>
                <button className="pin-btn-primary" onClick={handleVerifyReset}>Verify token</button>
              </div>
            </>
          )}

          {(mode === 'reset-newpin' || mode === 'reset-confirmpin') && (
            <>
              <p className="pin-modal-hint">
                {mode === 'reset-newpin' ? 'Choose your new 4-digit PIN.' : 'Confirm your new PIN.'}
              </p>
              <PinDots value={mode === 'reset-confirmpin' ? newPinConfirm : newPin} error={!!error} />
              {error && <p className="pin-error">{error}</p>}
              <div className="pin-numpad">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                  <button
                    key={i}
                    className={`pin-key${k === '' ? ' pin-key-empty' : ''}`}
                    disabled={k === ''}
                    onClick={() => {
                      if (k === '⌫') {
                        if (mode === 'reset-confirmpin') { setNewPinConfirm(p => p.slice(0, -1)); setError(''); }
                        else { setNewPin(p => p.slice(0, -1)); setError(''); }
                      } else {
                        const digit = String(k);
                        if (mode === 'reset-confirmpin') {
                          if (newPinConfirm.length < PIN_LEN) {
                            const next = newPinConfirm + digit;
                            setNewPinConfirm(next);
                            setError('');
                            if (next.length === PIN_LEN) onNewPinConfirmComplete(next);
                          }
                        } else {
                          if (newPin.length < PIN_LEN) {
                            const next = newPin + digit;
                            setNewPin(next);
                            setError('');
                            if (next.length === PIN_LEN) onNewPinComplete(next);
                          }
                        }
                      }
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
