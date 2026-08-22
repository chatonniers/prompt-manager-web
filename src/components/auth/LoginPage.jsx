import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('login');
      }
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
            <div className="login-title">Prompt Manager</div>
            <div className="login-subtitle">SAP Autonomous Suite</div>
          </div>
        </div>

        <div className="login-tabs">
          <button className={`login-tab${mode === 'login' ? ' active' : ''}`} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>Sign in</button>
          <button className={`login-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => { setMode('signup'); setError(''); setInfo(''); }}>Create account</button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="login-field">
              <label>Full name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </div>
          )}
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} />
          </div>

          {error && <div className="login-error">{error}</div>}
          {info  && <div className="login-info">{info}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="login-footer">
          Access is managed by your team admin.<br/>
          New accounts start as <strong>viewer</strong> — an admin must upgrade your role.
        </p>
      </div>
    </div>
  );
}
