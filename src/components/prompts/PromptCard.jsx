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

export default function PromptCard({ prompt: p }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const [showAllLandscapes, setShowAllLandscapes] = useState(false);

  // Normalize promptItems — migrate legacy single-body prompts
  const promptItems = p.promptItems?.length
    ? p.promptItems
    : [{ id: p.id + '-legacy', label: '', body: p.body || '', body_fr: p.body_fr || null }];

  async function handleCopyItem(item) {
    const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
    await copyText(body);
    await StorageAPI.incrementUsage(p.id);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    dispatch({ type: 'SHOW_TOAST', payload: t('copied', lang) });
  }

  async function handleCopySecret(secret) {
    if (!secret) return;
    await copyText(secret);
    dispatch({ type: 'SHOW_TOAST', payload: t('secretCopied', lang) });
  }

  async function handleToggleFav() {
    const updated = { ...p, isFavorite: !p.isFavorite };
    await StorageAPI.upsertPrompt(updated);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
  }

  function handleEdit() {
    dispatch({ type: 'OPEN_MODAL', payload: p.id });
  }

  function handleDelete() {
    dispatch({ type: 'OPEN_CONFIRM', payload: p.id });
  }

  // Normalize landscapes — migrate legacy strings
  const landscapes = (p.landscapes || []).map(ls =>
    typeof ls === 'string' ? { name: ls, url: ls.startsWith('http') ? ls : '' } : ls
  );
  const visibleLandscapes = showAllLandscapes ? landscapes : landscapes.slice(0, 2);

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

      {/* Prompt items list */}
      <div className="prompt-items-list">
        {promptItems.map((item, idx) => {
          const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
          return (
            <div key={item.id} className="prompt-item-row">
              <div className="prompt-item-content">
                {!isSingle && (
                  <div className="prompt-item-label">
                    {item.label || `#${idx + 1}`}
                  </div>
                )}
                <div className="prompt-item-preview">{body}</div>
              </div>
              <button
                className="prompt-item-copy-btn"
                title={t('copy', lang)}
                onClick={() => handleCopyItem(item)}
              >{t('copy', lang)}</button>
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

      {/* Landscapes */}
      {landscapes.length > 0 && (
        <div className="card-landscape-list">
          {visibleLandscapes.map((ls, i) => (
            <div key={i} className="card-landscape-item">
              {ls.url ? (
                <a
                  className="card-landscape-link"
                  href={ls.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('openSystem', lang)}
                >
                  🔗 {ls.name || ls.url}
                </a>
              ) : (
                <span className="card-landscape-text">🔗 {ls.name}</span>
              )}
              {ls.url && ls.name && ls.name !== ls.url && (
                <span className="card-landscape-url">{ls.url}</span>
              )}
            </div>
          ))}
          {landscapes.length > 2 && (
            <button
              className="card-landscape-more"
              onClick={() => setShowAllLandscapes(v => !v)}
            >
              {showAllLandscapes ? '▲ less' : `▼ +${landscapes.length - 2} more`}
            </button>
          )}
        </div>
      )}

      {/* MCP Credentials */}
      {(() => {
        // Normalize: support new array and legacy single fields
        const creds = p.mcpCredentials?.length
          ? p.mcpCredentials
          : p.mcpClientId
            ? [{ id: 'legacy', label: '', clientId: p.mcpClientId, clientSecret: p.mcpClientSecret || '' }]
            : [];
        return creds.length > 0 && (
          <div className="card-mcp-list">
            {creds.map(cred => (
              <div key={cred.id} className="card-mcp-row">
                <span className="card-mcp-label">
                  🔑 {cred.label ? <strong>{cred.label}:</strong> : 'MCP:'}{' '}
                  <span className="card-mcp-id">{cred.clientId}</span>
                </span>
                {cred.clientSecret && (
                  <button className="card-mcp-copy-btn" onClick={() => handleCopySecret(cred.clientSecret)}>
                    {t('copySecret', lang)}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {p.usageCount > 0 && (
        <div className="usage-hint">
          Used {p.usageCount}×{p.lastUsedAt ? ` · ${relTime(p.lastUsedAt)}` : ''}
        </div>
      )}

      <div className="prompt-card-actions">
        <button className="card-action-btn edit" onClick={handleEdit}>{t('edit', lang)}</button>
        <button className="card-action-btn del" onClick={handleDelete}>{t('del', lang)}</button>
      </div>
    </div>
  );
}
