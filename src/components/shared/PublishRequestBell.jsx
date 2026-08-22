import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

const SEEN_KEY = 'pm-seen-reqs';

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
      <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.5l-1.2 2h11.4l-1.2-2V6A4.5 4.5 0 0 0 8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function PromptPreview({ prompt }) {
  const [expanded, setExpanded] = useState(false);
  const items = prompt?.prompt_items || [];
  const body = items.length > 0 ? items.map(i => i.body).join('\n\n') : (prompt?.body || '');
  if (!body) return null;
  const preview = body.length > 120 ? body.slice(0, 120) + '…' : body;

  return (
    <div className="tb-bell-prompt-preview">
      <button className="tb-bell-preview-toggle" onClick={() => setExpanded(e => !e)}>
        {expanded ? '▾ Hide prompt' : '▸ Show prompt'}
      </button>
      {expanded && (
        <div className="tb-bell-prompt-body">
          {items.length > 0
            ? items.map((item, i) => (
                <div key={i} className="tb-bell-prompt-item">
                  {items.length > 1 && <div className="tb-bell-prompt-item-label">{item.label}</div>}
                  <div className="tb-bell-prompt-item-body">{item.body}</div>
                </div>
              ))
            : <div className="tb-bell-prompt-item-body">{body}</div>
          }
        </div>
      )}
      {!expanded && <div className="tb-bell-prompt-snippet">{preview}</div>}
    </div>
  );
}

export default function PublishRequestBell() {
  const { state, dispatch } = useApp();
  const { isAdmin, isEditor } = useAuth();
  const isReviewer = isAdmin || isEditor;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState({});
  const panelRef = useRef(null);
  const lang = state.settings?.lang || 'en';
  const requests = state.publishRequests || [];

  const badge = isReviewer
    ? requests.filter(r => r.status === 'pending').length
    : (() => {
        const seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]');
        return requests.filter(r => r.status !== 'pending' && !seen.includes(r.id)).length;
      })();

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function markSeen() {
    const seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]');
    const resolved = requests.filter(r => r.status !== 'pending').map(r => r.id);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, ...resolved])]));
  }

  function handleOpen() {
    setOpen(o => !o);
    if (!isReviewer) markSeen();
  }

  async function approve(req) {
    setLoading(l => ({ ...l, [req.id]: 'approve' }));
    try {
      await StorageAPI.reviewPublishRequest(req.id, req.prompt_id, true);
      const [prompts, reqs] = await Promise.all([StorageAPI.getAllPrompts(), StorageAPI.getPublishRequests()]);
      dispatch({ type: 'SET_PROMPTS', payload: prompts });
      dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: reqs });
      dispatch({ type: 'SHOW_TOAST', payload: t('bellApprovedMsg', lang, req.prompt?.title || t('unnamed', lang)) });
    } catch (err) {
      dispatch({ type: 'SHOW_TOAST', payload: `Error: ${err.message}` });
    } finally {
      setLoading(l => { const n = { ...l }; delete n[req.id]; return n; });
    }
  }

  async function reject(req) {
    setLoading(l => ({ ...l, [req.id]: 'reject' }));
    try {
      await StorageAPI.reviewPublishRequest(req.id, req.prompt_id, false);
      const reqs = await StorageAPI.getPublishRequests();
      dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: reqs });
      dispatch({ type: 'SHOW_TOAST', payload: t('bellRejectedMsg', lang, req.prompt?.title || t('unnamed', lang)) });
    } catch (err) {
      dispatch({ type: 'SHOW_TOAST', payload: `Error: ${err.message}` });
    } finally {
      setLoading(l => { const n = { ...l }; delete n[req.id]; return n; });
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const resolvedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="tb-bell" ref={panelRef}>
      <button
        className={`tb-btn tb-btn-icon${open ? ' tb-btn-active' : ''}`}
        onClick={handleOpen}
        title={t('notifications', lang)}
      >
        <BellIcon />
        {badge > 0 && <span className="tb-bell-badge">{badge > 9 ? '9+' : badge}</span>}
      </button>

      {open && (
        <div className="tb-bell-panel">
          <div className="tb-bell-header">
            {isReviewer ? t('bellPublishRequests', lang) : t('bellRequestUpdates', lang)}
          </div>

          {isReviewer ? (
            pendingRequests.length === 0
              ? <div className="tb-bell-empty">{t('bellNoPending', lang)}</div>
              : pendingRequests.map(r => (
                  <div key={r.id} className="tb-bell-item">
                    <div className="tb-bell-item-title">{r.prompt?.title || t('unnamed', lang)}</div>
                    <div className="tb-bell-item-meta">
                      {r.requester?.display_name || r.requester?.email || '?'}
                    </div>
                    <PromptPreview prompt={r.prompt} />
                    <div className="tb-bell-item-actions">
                      <button
                        className="tb-bell-approve"
                        disabled={!!loading[r.id]}
                        onClick={() => approve(r)}
                      >
                        {loading[r.id] === 'approve' ? '…' : t('bellApprove', lang)}
                      </button>
                      <button
                        className="tb-bell-reject"
                        disabled={!!loading[r.id]}
                        onClick={() => reject(r)}
                      >
                        {loading[r.id] === 'reject' ? '…' : t('bellReject', lang)}
                      </button>
                    </div>
                  </div>
                ))
          ) : (
            resolvedRequests.length === 0
              ? <div className="tb-bell-empty">{t('bellNoUpdates', lang)}</div>
              : resolvedRequests.map(r => (
                  <div key={r.id} className="tb-bell-item">
                    <span className="tb-bell-item-status">
                      {r.status === 'approved' ? '✓' : '✗'}
                    </span>
                    <div className="tb-bell-item-body">
                      <div className="tb-bell-item-title">{r.prompt?.title || t('unnamed', lang)}</div>
                      <div className="tb-bell-item-meta">
                        {r.status === 'approved'
                          ? t('bellApprovedStatus', lang)
                          : t('bellRejectedStatus', lang)}
                      </div>
                    </div>
                  </div>
                ))
          )}
        </div>
      )}
    </div>
  );
}
