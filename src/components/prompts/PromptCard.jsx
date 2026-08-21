import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { t } from '../../lib/i18n.js';
import { getFlowColor } from '../../lib/flowColors.js';

function fileIcon(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼';
  if (type.includes('pdf')) return '📕';
  if (type.includes('zip') || type.includes('compressed')) return '🗜';
  if (type.includes('spreadsheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
  return '📄';
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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
    <div className={`card-sys-chip${flipped ? ' flipped' : ''}`} onClick={e => e.stopPropagation()}>
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

function makeItem(body = '', body_fr = '') {
  return { id: crypto.randomUUID(), label: '', body, body_fr };
}

// Inline edit form rendered on card back face
function CardEditBack({ prompt: p, catalog, lang, onSave, onCancel }) {
  const [title, setTitle] = useState(p.title || '');
  const [items, setItems] = useState(() =>
    p.promptItems?.length
      ? p.promptItems.map(i => ({ ...i }))
      : [makeItem(p.body || '', p.body_fr || '')]
  );
  const [activeItemId, setActiveItemId] = useState(() =>
    p.promptItems?.length ? p.promptItems[0].id : items[0].id
  );
  const [itemTab, setItemTab] = useState('en');
  const [category, setCategory] = useState(p.category || '');
  const [storyFlow, setStoryFlow] = useState(p.storyFlow || '');
  const [notes, setNotes] = useState(p.notes || '');
  const [systems, setSystems] = useState(() => getSystems(p));
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    AttachmentsDB.getForPrompt(p.id).then(setAttachments);
  }, [p.id]);

  async function downloadAtt(att) {
    const record = await AttachmentsDB.get(att.id);
    if (!record) return;
    const blob = new Blob([record.data], { type: record.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = att.name; a.click();
    URL.revokeObjectURL(url);
  }

  function addFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setPendingFiles(prev => [...prev, {
          _tempId: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          data: ev.target.result,
        }]);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function updateItemBody(id, field, value) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  async function handleSave() {
    if (!title.trim()) return;
    const validItems = items.filter(i => i.body.trim());
    if (validItems.length === 0) return;
    setSaving(true);
    const finalItems = validItems.map(i => ({ ...i, body: i.body.trim(), body_fr: i.body_fr?.trim() || null }));

    const savedNewAtts = [];
    for (const f of pendingFiles) {
      const attId = crypto.randomUUID();
      await AttachmentsDB.save({ id: attId, promptId: p.id, name: f.name, type: f.type, size: f.size, data: f.data });
      savedNewAtts.push({ id: attId, name: f.name, type: f.type, size: f.size });
    }
    for (const attId of pendingDeletes) {
      await AttachmentsDB.delete(attId);
    }
    const attachmentsMeta = [
      ...attachments.filter(a => !pendingDeletes.includes(a.id)).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
      ...savedNewAtts,
    ];

    await StorageAPI.upsertPrompt({
      ...p,
      title: title.trim(),
      body: finalItems[0]?.body || '',
      body_fr: finalItems[0]?.body_fr || null,
      promptItems: finalItems,
      category: category || null,
      storyFlow,
      notes: notes.trim(),
      systems,
      attachments: attachmentsMeta,
    });
    setSaving(false);
    onSave();
  }

  const activeItem = items.find(i => i.id === activeItemId) || items[0];

  return (
    <div className="card-edit-back" onClick={e => e.stopPropagation()}>
      <div className="card-edit-header">
        <span className="card-edit-title">Edit Prompt</span>
        <button className="card-edit-close" onClick={onCancel}>✕</button>
      </div>

      {/* Title */}
      <div className="card-edit-field">
        <label className="card-edit-label">Title</label>
        <input
          className="card-edit-input"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title…"
          maxLength={120}
        />
      </div>

      {/* Prompt items selector + body */}
      {items.length > 1 && (
        <div className="card-edit-item-tabs">
          {items.map((item, idx) => (
            <button
              key={item.id}
              className={`card-edit-item-tab${activeItemId === item.id ? ' active' : ''}`}
              onClick={() => setActiveItemId(item.id)}
            >
              {item.label || `#${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {activeItem && (
        <div className="card-edit-field">
          <div className="card-edit-lang-row">
            <label className="card-edit-label">Body</label>
            <div className="card-edit-lang-btns">
              <button className={`card-edit-lang-btn${itemTab === 'en' ? ' active' : ''}`} onClick={() => setItemTab('en')}>EN</button>
              <button className={`card-edit-lang-btn${itemTab === 'fr' ? ' active' : ''}`} onClick={() => setItemTab('fr')}>FR</button>
            </div>
          </div>
          {itemTab === 'en' ? (
            <textarea
              className="card-edit-textarea"
              value={activeItem.body}
              onChange={e => updateItemBody(activeItem.id, 'body', e.target.value)}
              rows={4}
              placeholder="Prompt text…"
            />
          ) : (
            <textarea
              className="card-edit-textarea"
              value={activeItem.body_fr || ''}
              onChange={e => updateItemBody(activeItem.id, 'body_fr', e.target.value)}
              rows={4}
              placeholder="Texte du prompt (FR)…"
            />
          )}
        </div>
      )}

      {/* Category + Story Flow */}
      <div className="card-edit-2col">
        <div className="card-edit-field">
          <label className="card-edit-label">Category</label>
          <select className="card-edit-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">— None —</option>
            {(catalog.categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="card-edit-field">
          <label className="card-edit-label">Story Flow</label>
          <select className="card-edit-select" value={storyFlow} onChange={e => setStoryFlow(e.target.value)}>
            <option value="">— None —</option>
            {(catalog.storyFlows || []).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Systems */}
      {(catalog.systems || []).length > 0 && (
        <div className="card-edit-field">
          <label className="card-edit-label">{t('systems', lang)}</label>
          <div className="card-edit-systems">
            {catalog.systems.map(sys => {
              const selected = systems.some(s => s.id === sys.id);
              return (
                <button
                  key={sys.id}
                  type="button"
                  className={`card-edit-sys-chip${selected ? ' selected' : ''}`}
                  onClick={() => setSystems(prev =>
                    selected ? prev.filter(s => s.id !== sys.id) : [...prev, sys]
                  )}
                >
                  {selected ? '✓ ' : ''}{sys.name || sys.url}
                  {sys.endpoints?.length > 0 && <span style={{ opacity: 0.6, marginLeft: 3 }}>🔑</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="card-edit-field">
        <label className="card-edit-label">Notes</label>
        <textarea
          className="card-edit-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Demo tips, context…"
        />
      </div>

      {/* Attachments */}
      <div className="card-edit-field">
        <label className="card-edit-label">Attachments</label>
        <div className="card-edit-attachments">
          {attachments.filter(a => !pendingDeletes.includes(a.id)).map(att => (
            <div key={att.id} className="card-edit-att-row">
              <span>{fileIcon(att.type)}</span>
              <button className="card-edit-att-name-btn" onClick={() => downloadAtt(att)} title="Download">{att.name}</button>
              <span className="card-edit-att-size">{fmtSize(att.size)}</span>
              <button className="card-edit-att-del" onClick={() => setPendingDeletes(prev => [...prev, att.id])} title="Remove">×</button>
            </div>
          ))}
          {pendingFiles.map(f => (
            <div key={f._tempId} className="card-edit-att-row pending">
              <span>{fileIcon(f.type)}</span>
              <span className="card-edit-att-name">{f.name}</span>
              <span className="card-edit-att-size">{fmtSize(f.size)}</span>
              <button className="card-edit-att-del" onClick={() => setPendingFiles(prev => prev.filter(x => x._tempId !== f._tempId))} title="Remove">×</button>
            </div>
          ))}
          <button
            type="button"
            className="card-edit-att-add"
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >+ Add file</button>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={e => addFiles(e.target.files)}
          />
        </div>
      </div>

      <div className="card-edit-actions">
        <button className="card-edit-cancel-btn" onClick={onCancel}>{t('cancel', lang)}</button>
        <button className="card-edit-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : t('save', lang)}
        </button>
      </div>
    </div>
  );
}

export default function PromptCard({ prompt: p }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const catalog = state.catalog;

  const [flipped, setFlipped] = useState(false);

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

  async function handleEditSave() {
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    dispatch({ type: 'SHOW_TOAST', payload: t('promptUpdated', lang) });
    setFlipped(false);
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
    <div className={`prompt-card-flip-wrapper${flipped ? ' flipped' : ''}`}>
      {/* Front face */}
      <div className="prompt-card prompt-card-face prompt-card-front" onClick={() => setFlipped(true)}>
        <div className="prompt-card-header">
          <div className="prompt-card-title">{p.title}</div>
          <button
            className={`prompt-card-fav${p.isFavorite ? ' active' : ''}`}
            title={p.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={e => { e.stopPropagation(); handleToggleFav(); }}
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
                  <div className="prompt-item-preview-wrap">
                    <div className="prompt-item-preview">{body}</div>
                    <div className="prompt-item-tooltip">{body}</div>
                  </div>
                </div>
                <button className="prompt-item-copy-btn" title={t('copy', lang)} onClick={e => { e.stopPropagation(); handleCopyItem(item); }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Meta pills */}
        <div className="prompt-card-meta">
          {p.category && <span className="pill category">{p.category}</span>}
          {(p.solutions || []).map(s => <span key={s} className="pill">{s}</span>)}
          {p.storyFlow && (() => { const c = getFlowColor(p.storyFlow); return <span className="pill flow" style={{ background: c.bg, color: c.text }}>{p.storyFlow}</span>; })()}
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
          <button className="card-action-btn" onClick={e => { e.stopPropagation(); handleDuplicate(); }} title="Duplicate">⧉</button>
          <button className="card-action-btn del" onClick={e => { e.stopPropagation(); handleDelete(); }}>{t('del', lang)}</button>
        </div>
      </div>

      {flipped && (
        <div className="prompt-card prompt-card-face prompt-card-back">
          <CardEditBack
            prompt={p}
            catalog={catalog}
            lang={lang}
            onSave={handleEditSave}
            onCancel={() => setFlipped(false)}
          />
        </div>
      )}
    </div>
  );
}
