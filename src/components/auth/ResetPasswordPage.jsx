import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <div className="login-header">
          <svg className="login-logo" viewBox="0 0 34 34" fill="none">
            <rect x="4" y="7" width="22" height="22" rx="5" fill="rgba(99,102,241,0.25)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.2"/>
            <rect x="7" y="4" width="22" height="22" rx="5" fill="rgba(99,102,241,0.35)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.2"/>
            <rect x="10" y="8" width="20" height="20" rx="4" fill="#4F46E5" stroke="#6366F1" strokeWidth="1"/>
            <path d="M21 10l-5 7h4l-2 7 6-9h-4l1-5z" fill="white" opacity="0.92"/>
          </svg>
          <div>
            <div className="login-title">PromptDeck</div>
            <div className="login-subtitle">Set new password</div>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
