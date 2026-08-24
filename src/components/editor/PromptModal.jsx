import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { t } from '../../lib/i18n.js';
import JouleDiamond from '../shared/JouleDiamond.jsx';

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function makeItem(body = '', body_fr = '') {
  return { id: crypto.randomUUID(), label: '', body, body_fr };
}

export default function PromptModal() {
  const { state, dispatch } = useApp();
  const { isEditor, isAdmin, profile } = useAuth();
  const canPublish = isEditor || isAdmin;
  const lang = state.settings?.lang || 'en';
  const { isModalOpen, editingPromptId, catalog, prompts } = state;
  const isNew = editingPromptId === undefined || editingPromptId === null;
  const existing = isNew ? null : prompts.find(p => p.id === editingPromptId);
  const isOwner = !existing || existing.ownerId === profile?.id;
  const canEdit = canPublish || isOwner;

  // Publish request state (same logic as PromptCard)
  const myRequest = existing ? state.publishRequests?.find(r => r.prompt_id === existing.id) : null;
  const isApprovedRequest = myRequest?.status === 'approved';
  const isPendingRequest = myRequest?.status === 'pending';

  const [activeTab, setActiveTab] = useState('content');
  const [title, setTitle] = useState('');
  const [promptItems, setPromptItems] = useState([makeItem()]);
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [itemTabs, setItemTabs] = useState({});
  const [storyFlow, setStoryFlow] = useState('');
  const [category, setCategory] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedSolutions, setSelectedSolutions] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [systems, setSystems] = useState([]);
  const [demoLinks, setDemoLinks] = useState([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('draft');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existingAtts, setExistingAtts] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const dropRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setActiveTab('content');
    setActiveItemIdx(0);
    if (existing) {
      setTitle(existing.title || '');
      const items = existing.promptItems?.length
        ? existing.promptItems
        : [makeItem(existing.body || '', existing.body_fr || '')];
      setPromptItems(items);
      setItemTabs({});
      setStoryFlow(existing.storyFlow || '');
      setCategory(existing.category || '');
      setIsFavorite(existing.isFavorite || false);
      setSelectedSolutions(existing.solutions || []);
      setPersonas(existing.personas || []);
      setTags(existing.tags || []);
      const savedSystems = existing.systems || [];
      if (savedSystems.length) {
        setSystems(savedSystems);
      } else {
        const legacySystems = [];
        for (const ls of (existing.landscapes || [])) {
          const name = typeof ls === 'string' ? ls : (ls.name || ls.url || '');
          const url  = typeof ls === 'string' ? (ls.startsWith('http') ? ls : '') : (ls.url || '');
          legacySystems.push({ id: crypto.randomUUID(), name, description: '', url, endpoints: [] });
        }
        const legacyMcp = existing.mcpCredentials?.length
          ? existing.mcpCredentials
          : existing.mcpClientId
            ? [{ id: crypto.randomUUID(), label: '', clientId: existing.mcpClientId, clientSecret: existing.mcpClientSecret || '', url: '' }]
            : [];
        for (const c of legacyMcp) {
          legacySystems.push({
            id: c.id || crypto.randomUUID(),
            name: c.label || c.clientId || 'MCP',
            description: '',
            url: c.url || '',
            endpoints: [{ id: crypto.randomUUID(), label: c.label || '', url: c.url || '', clientId: c.clientId || '', clientSecret: c.clientSecret || '' }],
          });
        }
        setSystems(legacySystems);
      }
      setNotes(existing.notes || '');
      setStatus(existing.status || 'draft');
      setIsPrivate(existing.isPrivate ?? true);
      setDemoLinks(Array.isArray(existing.demoLinks) ? existing.demoLinks.map(l => ({ ...l })) : []);
      AttachmentsDB.getForPrompt(existing.id).then(atts => {
        const meta = existing.attachments || [];
        setExistingAtts(atts.map(a => {
          const m = meta.find(x => x.id === a.id);
          return m?.isJouleSkill ? { ...a, isJouleSkill: true } : a;
        }));
      });
    } else {
      setTitle('');
      setPromptItems([makeItem()]);
      setItemTabs({});
      setStoryFlow('');
      setCategory('');
      setIsFavorite(false);
      setSelectedSolutions([]);
      setPersonas([]);
      setTags([]);
      setSystems([]);
      setDemoLinks([]);
      setNotes('');
      setStatus('draft');
      setIsPrivate(true);
      setExistingAtts([]);
      setPendingFiles([]);
    }
    setPendingDeletes([]); setPendingFiles([]); setErrors({});
  }, [editingPromptId, isModalOpen]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') dispatch({ type: 'CLOSE_MODAL' });
    }
    if (isModalOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isModalOpen, dispatch]);

  function toggleSolution(sol) {
    setSelectedSolutions(prev =>
      prev.includes(sol) ? prev.filter(s => s !== sol) : [...prev, sol]
    );
  }

  function handleTagKey(e) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const v = tagInput.trim().replace(/^#/, '');
      if (v && !tags.includes(v)) setTags(prev => [...prev, v]);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  }

  function updateItem(id, field, value) {
    setPromptItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id) {
    setPromptItems(prev => {
      const next = prev.filter(item => item.id !== id);
      setActiveItemIdx(i => Math.min(i, next.length - 1));
      return next;
    });
  }

  function getItemTab(id) {
    return itemTabs[id] || 'en';
  }

  function setItemTab(id, tab) {
    setItemTabs(prev => ({ ...prev, [id]: tab }));
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

  function handleDrop(e) {
    e.preventDefault();
    dropRef.current?.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  }

  async function downloadExisting(att) {
    const record = await AttachmentsDB.get(att.id);
    if (!record) return;
    const blob = new Blob([record.data], { type: record.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = att.name; a.click();
    URL.revokeObjectURL(url);
  }

  function handleDelete() {
    dispatch({ type: 'CLOSE_MODAL' });
    dispatch({ type: 'OPEN_CONFIRM', payload: existing.id });
  }

  async function handlePublishRequest() {
    if (!existing) return;
    try {
      if (isPendingRequest) {
        await StorageAPI.deletePublishRequest(existing.id);
      } else {
        await StorageAPI.createPublishRequest(existing.id);
      }
      const reqs = await StorageAPI.getPublishRequests();
      dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: reqs });
      dispatch({ type: 'SHOW_TOAST', payload: isPendingRequest ? 'Request cancelled' : t('publishRequestSent', lang) });
      dispatch({ type: 'CLOSE_MODAL' });
    } catch (err) {
      dispatch({ type: 'SHOW_TOAST', payload: `Error: ${err.message}` });
    }
  }

  async function handleSave() {
    if (!title.trim()) { setErrors({ title: t('titleRequired', lang) }); return; }
    const validItems = promptItems.filter(item => item.body.trim());
    if (validItems.length === 0) { setErrors({ body: t('bodyRequired', lang) }); return; }
    setSaving(true);

    const promptId = existing?.id || crypto.randomUUID();
    const savedNewAtts = [];
    for (const f of pendingFiles) {
      const attId = crypto.randomUUID();
      await AttachmentsDB.save({ id: attId, promptId, name: f.name, type: f.type, size: f.size, data: f.data });
      savedNewAtts.push({ id: attId, name: f.name, type: f.type, size: f.size, isJouleSkill: f.isJouleSkill || false });
    }
    for (const attId of pendingDeletes) {
      await AttachmentsDB.delete(attId);
    }

    const attachmentsMeta = [
      ...existingAtts.filter(a => !pendingDeletes.includes(a.id)).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size, isJouleSkill: a.isJouleSkill || false })),
      ...savedNewAtts,
    ];

    const finalItems = validItems.map((item, idx) => ({
      ...item,
      label: item.label.trim() || (validItems.length === 1 ? title.trim() : `Part ${idx + 1}`),
      body: item.body.trim(),
      body_fr: item.body_fr?.trim() || null,
    }));

    await StorageAPI.upsertPrompt({
      id: promptId,
      title: title.trim(),
      body: finalItems[0]?.body || '',
      body_fr: finalItems[0]?.body_fr || null,
      promptItems: finalItems,
      category: category || null,
      storyFlow,
      solutions: selectedSolutions,
      personas,
      tags,
      systems,
      demoLinks: demoLinks.filter(l => {
        const u = l.url.trim();
        return u && /^https?:\/\//i.test(u);
      }),
      notes: notes.trim(),
      status: status || null,
      isFavorite,
      isPrivate,
      usageCount: existing?.usageCount || 0,
      lastUsedAt: existing?.lastUsedAt || null,
      attachments: attachmentsMeta,
    });

    const updatedPrompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: updatedPrompts });
    dispatch({ type: 'SHOW_TOAST', payload: isNew ? t('promptCreated', lang) : t('promptUpdated', lang) });
    dispatch({ type: 'CLOSE_MODAL' });
    setSaving(false);
  }

  if (!isModalOpen) return null;

  const activeItem = promptItems[activeItemIdx] || promptItems[0];
  const itemLang = activeItem ? getItemTab(activeItem.id) : 'en';

  return (
    <div id="modal-backdrop" onClick={e => { if (e.target.id === 'modal-backdrop') dispatch({ type: 'CLOSE_MODAL' }); }}>
      <div id="modal">
        <div id="modal-header">
          <h2 id="modal-title">{isNew ? t('newPrompt', lang) : t('edit', lang)}</h2>
          {/* Tabs */}
          <div className="modal-tabs">
            <button className={`modal-tab${activeTab === 'content' ? ' active' : ''}`} onClick={() => setActiveTab('content')}>Content</button>
            <button className={`modal-tab${activeTab === 'details' ? ' active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
          </div>
          <button className="modal-close-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div id="modal-body">

          {/* ── CONTENT TAB ─────────────────────────────────────── */}
          {activeTab === 'content' && <>

            {/* Title */}
            <div className="field-row">
              <label>Title <span className="req">*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder', lang)} maxLength={120} className={errors.title ? 'input-error' : ''} />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            {/* Personas */}
            <div className="field-row">
              <label>{t('personasLabel', lang)}</label>
              {(catalog.personas || []).length > 0 ? (
                <div className="catalog-picker">
                  {catalog.personas.map(persona => {
                    const selected = personas.includes(persona);
                    return (
                      <button key={persona} type="button" className={`catalog-chip${selected ? ' selected' : ''}`}
                        onClick={() => setPersonas(prev => selected ? prev.filter(x => x !== persona) : [...prev, persona])}>
                        {persona}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="hint" style={{ fontSize: 12, margin: '4px 0 0' }}>{t('noPersonasYet', lang)}</p>
              )}
            </div>

            {/* Notes */}
            <div className="field-row">
              <label>{t('notes', lang)} <span className="hint">({t('notesHintModal', lang)})</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('notesPlaceholder', lang)} rows={2} />
            </div>

            {/* Prompt Items — card-style tabs */}
            <div className="field-row">
              <label>{t('promptBodiesLabel', lang)} <span className="req">*</span></label>
              {errors.body && <span className="field-error">{errors.body}</span>}

              {/* Item selector tabs */}
              <div className="modal-item-tabs">
                {promptItems.map((item, idx) => (
                  <button
                    key={item.id}
                    className={`modal-item-tab${activeItemIdx === idx ? ' active' : ''}`}
                    onClick={() => setActiveItemIdx(idx)}
                  >
                    {item.label.trim() || `#${idx + 1}`}
                  </button>
                ))}
                <button className="modal-item-tab modal-item-tab-add" onClick={() => {
                  setPromptItems(prev => [...prev, makeItem()]);
                  setActiveItemIdx(promptItems.length);
                }}>+</button>
                {promptItems.length > 1 && (
                  <button className="modal-item-tab modal-item-tab-del" onClick={() => removeItem(activeItem.id)}>−</button>
                )}
              </div>

              {/* Active item editor */}
              {activeItem && (
                <div className="modal-item-editor">
                  <input
                    type="text"
                    className="modal-item-label-input"
                    value={activeItem.label}
                    onChange={e => updateItem(activeItem.id, 'label', e.target.value)}
                    placeholder={t('promptItemLabel', lang)}
                  />
                  {/* EN / FR lang tabs */}
                  <div className="modal-lang-tabs">
                    <button className={`modal-lang-btn${itemLang === 'en' ? ' active' : ''}`} onClick={() => setItemTab(activeItem.id, 'en')}>EN</button>
                    <button className={`modal-lang-btn${itemLang === 'fr' ? ' active' : ''}`} onClick={() => setItemTab(activeItem.id, 'fr')}>FR</button>
                  </div>
                  {itemLang === 'en' ? (
                    <textarea value={activeItem.body} onChange={e => updateItem(activeItem.id, 'body', e.target.value)}
                      placeholder={t('bodyEnPlaceholder', lang)} rows={7} />
                  ) : (
                    <textarea value={activeItem.body_fr || ''} onChange={e => updateItem(activeItem.id, 'body_fr', e.target.value)}
                      placeholder={t('bodyFrPlaceholder', lang)} rows={7} />
                  )}
                  <span className="char-count">{t('charCount', lang, (itemLang === 'en' ? activeItem.body : activeItem.body_fr || '').length)}</span>
                </div>
              )}
            </div>
          </>}

          {/* ── DETAILS TAB ─────────────────────────────────────── */}
          {activeTab === 'details' && <>

            {/* Category + Flow */}
            <div className="field-row-2col">
              <div className="field-col">
                <label>{t('category', lang)}</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">— {t('noCategory', lang)} —</option>
                  {(catalog.categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="field-col">
                <label>{t('storyFlow', lang)}</label>
                <select value={storyFlow} onChange={e => setStoryFlow(e.target.value)}>
                  <option value="">{t('selectFlowNone', lang)}</option>
                  {catalog.storyFlows.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Solutions */}
            <div className="field-row">
              <label>{t('solutionsLabel', lang)}</label>
              <div className="checkbox-group">
                {catalog.solutions.map(sol => (
                  <label key={sol} className="checkbox-label">
                    <input type="checkbox" checked={selectedSolutions.includes(sol)} onChange={() => toggleSolution(sol)} />
                    <span>{sol}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status + Favorite */}
            <div className="field-row-2col">
              <div className="field-col">
                <label>Status</label>
                <div className="card-status-btns">
                  {(canPublish ? ['', 'draft', 'published'] : ['draft']).map(s => (
                    <button key={s} type="button"
                      className={`card-status-btn${s ? ` status-opt-${s}` : ''}${status === s ? ' active' : ''}`}
                      onClick={() => setStatus(s)} disabled={!canPublish && s !== 'draft'}>
                      {s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-col">
                <label>{t('favLabel', lang)}</label>
                <label className="toggle-label">
                  <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)} />
                  <span> {t('markFav', lang)}</span>
                </label>
              </div>
            </div>

            {/* Visibility */}
            {canEdit && (
              <div className="field-row">
                <label>{t('visibilityLabel', lang) || 'Visibility'}</label>
                <div className="card-privacy-btns">
                  <button type="button"
                    className={`card-privacy-btn${isPrivate !== false ? ' active private' : ''}`}
                    onClick={() => setIsPrivate(true)}>
                    {t('visibilityPrivate', lang)}
                  </button>
                  <button type="button"
                    className={`card-privacy-btn${isPrivate === false ? ' active shared' : ''}`}
                    onClick={() => setIsPrivate(false)}>
                    {t('visibilityPublic', lang)}
                  </button>
                </div>
              </div>
            )}

            {/* Demo Links */}
            <div className="field-row">
              <label>{t('demoLinksLabel', lang)}</label>
              {demoLinks.map((link, idx) => (
                <div key={link.id} className="demo-link-row">
                  <input type="text" value={link.desc || ''} onChange={e => setDemoLinks(prev => prev.map((l, i) => i === idx ? { ...l, desc: e.target.value } : l))}
                    placeholder={t('demoLinkDescPlaceholder', lang)} className="demo-link-desc" />
                  <input type="url" value={link.url} onChange={e => setDemoLinks(prev => prev.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                    placeholder={t('demoLinkUrlPlaceholder', lang)} className="demo-link-url" />
                  <button type="button" className="attach-remove-btn" onClick={() => setDemoLinks(prev => prev.filter((_, i) => i !== idx))}>×</button>
                </div>
              ))}
              <button type="button" className="add-row-btn"
                onClick={() => setDemoLinks(prev => [...prev, { id: crypto.randomUUID(), url: '', desc: '' }])}>
                {t('addDemoLink', lang)}
              </button>
            </div>

            {/* Systems */}
            <div className="field-row">
              <label>{t('systems', lang)}</label>
              {(catalog.systems || []).length > 0 ? (
                <div className="catalog-picker">
                  {catalog.systems.map(sys => {
                    const selected = systems.some(s => s.id === sys.id);
                    return (
                      <button key={sys.id} type="button" className={`catalog-chip${selected ? ' selected' : ''}`}
                        onClick={() => selected ? setSystems(prev => prev.filter(s => s.id !== sys.id)) : setSystems(prev => [...prev, sys])}>
                        {selected ? '· ' : ''}{sys.name || sys.url}
                        {sys.endpoints?.length > 0 && <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 10 }}>cred</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="field-hint-text">{t('noSystemsYet', lang)}</p>
              )}
            </div>

            {/* Tags */}
            <div className="field-row" style={{ position: 'relative' }}>
              <label>{t('tagsLabel', lang)} <span className="hint">({t('tagHint', lang)})</span></label>
              <div className="tag-input-wrap">
                {tags.map(tag => (
                  <span key={tag} className="tag-chip">
                    #{tag}
                    <button className="tag-remove" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>×</button>
                  </span>
                ))}
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setTagInput(''); return; } handleTagKey(e); }}
                  placeholder={tags.length === 0 ? t('tagPlaceholder', lang) : ''} />
              </div>
              {tagInput.trim() && (() => {
                const allTags = [...new Set([...(catalog.tags || []), ...prompts.flatMap(p => p.tags || [])])].sort();
                const q = tagInput.trim().replace(/^#/, '').toLowerCase();
                const suggestions = allTags.filter(t => t.toLowerCase().includes(q) && !tags.includes(t));
                return suggestions.length > 0 ? (
                  <div className="tag-suggestions">
                    {suggestions.map(s => (
                      <button key={s} type="button" className="tag-suggestion-item"
                        onMouseDown={e => { e.preventDefault(); setTags(prev => [...prev, s]); setTagInput(''); }}>#{s}</button>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            {/* Attachments */}
            <div className="field-row">
              <label>{t('attachments', lang)} <span className="hint">({t('attHint', lang)})</span></label>
              <div ref={dropRef} className="attach-drop-zone"
                onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
                onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
                onDrop={handleDrop}>
                <span className="attach-drop-hint">
                  {t('dropHere', lang)}{' '}
                  <button type="button" className="attach-browse-link" onClick={() => fileInputRef.current?.click()}>{t('browse', lang)}</button>
                </span>
                <input type="file" ref={fileInputRef} multiple style={{ display:'none' }} onChange={e => addFiles(e.target.files)} />
              </div>
              <div className="attach-list">
                {existingAtts.filter(a => !pendingDeletes.includes(a.id)).map(a => (
                  <div key={a.id} className="attach-row">
                    <button className="attach-name-btn" onClick={() => downloadExisting(a)}>{a.name}</button>
                    <span className="attach-size">{fmtSize(a.size)}</span>
                    <button
                      type="button"
                      className={`card-edit-att-joule${a.isJouleSkill ? ' active' : ''}`}
                      title={a.isJouleSkill ? 'Unmark as Joule Skill' : 'Mark as Joule Skill'}
                      onClick={() => setExistingAtts(prev => prev.map(x => x.id === a.id ? { ...x, isJouleSkill: !x.isJouleSkill } : x))}
                    ><JouleDiamond size={13} /></button>
                    <button className="attach-remove-btn" onClick={() => setPendingDeletes(prev => [...prev, a.id])}>×</button>
                  </div>
                ))}
                {pendingFiles.map(f => (
                  <div key={f._tempId} className="attach-row pending">
                    <span className="attach-name">{f.name}</span>
                    <span className="attach-size">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      className={`card-edit-att-joule${f.isJouleSkill ? ' active' : ''}`}
                      title={f.isJouleSkill ? 'Unmark as Joule Skill' : 'Mark as Joule Skill'}
                      onClick={() => setPendingFiles(prev => prev.map(x => x._tempId === f._tempId ? { ...x, isJouleSkill: !x.isJouleSkill } : x))}
                    ><JouleDiamond size={13} /></button>
                    <button className="attach-remove-btn" onClick={() => setPendingFiles(prev => prev.filter(x => x._tempId !== f._tempId))}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </>}
        </div>

        <div id="modal-footer">
          {/* Delete: canPublish OR viewer's own private draft */}
          {!isNew && (canPublish || (isOwner && existing?.isPrivate !== false && existing?.status === 'draft')) && (
            <button className="card-edit-del-btn" onClick={handleDelete}>
              {t('del', lang) || 'Delete'}
            </button>
          )}
          {/* Publish request: viewer, own draft, public visibility, not yet approved */}
          {!isNew && !canPublish && isOwner && existing?.status === 'draft' && isPrivate === false && !isApprovedRequest && (
            <button className="card-request-btn" onClick={handlePublishRequest}>
              {isPendingRequest ? 'Cancel request' : t('requestPublish', lang) || 'Request publish'}
            </button>
          )}
          {canEdit && <button className="card-edit-save-btn" onClick={handleSave} disabled={saving}>{saving ? t('savingLabel', lang) : t('save', lang)}</button>}
          {canEdit && <button className="card-edit-cancel-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>{t('cancel', lang)}</button>}
          {!canEdit && <button className="card-edit-cancel-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>Close</button>}
        </div>
      </div>
    </div>
  );
}
