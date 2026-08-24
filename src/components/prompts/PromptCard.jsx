import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI, uploadSkillFile, deleteSkillFile } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { t } from '../../lib/i18n.js';
import { getFlowColor } from '../../lib/flowColors.js';
import { extractVars } from '../../lib/substitution.js';
import SubstituteModal from '../shared/SubstituteModal.jsx';
import JouleDiamond from '../shared/JouleDiamond.jsx';
import JouleSkillModal from '../shared/JouleSkillModal.jsx';

function fileIcon(mime = '') {
  if (mime.startsWith('image/')) return '🖼';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜';
  return '📎';
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function relTime(iso, lang) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return t('justNow', lang);
  if (m < 60) return t('mAgo', lang, m);
  const h = Math.floor(m / 60);
  if (h < 24) return t('hAgo', lang, h);
  return t('dAgo', lang, Math.floor(h / 24));
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
      <div className="card-sys-face card-sys-front" onClick={() => hasEndpoints && setFlipped(true)}>
        {sys.url && !hasEndpoints ? (
          <a className="card-sys-link" href={sys.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            {sys.name || sys.url}
          </a>
        ) : (
          <span className="card-sys-name">
            {sys.name || sys.url}
            {hasEndpoints && <span className="card-sys-flip-hint"> ›</span>}
          </span>
        )}
      </div>

      {hasEndpoints && (
        <div className="card-sys-face card-sys-back">
          <div className="card-sys-back-header">
            <span className="card-sys-back-title">{sys.name}</span>
            <button className="card-sys-back-close" onClick={() => setFlipped(false)}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
          </div>
          {sys.url && (
            <div className="card-sys-back-row">
              <span className="card-sys-back-label">{t('sysUrl', lang)}</span>
              <div className="card-sys-back-value">
                <a href={sys.url} target="_blank" rel="noopener noreferrer" className="card-sys-back-url">{sys.url}</a>
                <button className="card-sys-copy-btn" onClick={() => handleCopy(sys.url)}>{t('copyBtn', lang)}</button>
              </div>
            </div>
          )}
          {sys.endpoints.map(ep => (
            <div key={ep.id} className="card-sys-endpoint">
              {ep.label && <div className="card-sys-ep-label">{ep.label.toUpperCase()}</div>}
              {ep.url && (
                <div className="card-sys-back-row">
                  <span className="card-sys-back-label">{t('endpoint', lang)}</span>
                  <div className="card-sys-back-value">
                    <code className="card-sys-back-code">{ep.url}</code>
                    <button className="card-sys-copy-btn" onClick={() => handleCopy(ep.url)}>{t('copyBtn', lang)}</button>
                  </div>
                </div>
              )}
              {ep.clientId && (
                <div className="card-sys-back-row">
                  <span className="card-sys-back-label">{t('clientId', lang)}</span>
                  <div className="card-sys-back-value">
                    <code className="card-sys-back-code">{ep.clientId}</code>
                    <button className="card-sys-copy-btn" onClick={() => handleCopy(ep.clientId)}>{t('copyBtn', lang)}</button>
                  </div>
                </div>
              )}
              {ep.clientSecret && (
                <div className="card-sys-back-row">
                  <span className="card-sys-back-label">{t('clientSecret', lang)}</span>
                  <div className="card-sys-back-value">
                    <code className="card-sys-back-code">{showSecrets[ep.id] ? ep.clientSecret : '••••••••'}</code>
                    <button className="card-sys-copy-btn" onClick={() => setShowSecrets(s => ({ ...s, [ep.id]: !s[ep.id] }))}>
                      {showSecrets[ep.id] ? t('hideBtn', lang) : t('showBtn', lang)}
                    </button>
                    <button className="card-sys-copy-btn" onClick={() => handleCopy(ep.clientSecret)}>{t('copyBtn', lang)}</button>
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

function getSystems(p) {
  const result = [];
  if (p.systems?.length) {
    const seen = new Set();
    for (const s of p.systems) {
      const key = s.id || s.name || s.url;
      if (key && seen.has(key)) continue;
      seen.add(key);
      result.push(s);
    }
    return result;
  }
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

function CardEditBack({ prompt: p, catalog, lang, onSave, onCancel, onDuplicate, onDelete, dupeTarget, setDupeTarget, canPublish, canEdit, approvedRequest }) {
  const { state } = useApp();  const [title, setTitle] = useState(p.title || '');
  const [items, setItems] = useState(() =>
    p.promptItems?.length
      ? p.promptItems.map(i => ({ ...i }))
      : [makeItem(p.body || '', p.body_fr || '')]
  );
  const [activeItemId, setActiveItemId] = useState(() =>
    p.promptItems?.length ? p.promptItems[0].id : items[0].id
  );
  const [itemTab, setItemTab] = useState('en');
  const [backTab, setBackTab] = useState('content');
  const [category, setCategory] = useState(p.category || '');
  const [storyFlow, setStoryFlow] = useState(p.storyFlow || '');
  const [status, setStatus] = useState(p.status || '');
  const [personas, setPersonas] = useState(p.personas || []);
  const [notes, setNotes] = useState(p.notes || '');
  const [solutions, setSolutions] = useState(p.solutions || []);
  const [systems, setSystems] = useState(() => getSystems(p));
  const [demoLinks, setDemoLinks] = useState(() =>
    Array.isArray(p.demoLinks) ? p.demoLinks.map(l => ({ ...l })) : []
  );
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    AttachmentsDB.getForPrompt(p.id).then(atts => {
      const meta = p.attachments || [];
      setAttachments(atts.map(a => {
        const m = meta.find(x => x.id === a.id);
        return m?.isJouleSkill ? { ...a, isJouleSkill: true } : a;
      }));
    });
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
    const finalItems = validItems.map((i, idx) => ({
      ...i,
      label: i.label.trim() || (validItems.length === 1 ? title.trim() : `Part ${idx + 1}`),
      body: i.body.trim(),
      body_fr: i.body_fr?.trim() || null,
    }));

    try {
      const savedNewAtts = [];
      for (const f of pendingFiles) {
        const attId = crypto.randomUUID();
        await AttachmentsDB.save({ id: attId, promptId: p.id, name: f.name, type: f.type, size: f.size, data: f.data });
        savedNewAtts.push({ id: attId, name: f.name, type: f.type, size: f.size, isJouleSkill: f.isJouleSkill || false });
      }
      for (const attId of pendingDeletes) {
        await AttachmentsDB.delete(attId);
        const att = attachments.find(a => a.id === attId);
        if (att?.skill_url) {
          try { await deleteSkillFile(p.id, attId, att.name); } catch (e) { console.error('Skill delete failed:', e); }
        }
      }

      for (const att of savedNewAtts) {
        const fileObj = pendingFiles.find(f => f.name === att.name);
        if (fileObj?.data) {
          try { att.skill_url = await uploadSkillFile(p.id, att.id, att.name, fileObj.data); }
          catch (e) { console.error('Skill upload failed:', e); }
        }
      }
      for (const att of attachments) {
        if (!att.skill_url && !pendingDeletes.includes(att.id)) {
          const stored = await AttachmentsDB.get(att.id);
          if (stored?.data) {
            try { att.skill_url = await uploadSkillFile(p.id, att.id, att.name, stored.data); }
            catch (e) { console.error('Skill upload failed:', e); }
          }
        }
      }

      const attachmentsMeta = [
        ...attachments.filter(a => !pendingDeletes.includes(a.id)).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size, isJouleSkill: a.isJouleSkill || false, skill_url: a.skill_url || null })),
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
        status: status || null,
        isPrivate: approvedRequest ? true : (p.isPrivate ?? true),
        personas,
        notes: notes.trim(),
        solutions,
        systems,
        demoLinks: demoLinks.filter(l => l.url.trim()),
        attachments: attachmentsMeta,
      });
      if (approvedRequest) {
        await StorageAPI.deletePublishRequest(p.id);
      }
      const [freshPrompts, freshCatalog, freshRequests] = await Promise.all([
        StorageAPI.getAllPrompts(),
        StorageAPI.getCatalog(),
        approvedRequest ? StorageAPI.getPublishRequests() : Promise.resolve(null),
      ]);
      if (freshRequests) onSave(freshPrompts, freshCatalog, freshRequests);
      else onSave(freshPrompts, freshCatalog);
    } finally {
      setSaving(false);
    }
  }

  const activeItem = items.find(i => i.id === activeItemId) || items[0];

  return (
    <div className="card-edit-back" onClick={e => e.stopPropagation()}>
      <div className="card-edit-header">
        <span className="card-edit-title">{t('editPromptTitle', lang)}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {dupeTarget ? (
            <div className="dupe-popover">
              <span className="dupe-popover-label">Copy to:</span>
              <button className="dupe-popover-btn library" onClick={() => onDuplicate('library')}>Library</button>
              <button className="dupe-popover-btn mine" onClick={() => onDuplicate('mine')}>Mine</button>
              <button className="dupe-popover-cancel" onClick={() => setDupeTarget(false)}>✕</button>
            </div>
          ) : (
            <button className="card-edit-close" onClick={() => setDupeTarget(true)} title={t('duplicateTitle', lang)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
          )}
          <button className="card-edit-close" onClick={onCancel}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      <div className="card-edit-back-tabs">
        <button className={`card-edit-back-tab${backTab === 'content' ? ' active' : ''}`} onClick={() => setBackTab('content')}>Content</button>
        <button className={`card-edit-back-tab${backTab === 'details' ? ' active' : ''}`} onClick={() => setBackTab('details')}>Details</button>
      </div>

      {backTab === 'content' && (
        <div className="card-edit-body">
          <div className="card-edit-field">
            <label className="card-edit-label">{t('titleLabel', lang)}</label>
            <input className="card-edit-input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder', lang)} maxLength={120} />
          </div>

          <div className="card-edit-field">
            <label className="card-edit-label">{t('personasLabel', lang)}</label>
            <div className="card-edit-systems">
              {(catalog.personas || []).map(persona => {
                const selected = personas.includes(persona);
                return (
                  <button key={persona} type="button" className={`card-edit-sys-chip${selected ? ' selected' : ''}`} onClick={() => setPersonas(prev => selected ? prev.filter(x => x !== persona) : [...prev, persona])}>
                    {selected ? '· ' : ''}{persona}
                  </button>
                );
              })}
              {personas.filter(p => !(catalog.personas || []).includes(p)).map(persona => (
                <span key={persona} className="card-edit-sys-chip selected orphan-sys" style={{ opacity: 0.6 }}>
                  · {persona}
                  <button type="button" className="card-edit-tag-del" onClick={() => setPersonas(prev => prev.filter(x => x !== persona))} title="Remove">×</button>
                </span>
              ))}
              {(catalog.personas || []).length === 0 && personas.length === 0 && (
                <p className="card-edit-hint">{t('noPersonasYet', lang)}</p>
              )}
            </div>
          </div>

          <div className="card-edit-field">
            <label className="card-edit-label">{t('notesLabel', lang)}</label>
            <textarea className="card-edit-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholderCard', lang)} />
          </div>

          <div className="card-edit-item-tabs">
            {items.map((item, idx) => (
              <button key={item.id} className={`card-edit-item-tab${activeItemId === item.id ? ' active' : ''}${!item.label.trim() ? ' tab-error' : ''}`} onClick={() => setActiveItemId(item.id)}>
                {item.label || `#${idx + 1}`}
              </button>
            ))}
            <button className="card-edit-item-tab" style={{ opacity: 0.7 }} onClick={() => { const newItem = makeItem(); setItems(prev => [...prev, newItem]); setActiveItemId(newItem.id); }} title={t('addPromptItem', lang)}>+</button>
            {items.length > 1 && (
              <button className="card-edit-item-tab" style={{ opacity: 0.7, color: 'var(--pm-danger)' }} onClick={() => { const remaining = items.filter(i => i.id !== activeItemId); setItems(remaining); setActiveItemId(remaining[remaining.length - 1]?.id); }} title={t('removePrompt', lang)}>−</button>
            )}
          </div>

          {activeItem && (
            <div className="card-edit-field">
              <div className="card-edit-lang-row">
                <label className="card-edit-label">{t('bodyLabel', lang)}</label>
                <div className="card-edit-lang-btns">
                  <button className={`card-edit-lang-btn${itemTab === 'en' ? ' active' : ''}`} onClick={() => setItemTab('en')}>EN</button>
                  <button className={`card-edit-lang-btn${itemTab === 'fr' ? ' active' : ''}`} onClick={() => setItemTab('fr')}>FR</button>
                </div>
              </div>
              <input className="card-edit-input" type="text" value={activeItem.label} onChange={e => updateItemBody(activeItem.id, 'label', e.target.value)} placeholder={t('promptItemLabel', lang)} style={{ marginBottom: 4, fontSize: 12, borderColor: activeItem.label.trim() ? '' : 'var(--pm-danger)' }} />
              {itemTab === 'en' ? (
                <textarea className="card-edit-textarea" value={activeItem.body} onChange={e => updateItemBody(activeItem.id, 'body', e.target.value)} rows={4} placeholder={t('bodyEnPlaceholder', lang)} />
              ) : (
                <textarea className="card-edit-textarea" value={activeItem.body_fr || ''} onChange={e => updateItemBody(activeItem.id, 'body_fr', e.target.value)} rows={4} placeholder={t('bodyFrPlaceholder', lang)} />
              )}
            </div>
          )}
        </div>
      )}

      {backTab === 'details' && (
        <div className="card-edit-body">
          <div className="card-edit-2col">
            <div className="card-edit-field">
              <label className="card-edit-label">{t('category', lang)}</label>
              <select className="card-edit-select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">{t('selectNone', lang)}</option>
                {(catalog.categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="card-edit-field">
              <label className="card-edit-label">{t('flowLabel', lang)}</label>
              <select className="card-edit-select" value={storyFlow} onChange={e => setStoryFlow(e.target.value)}>
                <option value="">{t('selectNone', lang)}</option>
                {(catalog.storyFlows || []).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {(catalog.solutions || []).length > 0 && (
            <div className="card-edit-field">
              <label className="card-edit-label">{t('solutionsLabel', lang)}</label>
              <div className="card-edit-systems">
                {catalog.solutions.map(sol => {
                  const selected = solutions.includes(sol);
                  return (
                    <button key={sol} type="button" className={`card-edit-sys-chip${selected ? ' selected' : ''}`} onClick={() => setSolutions(prev => selected ? prev.filter(x => x !== sol) : [...prev, sol])}>
                      {selected ? '· ' : ''}{sol}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card-edit-field">
            <label className="card-edit-label">{t('statusLabel', lang)}</label>
            <div className="card-status-btns">
              {(canPublish ? ['draft', 'published', 'archived'] : ['draft']).map(s => (
                <button key={s} type="button" className={`card-status-btn${s ? ` status-opt-${s}` : ''}${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'}
                </button>
              ))}
            </div>
          </div>

          <div className="card-edit-field">
            {demoLinks.map((link, idx) => (
              <div key={link.id} className="card-edit-demo-link-row">
                <input className="card-edit-input card-edit-demo-desc" type="text" value={link.desc || ''} onChange={e => setDemoLinks(prev => prev.map((l, i) => i === idx ? { ...l, desc: e.target.value } : l))} placeholder={t('demoLinkDescPlaceholder', lang)} />
                <input className="card-edit-input card-edit-demo-url" type="url" value={link.url} onChange={e => setDemoLinks(prev => prev.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))} placeholder={t('demoLinkUrlPlaceholder', lang)} />
                <button type="button" className="card-edit-att-del" onClick={() => setDemoLinks(prev => prev.filter((_, i) => i !== idx))}>×</button>
              </div>
            ))}
            <button type="button" className="card-edit-att-add" onClick={() => setDemoLinks(prev => [...prev, { id: crypto.randomUUID(), url: '', desc: '' }])}>{t('addDemoLink', lang)}</button>
          </div>

          <div className="card-edit-field">
            <label className="card-edit-label">{t('landscapeCard', lang)}</label>
            <div className="card-edit-systems">
              {(catalog.systems || []).map(sys => {
                const selected = systems.some(s => s.id === sys.id);
                return (
                  <button key={sys.id} type="button" className={`card-edit-sys-chip${selected ? ' selected' : ''}`} onClick={() => setSystems(prev => selected ? prev.filter(s => s.id !== sys.id) : [...prev, sys])}>
                    {selected ? '· ' : ''}{sys.name || sys.url}
                    {sys.endpoints?.length > 0 && <span style={{ opacity: 0.6, marginLeft: 3, fontSize: 10 }}>cred</span>}
                  </button>
                );
              })}
              {/* Orphaned systems — on the card but not in catalog */}
              {systems.filter(s => !(catalog.systems || []).some(cs => cs.id === s.id)).map(sys => (
                <span key={sys.id} className="card-edit-sys-chip selected orphan-sys" style={{ opacity: 0.6 }}>
                  · {sys.name || sys.url}
                  <button type="button" className="card-edit-tag-del" onClick={() => setSystems(prev => prev.filter(s => s.id !== sys.id))} title="Remove">×</button>
                </span>
              ))}
              {(catalog.systems || []).length === 0 && systems.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--pm-text3)', fontStyle: 'italic' }}>No systems configured in settings</span>
              )}
            </div>
          </div>

          <div className="card-edit-field">
            <label className="card-edit-label">{t('attachmentsLabel', lang)}</label>
            <div className="card-edit-attachments">
              {attachments.filter(a => !pendingDeletes.includes(a.id)).map(att => (
                <div key={att.id} className="card-edit-att-row">
                  <span>{fileIcon(att.type)}</span>
                  <button className="card-edit-att-name-btn" onClick={() => downloadAtt(att)} title="Download">{att.name}</button>
                  <span className="card-edit-att-size">{fmtSize(att.size)}</span>
                  <button
                    type="button"
                    className={`card-edit-att-joule${att.isJouleSkill ? ' active' : ''}`}
                    title={att.isJouleSkill ? 'Unmark as Joule Skill' : 'Mark as Joule Skill'}
                    onClick={() => setAttachments(prev => prev.map(a => a.id === att.id ? { ...a, isJouleSkill: !a.isJouleSkill } : a))}
                  ><JouleDiamond size={13} /></button>
                  <button className="card-edit-att-del" onClick={() => setPendingDeletes(prev => [...prev, att.id])} title="Remove">×</button>
                </div>
              ))}
              {pendingFiles.map(f => (
                <div key={f._tempId} className="card-edit-att-row pending">
                  <span>{fileIcon(f.type)}</span>
                  <span className="card-edit-att-name">{f.name}</span>
                  <span className="card-edit-att-size">{fmtSize(f.size)}</span>
                  <button
                    type="button"
                    className={`card-edit-att-joule${f.isJouleSkill ? ' active' : ''}`}
                    title={f.isJouleSkill ? 'Unmark as Joule Skill' : 'Mark as Joule Skill'}
                    onClick={() => setPendingFiles(prev => prev.map(x => x._tempId === f._tempId ? { ...x, isJouleSkill: !x.isJouleSkill } : x))}
                  ><JouleDiamond size={13} /></button>
                  <button className="card-edit-att-del" onClick={() => setPendingFiles(prev => prev.filter(x => x._tempId !== f._tempId))} title="Remove">×</button>
                </div>
              ))}
              <button type="button" className="card-edit-att-add" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>{t('addFileBtn', lang)}</button>
              <input type="file" ref={fileInputRef} multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            </div>
          </div>
        </div>
      )}

      <div className="card-edit-actions">
        {(canEdit && p.status === 'draft') && (
          <div className="card-privacy-seg">
            <button
              type="button"
              className={`card-privacy-btn${p.isPrivate !== false ? ' active private' : ''}`}
              onClick={async () => { if (p.isPrivate !== true) await StorageAPI.upsertPrompt({ ...p, isPrivate: true }); }}
            >{t('visibilityPrivate', lang)}</button>
            <button
              type="button"
              className={`card-privacy-btn${p.isPrivate === false ? ' active shared' : ''}`}
              onClick={async () => { if (p.isPrivate !== false) await StorageAPI.upsertPrompt({ ...p, isPrivate: false }); }}
            >{t('visibilityPublic', lang)}</button>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button className="card-edit-cancel-btn" onClick={onCancel}>{t('cancel', lang)}</button>
        {onDelete && (
          <button className="card-edit-del-btn" onClick={onDelete}>{t('del', lang)}</button>
        )}
        <button className="card-edit-save-btn" onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? t('savingLabel', lang) : t('save', lang)}
        </button>
      </div>
    </div>
  );
}

function PromptItemRow({ item, idx, label, body, isCopied, lang, onCopy }) {
  const rowRef = useRef(null);
  const [popover, setPopover] = useState(null); // { top, left, arrowTop, side }

  function showPopover() {
    if (!rowRef.current) return;
    const r = rowRef.current.getBoundingClientRect();
    const popW = 380;
    const popMaxH = 320;
    const margin = 12;
    const arrowTop = Math.min(Math.max(r.top + r.height / 2, r.top + 16), r.bottom - 16);

    // Try right side first
    if (r.right + margin + popW <= window.innerWidth - margin) {
      let top = r.top + r.height / 2 - 60;
      top = Math.max(margin, Math.min(top, window.innerHeight - popMaxH - margin));
      setPopover({ top, left: r.right + margin, arrowTop: arrowTop - top, side: 'left' });
    } else {
      // Fall back to left side
      let top = r.top + r.height / 2 - 60;
      top = Math.max(margin, Math.min(top, window.innerHeight - popMaxH - margin));
      setPopover({ top, left: r.left - margin - popW, arrowTop: arrowTop - top, side: 'right' });
    }
  }

  return (
    <div ref={rowRef}
      className={`prompt-item-row${isCopied ? ' prompt-item-copied' : ''}`}
      onClick={e => { e.stopPropagation(); onCopy(e); }}
      onMouseEnter={showPopover}
      onMouseLeave={() => setPopover(null)}
    >
      <div className="prompt-item-content">
        <span className="prompt-item-num">{idx + 1}</span>
        <div className="prompt-item-preview-wrap">
          <span className="prompt-item-preview">{label}</span>
        </div>
        {isCopied && (
          <svg className="prompt-item-copied-icon" width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>
      {popover && createPortal(
        <div className="prompt-popover" style={{ top: popover.top, left: popover.left }}>
          <div
            className={`prompt-popover-arrow prompt-popover-arrow-${popover.side}`}
            style={{ top: popover.arrowTop }}
          />
          {label && <div className="prompt-popover-label">{label}</div>}
          <div className="prompt-popover-body">{body}</div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function PromptCard({ prompt: p, isSelected, onToggleSelect }) {
  const { state, dispatch } = useApp();
  const { isAdmin, isEditor, profile } = useAuth();
  const workspace = state.workspace ?? 'library';
  const canEdit = isAdmin || isEditor || (workspace === 'mine' && p.ownerId === profile?.id);
  const canPublish = isAdmin || isEditor;
  const lang = state.settings?.lang || 'en';
  const catalog = state.catalog;
  const isDragging = state.draggingId === p.id;

  // Publish request state for this card
  const myRequest = state.publishRequests?.find(r => r.prompt_id === p.id);
  const isPendingRequest = myRequest?.status === 'pending';
  const isApprovedRequest = myRequest?.status === 'approved';
  // Request button: viewer, Mine workspace, own draft, public, and not already approved
  const showRequestBtn = workspace === 'mine' && !canPublish && p.status === 'draft' && p.ownerId === profile?.id && p.isPrivate === false && !isApprovedRequest;

  const [flipped, setFlipped] = useState(false);
  const [flashSaved, setFlashSaved] = useState(false);
  const [substItem, setSubstItem] = useState(null);
  const [dupeTarget, setDupeTarget] = useState(false); // shows copy-to popover
  // Per-item copy state: itemId → 'copied' | null
  const [copiedItemId, setCopiedItemId] = useState(null);
  const [ctaCopied, setCtaCopied] = useState(false);
  const [jouleModal, setJouleModal] = useState(null); // { skillName, skillContent }

  const promptItems = p.promptItems?.length
    ? p.promptItems
    : [{ id: p.id + '-legacy', label: '', body: p.body || '', body_fr: p.body_fr || null }];

  const systems = getSystems(p);
  const isSingle = promptItems.length === 1;

  // Determine left-edge color from flow, then category index, then default
  const flowColor = p.storyFlow ? getFlowColor(p.storyFlow) : null;
  const edgeColor = flowColor ? flowColor.border : 'var(--pm-border)';

  async function handleCopyItem(item, isCta = false) {
    const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
    const vars = extractVars(body);
    if (vars.length > 0) {
      setSubstItem({ item, body });
      return;
    }
    await doCopy(body, item, isCta);
  }

  async function doCopy(text, item, isCta = false) {
    await copyText(text);
    await StorageAPI.incrementUsage(p.id);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    const jouleAtt = (p.attachments || []).find(a => a.isJouleSkill);
    const jouleWillHandle = jouleAtt && profile?.joule_integration && profile?.joule_connected && p.status === 'published';
    if (!jouleWillHandle) {
      dispatch({ type: 'SHOW_TOAST', payload: t('copied', lang) });
    }
    if (isCta) {
      setCtaCopied(true);
      setTimeout(() => setCtaCopied(false), 1500);
    } else {
      setCopiedItemId(item.id);
      setTimeout(() => setCopiedItemId(null), 1500);
    }
    if (jouleAtt && profile?.joule_integration && profile?.joule_connected) {
      if (p.status !== 'published') {
        dispatch({ type: 'SHOW_TOAST', payload: 'Joule Desktop integration is only available for published prompts. Prompt copied.' });
        return;
      }
      const allAtts = await AttachmentsDB.getForPrompt(p.id);
      const file = allAtts.find(a => a.id === jouleAtt.id);
      let content = null;
      const isZip = jouleAtt.name?.toLowerCase().endsWith('.zip') || jouleAtt.type?.includes('zip');

      async function extractSkillContent(buf) {
        if (isZip) {
          const zip = await JSZip.loadAsync(buf);
          const skillFile = zip.file('SKILL.md') || zip.file(/SKILL\.md$/i)[0];
          if (skillFile) return skillFile.async('string');
          return null;
        }
        return new TextDecoder('utf-8').decode(buf instanceof ArrayBuffer ? buf : await buf.arrayBuffer());
      }

      if (file?.data) {
        const buf = file.data instanceof ArrayBuffer ? file.data : await file.data.arrayBuffer();
        content = await extractSkillContent(buf);
      } else if (jouleAtt.skill_url) {
        try {
          const res = await fetch(jouleAtt.skill_url);
          if (isZip) {
            content = await extractSkillContent(await res.arrayBuffer());
          } else {
            content = await res.text();
          }
        } catch (e) { console.error('Skill fetch failed:', e); }
      }
      if (content) {
        const nameMatch = content.match(/(?:^|\n)name:\s*([^\n\r]+)/);
        const skillName = nameMatch
          ? nameMatch[1].trim()
          : jouleAtt.name.replace(/\.[^.]+$/g, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        setJouleModal({ skillName, skillContent: content, promptText: text });
      } else {
        // No skill content available — launch Joule with prompt only, skip skill install
        setJouleModal({ skillName: null, skillContent: null, promptText: text });
      }
    }
  }

  function handleCopied() {
    dispatch({ type: 'SHOW_TOAST', payload: t('secretCopied', lang) });
  }

  async function handleToggleFav() {
    const updated = { ...p, isFavorite: !p.isFavorite };
    // Optimistic update — instant UI feedback
    dispatch({ type: 'SET_PROMPTS', payload: state.prompts.map(x => x.id === p.id ? updated : x) });
    await StorageAPI.upsertPrompt(updated);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
  }

  async function handleDuplicate(target) {
    const now = new Date().toISOString();
    const status = target === 'mine' ? 'draft' : 'published';
    const dupe = { ...p, id: crypto.randomUUID(), title: p.title + ' ' + t('copyDuplicate', lang), isFavorite: false, usageCount: 0, lastUsedAt: null, createdAt: now, updatedAt: now, status, ownerId: undefined };
    setDupeTarget(false);
    await StorageAPI.upsertPrompt(dupe);
    const prompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: prompts });
    dispatch({ type: 'SHOW_TOAST', payload: t('promptCreated', lang) });
  }

  async function handleEditSave(freshPrompts, freshCatalog, freshRequests) {
    dispatch({ type: 'SET_PROMPTS', payload: freshPrompts });
    dispatch({ type: 'SET_CATALOG', payload: freshCatalog });
    if (freshRequests) dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: freshRequests });
    dispatch({ type: 'SHOW_TOAST', payload: t('promptUpdated', lang) });
    setFlipped(false);
    setFlashSaved(true);
    setTimeout(() => setFlashSaved(false), 800);
  }

  function handleDelete() {
    dispatch({ type: 'OPEN_CONFIRM', payload: p.id });
  }

  const langBadge = lang === 'fr'
    ? (p.body_fr || promptItems.some(i => i.body_fr)
        ? <span className="pill lang-badge fr">FR</span>
        : <span className="pill lang-missing">{t('enOnly', lang)}</span>)
    : null;

  const attachCount = p.attachments?.length || 0;
  const hasJouleSkill = (p.attachments || []).some(a => a.isJouleSkill);

  return (
    <div className={`prompt-card-flip-wrapper${flipped ? ' flipped' : ''}${flashSaved ? ' card--flash-saved' : ''}`}>
      {/* Front face */}
      <div
        className={`prompt-card prompt-card-face prompt-card-front${isSingle ? ' prompt-card-single' : ''}${isDragging ? ' is-dragging' : ''}`}
        style={{ '--card-accent-color': edgeColor }}
        tabIndex={0}
        draggable={true}
        onDragStart={e => { e.dataTransfer.setData('promptId', p.id); dispatch({ type: 'SET_DRAGGING', payload: p.id }); }}
        onDragEnd={() => dispatch({ type: 'SET_DRAGGING', payload: null })}
        onClick={() => canEdit && setFlipped(true)}
        onKeyDown={e => { if (e.key === 'Enter' && canEdit) setFlipped(true); }}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            className={`card-checkbox${isSelected ? ' checked' : ''}`}
            checked={!!isSelected}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onToggleSelect(p.id); }}
            title="Select"
          />
        )}
        <div className="prompt-card-body">

        {/* Header: fav | title + personas | category pill */}
        <div className="prompt-card-header">
          <button className={`prompt-card-fav${p.isFavorite ? ' active' : ''}`} title={p.isFavorite ? t('removeFromFav', lang) : t('addToFav', lang)} onClick={e => { e.stopPropagation(); handleToggleFav(); }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill={p.isFavorite ? 'currentColor' : 'none'} xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1.5l1.8 3.6 4 .58-2.9 2.83.68 3.99L8 10.35l-3.58 1.88.68-3.99L2.2 5.68l4-.58L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="prompt-card-title-area">
            <div className="prompt-card-title">{p.title}</div>
            {(p.personas || []).length > 0 && (
              <div className="prompt-card-personas">
                {p.personas.map(persona => <span key={persona} className="pill persona">{persona}</span>)}
              </div>
            )}
          </div>
          {p.category && <span className="pill category card-header-category">{p.category}</span>}
        </div>

        {/* Notes */}
        {p.notes && <div className="prompt-card-notes">{p.notes}</div>}

        {/* Prompt items */}
        <div className="prompt-items-list">
          {promptItems.map((item, idx) => {
            const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
            const label = item.label || (isSingle ? t('copy', lang) : `Prompt ${idx + 1}`);
            const isCopied = copiedItemId === item.id;
            return (
              <PromptItemRow
                key={item.id}
                item={item}
                idx={idx}
                label={label}
                body={body}
                isCopied={isCopied}
                lang={lang}
                onCopy={e => { e.stopPropagation(); handleCopyItem(item, false); }}
              />
            );
          })}
        </div>

        {/* Meta pills */}
        <div className="prompt-card-meta">
          {(p.solutions || []).map(s => <span key={s} className="pill">{s}</span>)}
          {p.storyFlow && (() => { const c = getFlowColor(p.storyFlow); return <span className="pill flow" style={{ background: c.bg, color: c.text }}>{p.storyFlow}</span>; })()}
          {p.status && <span className={`pill status-${p.status}`}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>}
          {langBadge}
          {p.usageCount > 0 && <span className="usage-hint" style={{ marginLeft: 'auto' }}>Used {t('usedCount', lang, p.usageCount)}{p.lastUsedAt ? ` · ${relTime(p.lastUsedAt, lang)}` : ''}</span>}
        </div>

        {/* Request publish button (viewers, Mine workspace) */}
        {isPendingRequest && workspace === 'mine' && !canPublish && p.ownerId === profile?.id && (
          <div className="card-request-pending">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/><path d="M6 3.5v3l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {t('requestedPublish', lang)}
          </div>
        )}
        {showRequestBtn && (
          <div style={{ marginTop: 6 }}>
            <button
              className={`card-request-btn${isPendingRequest ? ' requested' : ''}`}
              disabled={isPendingRequest}
              onClick={async e => {
                e.stopPropagation();
                try {
                  await StorageAPI.createPublishRequest(p.id);
                  const reqs = await StorageAPI.getPublishRequests();
                  dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: reqs });
                  dispatch({ type: 'SHOW_TOAST', payload: t('publishRequestSent', lang) });
                } catch (err) {
                  dispatch({ type: 'SHOW_TOAST', payload: `Error: ${err.message}` });
                }
              }}
            >
              {isPendingRequest ? t('requestedPublish', lang) : t('requestPublish', lang)}
            </button>
          </div>
        )}

        {/* Joule Skill badge */}
        {hasJouleSkill && (
          <div className="card-joule-badge">
            <JouleDiamond size={18} />
            <span>Joule Skill</span>
          </div>
        )}

        {/* Systems */}
        {systems.length > 0 && (
          <div className="card-systems-list">
            {systems.map(sys => <SystemChip key={sys.id} sys={sys} lang={lang} onCopied={handleCopied} />)}
          </div>
        )}

        {/* Demo links */}
        {(p.demoLinks || []).filter(l => l.url).length > 0 && (
          <>
            <div className="card-section-label">Demo link(s)</div>
            <div className="card-demo-links">
              {p.demoLinks.filter(l => l.url).map(link => (
                <a key={link.id} className="card-demo-link" href={link.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                  {link.desc || link.url}
                </a>
              ))}
            </div>
          </>
        )}

        </div>{/* end prompt-card-body */}

        {/* Publish request status badge */}
        {myRequest?.status === 'approved' && (
          <div className="card-request-badge approved" title="Publish request approved">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="11" fill="#059669"/><path d="M6.5 11l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
        {myRequest?.status === 'rejected' && (
          <div className="card-request-badge rejected" title="Publish request rejected">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="11" fill="#DC2626"/><path d="M7 7l8 8M15 7l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
        )}

      </div>

      {/* Back face — edit form */}
      {flipped && canEdit && (
        <div className="prompt-card prompt-card-face prompt-card-back" onKeyDown={e => { if (e.key === 'Escape') setFlipped(false); }}>
          <CardEditBack
            prompt={p}
            catalog={catalog}
            lang={lang}
            onSave={handleEditSave}
            onCancel={() => setFlipped(false)}
            onDuplicate={target => { setFlipped(false); handleDuplicate(target); }}
            onDelete={canPublish || (p.isPrivate !== false && p.status === 'draft' && p.ownerId === profile?.id) ? handleDelete : undefined}
            dupeTarget={dupeTarget}
            setDupeTarget={setDupeTarget}
            canPublish={canPublish}
            canEdit={canEdit}
            approvedRequest={isApprovedRequest ? myRequest : null}
          />
        </div>
      )}

      {substItem && (
        <SubstituteModal
          text={substItem.body}
          lang={lang}
          onCopy={text => doCopy(text, substItem.item, true)}
          onClose={() => setSubstItem(null)}
        />
      )}
      {jouleModal && (
        <JouleSkillModal
          skillName={jouleModal.skillName}
          skillContent={jouleModal.skillContent}
          promptText={jouleModal.promptText}
          onClose={() => setJouleModal(null)}
        />
      )}
    </div>
  );
}
