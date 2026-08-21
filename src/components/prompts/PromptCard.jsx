import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function SystemChip({ sys, lang, onCopied }) {
  const [flipped, setFlipped] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  const hasEndpoints = sys.endpoints?.length > 0;

  async function handleCopy(text) {
    await copyText(text);
    onCopied();
  }

  return (
    <div className={`card-sys-chip${flipped ? ' flipped' : ''}`}>
      {/* Front */}
      <div className="card-sys-face card-sys-front" onClick={() => hasEndpoints && setFlipped(true)}>
        {sys.url && !hasEndpoints ? (
          <a className="card-sys-link" href={sys.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            🔗 {sys.name || sys.url}
          </a>
        ) : (
          <span className="card-sys-name">
            {hasEndpoints ? '🔑 ' : '🔗 '}{sys.name || sys.url}
            {hasEndpoints && <span className="card-sys-flip-hint"> ▶</span>}
          </span>
        )}
      </div>

      {/* Back — connection details */}
      {hasEndpoints && (
        <div className="card-sys-face card-sys-back">
          <div className="card-sys-back-header">
            <span className="card-sys-back-title">{sys.name}</span>
            <button className="card-sys-back-close" onClick={() => setFlipped(false)}>✕</button>
          </div>
          {sys.url && (
            <div className="card-sys-back-row">
              <span className="card-sys-back-label">SYSTEM URL</span>
              <div className="card-sys-back-value">
                <a href={sys.url} target="_blank" rel="noopener noreferrer" className="card-sys-back-url">{sys.url}</a>
                <button className="card-sys-copy-btn" onClick={() => handleCopy(sys.url)}>COPY</button>
              </div>
            </div>
          )}
          {sys.endpoints.map(ep => (
            <div key={ep.id} className="card-sys-endpoint">
              {ep.label && <div className="card-sys-ep-label">{ep.label.toUpperCase()}</div>}
              {ep.url && (
                <div className="card-sys-back-row">
                  <span className="card-sys-back-label">ENDPOINT</span>
                  <div className="card-sys-back-value">
                    <code className="card-sys-back-code">{ep.url}</code>
                    <button className="card-sys-copy-btn" onClick={() => handleCopy(ep.url)}>COPY</button>
                  </div>
                </div>
              )}
              {ep.clientId && (
                <div className="card-sys-back-row">
                  <span className="card-sys-back-label">CLIENT ID</span>
                  <div className="card-sys-back-value">
                    <code className="card-sys-back-code">{ep.clientId}</code>
                    <button className="card-sys-copy-btn" onClick={() => handleCopy(ep.clientId)}>COPY</button>
                  </div>
                </div>
              )}
              {ep.clientSecret && (
                <div className="card-sys-back-row">
                  <span className="card-sys-back-label">CLIENT SECRET</span>
                  <div className="card-sys-back-value">
                    <code className="card-sys-back-code">{showSecrets[ep.id] ? ep.clientSecret : '••••••••'}</code>
                    <button className="card-sys-copy-btn" onClick={() => setShowSecrets(s => ({ ...s, [ep.id]: !s[ep.id] }))}>
                      {showSecrets[ep.id] ? 'HIDE' : 'SHOW'}
                    </button>
                    <button className="card-sys-copy-btn" onClick={() => handleCopy(ep.clientSecret)}>COPY</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Migrate legacy prompt data to systems array
function getSystems(p) {
  if (p.systems?.length) return p.systems;
  const result = [];
  for (const ls of (p.landscapes || [])) {
    const name = typeof ls === 'string' ? ls : (ls.name || ls.url || '');
    const url  = typeof ls === 'string' ? (ls.startsWith('http') ? ls : '') : (ls.url || '');
    if (name || url) result.push({ id: `ls-${name}`, name, description: '', url, endpoints: [] });
  }
  const mcpList = p.mcpCredentials?.length
    ? p.mcpCredentials
    : p.mcpClientId
      ? [{ id: 'legacy', label: '', clientId: p.mcpClientId, clientSecret: p.mcpClientSecret || '', url: '' }]
      : [];
  for (const c of mcpList) {
    result.push({
      id: c.id || `mcp-${c.clientId}`,
      name: c.label || c.clientId || 'MCP',
      description: '',
      url: c.url || '',
      endpoints: [{ id: `ep-${c.id}`, label: c.label || '', url: c.url || '', clientId: c.clientId || '', clientSecret: c.clientSecret || '' }],
    });
  }
  return result;
}

export default function PromptCard({ prompt: p }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';

  const promptItems = p.promptItems?.length
    ? p.promptItems
    : [{ id: p.id + '-legacy', label: '', body: p.body || '', body_fr: p.body_fr || null }];

  const systems = getSystems(p);

  async function handleCopyItem(item) {
    const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
    await copyText(body);
    await StorageAPI.incrementUsage(p.id);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    dispatch({ type: 'SHOW_TOAST', payload: t('copied', lang) });
  }

  function handleCopied() {
    dispatch({ type: 'SHOW_TOAST', payload: t('secretCopied', lang) });
  }

  async function handleToggleFav() {
    const updated = { ...p, isFavorite: !p.isFavorite };
    await StorageAPI.upsertPrompt(updated);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
  }

  async function handleDuplicate() {
    const now = new Date().toISOString();
    const dupe = {
      ...p,
      id: crypto.randomUUID(),
      title: p.title + ' (copy)',
      isFavorite: false,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await StorageAPI.upsertPrompt(dupe);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    dispatch({ type: 'SHOW_TOAST', payload: `"${dupe.title}" created` });
  }

  function handleEdit() {
    dispatch({ type: 'OPEN_MODAL', payload: p.id });
  }

  function handleDelete() {
    dispatch({ type: 'OPEN_CONFIRM', payload: p.id });
  }

  const langBadge = lang === 'fr'
    ? (p.body_fr || promptItems.some(i => i.body_fr)
        ? <span className="pill lang-badge fr">FR</span>
        : <span className="pill lang-missing">EN only</span>)
    : null;

  const attachCount = p.attachments?.length || 0;
  const isSingle = promptItems.length === 1;

  return (
    <div className="prompt-card">
      <div className="prompt-card-header">
        <div className="prompt-card-title">{p.title}</div>
        <button
          className={`prompt-card-fav${p.isFavorite ? ' active' : ''}`}
          title={p.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={handleToggleFav}
        >★</button>
      </div>

      {/* Prompt items */}
      <div className="prompt-items-list">
        {promptItems.map((item, idx) => {
          const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
          return (
            <div key={item.id} className="prompt-item-row">
              <div className="prompt-item-content">
                {!isSingle && <div className="prompt-item-label">{item.label || `#${idx + 1}`}</div>}
                <div className="prompt-item-preview">{body}</div>
              </div>
              <button className="prompt-item-copy-btn" title={t('copy', lang)} onClick={() => handleCopyItem(item)}>
                {t('copy', lang)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Meta pills */}
      <div className="prompt-card-meta">
        {p.category && <span className="pill category">{p.category}</span>}
        {(p.solutions || []).map(s => <span key={s} className="pill">{s}</span>)}
        {p.storyFlow && <span className="pill flow">{p.storyFlow}</span>}
        {(p.tags || []).slice(0, 3).map(tag => <span key={tag} className="pill tag">#{tag}</span>)}
        {langBadge}
        {attachCount > 0 && <span className="attach-count-pill">📎 {attachCount}</span>}
      </div>

      {/* Systems — flippable chips */}
      {systems.length > 0 && (
        <div className="card-systems-list">
          {systems.map(sys => (
            <SystemChip key={sys.id} sys={sys} lang={lang} onCopied={handleCopied} />
          ))}
        </div>
      )}

      {p.usageCount > 0 && (
        <div className="usage-hint">
          Used {p.usageCount}×{p.lastUsedAt ? ` · ${relTime(p.lastUsedAt)}` : ''}
        </div>
      )}

      <div className="prompt-card-actions">
        <button className="card-action-btn" onClick={handleDuplicate} title="Duplicate">⧉</button>
        <button className="card-action-btn edit" onClick={handleEdit}>{t('edit', lang)}</button>
        <button className="card-action-btn del" onClick={handleDelete}>{t('del', lang)}</button>
      </div>
    </div>
  );
}
