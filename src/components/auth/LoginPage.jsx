import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabase.js';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(() => {
    const msg = sessionStorage.getItem('pm-auth-error');
    if (msg) { sessionStorage.removeItem('pm-auth-error'); return msg; }
    return '';
  });
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('catalog').select('categories').limit(1).single().then(({ data }) => {
      if (data?.categories?.length) setCategories(data.categories);
    });
  }, []);

  function toggleDomain(cat) {
    setDomains(d => d.includes(cat) ? d.filter(c => c !== cat) : [...d, cat]);
  }

  function switchMode(m) {
    setMode(m);
    setError('');
    setInfo('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'signup') {
        await signUp(email, password, displayName, domains);
        setInfo('Check your email to confirm your account, then sign in.');
        switchMode('login');
      } else if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://chatonniers.github.io/prompt-manager-web/',
        });
        if (err) throw err;
        setInfo('Password reset email sent — check your inbox.');
        setEmail('');
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
            <div className="login-title">PromptDeck</div>
          </div>
        </div>

        {mode !== 'reset' && (
          <div className="login-tabs">
            <button className={`login-tab${mode === 'login' ? ' active' : ''}`} onClick={() => switchMode('login')}>Sign in</button>
            <button className={`login-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => switchMode('signup')}>Create account</button>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'reset' && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--pm-text2)' }}>
              Enter your email and we'll send you a password reset link.
            </p>
          )}
          {mode === 'signup' && (
            <>
              <div className="login-field">
                <label>Full name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </div>
              {categories.length > 0 && (
                <div className="login-field">
                  <label>Domain expertise <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                  <div className="domain-pills" style={{ marginTop: 6 }}>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`domain-pill${domains.includes(cat) ? ' active' : ''}`}
                        onClick={() => toggleDomain(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
          </div>
          {mode !== 'reset' && (
            <div className="login-field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}
          {info  && <div className="login-info">{info}</div>}

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>

          {mode === 'login' && (
            <button type="button" className="login-forgot" onClick={() => switchMode('reset')}>
              Forgot password?
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="login-forgot" onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          )}
        </form>

        <p className="login-footer">
          Access is managed by your team admin.<br/>
          New accounts start as <strong>viewer</strong> — an admin must upgrade your role.
        </p>
      </div>
    </div>
  );
}
