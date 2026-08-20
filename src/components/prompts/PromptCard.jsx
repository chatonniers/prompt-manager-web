import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
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

export default function PromptCard({ prompt: p }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';

  const body = (lang === 'fr' && p.body_fr) ? p.body_fr : p.body;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = body;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    await StorageAPI.incrementUsage(p.id);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    dispatch({ type: 'SHOW_TOAST', payload: t('copied', lang) });
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

  const langBadge = lang === 'fr'
    ? (p.body_fr
        ? <span className="pill lang-badge fr">FR</span>
        : <span className="pill lang-missing">EN only</span>)
    : null;

  const attachCount = p.attachments?.length || 0;

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
      <div className="prompt-card-body-preview">{body}</div>
      <div className="prompt-card-meta">
        {(p.solutions || []).map(s => <span key={s} className="pill">{s}</span>)}
        {p.storyFlow && <span className="pill flow">{p.storyFlow}</span>}
        {(p.tags || []).slice(0, 3).map(tag => <span key={tag} className="pill tag">#{tag}</span>)}
        {langBadge}
        {attachCount > 0 && <span className="attach-count-pill">📎 {attachCount}</span>}
      </div>
      {p.usageCount > 0 && (
        <div className="usage-hint">
          Used {p.usageCount}×{p.lastUsedAt ? ` · ${relTime(p.lastUsedAt)}` : ''}
        </div>
      )}
      <div className="prompt-card-actions">
        <button className="card-action-btn copy" onClick={handleCopy}>{t('copy', lang)}</button>
        <button className="card-action-btn edit" onClick={handleEdit}>{t('edit', lang)}</button>
        <button className="card-action-btn del" onClick={handleDelete}>{t('del', lang)}</button>
      </div>
    </div>
  );
}
