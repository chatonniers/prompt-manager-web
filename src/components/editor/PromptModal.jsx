import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { t } from '../../lib/i18n.js';

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

function makeItem(body = '', body_fr = '') {
  return { id: crypto.randomUUID(), label: '', body, body_fr };
}

export default function PromptModal() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { isModalOpen, editingPromptId, catalog, prompts } = state;
  const isNew = editingPromptId === undefined || editingPromptId === null;
  const existing = isNew ? null : prompts.find(p => p.id === editingPromptId);

  const [title, setTitle] = useState('');
  const [promptItems, setPromptItems] = useState([makeItem()]);
  const [itemTabs, setItemTabs] = useState({});
  const [storyFlow, setStoryFlow] = useState('');
  const [category, setCategory] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedSolutions, setSelectedSolutions] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [systems, setSystems] = useState([]);
  const [demoLinks, setDemoLinks] = useState([]);
  const [notes, setNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existingAtts, setExistingAtts] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const dropRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
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
      // Migrate legacy landscapes + mcpCredentials into systems array
      const savedSystems = existing.systems || [];
      if (savedSystems.length) {
        setSystems(savedSystems);
      } else {
        // Build from legacy fields
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
      setDemoLinks(Array.isArray(existing.demoLinks) ? existing.demoLinks.map(l => ({ ...l })) : []);
      AttachmentsDB.getForPrompt(existing.id).then(atts => setExistingAtts(atts));
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
    setPromptItems(prev => prev.filter(item => item.id !== id));
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
      savedNewAtts.push({ id: attId, name: f.name, type: f.type, size: f.size });
    }
    for (const attId of pendingDeletes) {
      await AttachmentsDB.delete(attId);
    }

    const attachmentsMeta = [
      ...existingAtts.filter(a => !pendingDeletes.includes(a.id)).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
      ...savedNewAtts,
    ];

    const finalItems = promptItems
      .filter(item => item.body.trim())
      .map(item => ({ ...item, body: item.body.trim(), body_fr: item.body_fr?.trim() || null }));

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
      demoLinks: demoLinks.filter(l => l.url.trim()),
      notes: notes.trim(),
      isFavorite,
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

  return (
    <div id="modal-backdrop" onClick={e => { if (e.target.id === 'modal-backdrop') dispatch({ type: 'CLOSE_MODAL' }); }}>
      <div id="modal">
        <div id="modal-header">
          <h2 id="modal-title">{isNew ? t('newPrompt', lang) : t('edit', lang)}</h2>
          <button className="modal-close-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>✕</button>
        </div>
        <div id="modal-body">

          {/* Title */}
          <div className="field-row">
            <label>Title <span className="req">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder', lang)} maxLength={120} className={errors.title ? 'input-error' : ''} />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          {/* Prompt Items */}
          <div className="field-row">
            <label>{t('promptBodiesLabel', lang)} <span className="req">*</span> <span className="hint">({t('promptBodiesCopyHint', lang)})</span></label>
            {errors.body && <span className="field-error">{errors.body}</span>}
            <div className="prompt-items-editor">
              {promptItems.map((item, idx) => {
                const tab = getItemTab(item.id);
                const activeBody = tab === 'en' ? item.body : (item.body_fr || '');
                return (
                  <div key={item.id} className="prompt-item-editor">
                    <div className="prompt-item-editor-header">
                      <span className="prompt-item-editor-num">#{idx + 1}</span>
                      <input
                        type="text"
                        className="prompt-item-label-input"
                        value={item.label}
                        onChange={e => updateItem(item.id, 'label', e.target.value)}
                        placeholder={t('labelOptionalPlaceholder', lang)}
                      />
                      {promptItems.length > 1 && (
                        <button className="prompt-item-delete-btn" title={t('removePrompt', lang)} onClick={() => removeItem(item.id)}>✕</button>
                      )}
                    </div>
                    <div className="body-tabs">
                      <button className={`body-tab${tab === 'en' ? ' active-tab' : ''}`} onClick={() => setItemTab(item.id, 'en')}>EN</button>
                      <button className={`body-tab${tab === 'fr' ? ' active-tab' : ''}`} onClick={() => setItemTab(item.id, 'fr')}>FR</button>
                      <span className="body-tab-hint">{t('enRequired', lang)}</span>
                    </div>
                    {tab === 'en' ? (
                      <textarea
                        value={item.body}
                        onChange={e => updateItem(item.id, 'body', e.target.value)}
                        placeholder={t('bodyEnPlaceholder', lang)}
                        rows={5}
                      />
                    ) : (
                      <textarea
                        value={item.body_fr || ''}
                        onChange={e => updateItem(item.id, 'body_fr', e.target.value)}
                        placeholder={t('bodyFrPlaceholder', lang)}
                        rows={5}
                      />
                    )}
                    <span className="char-count">{t('charCount', lang, activeBody.length)}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="add-row-btn" onClick={() => setPromptItems(prev => [...prev, makeItem()])}>
              {t('addPromptItem', lang)}
            </button>
          </div>

          {/* Category + Story Flow + Favorite */}
          <div className="field-row">
            <label>{t('category', lang)}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— {t('noCategory', lang)} —</option>
              {(catalog.categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* Story Flow + Favorite */}
          <div className="field-row-2col">
            <div className="field-col">
              <label>{t('storyFlow', lang)}</label>
              <select value={storyFlow} onChange={e => setStoryFlow(e.target.value)}>
                <option value="">{t('selectFlowNone', lang)}</option>
                {catalog.storyFlows.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="field-col">
              <label>{t('favLabel', lang)}</label>
              <label className="toggle-label">
                <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)} />
                <span> {t('markFav', lang)}</span>
              </label>
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

          {/* Personas */}
          <div className="field-row">
            <label>{t('personasLabel', lang)}</label>
            {(catalog.personas || []).length > 0 ? (
              <div className="catalog-picker">
                {catalog.personas.map(persona => (
                  <button
                    key={persona}
                    type="button"
                    className={`catalog-chip${personas.includes(persona) ? ' selected' : ''}`}
                    onClick={() => setPersonas(prev =>
                      prev.includes(persona) ? prev.filter(x => x !== persona) : [...prev, persona]
                    )}
                  >
                    {personas.includes(persona) ? '✓ ' : ''}{persona}
                  </button>
                ))}
              </div>
            ) : (
              <p className="field-hint-text">{t('noPersonasYet', lang)}</p>
            )}
          </div>

          {/* Tags */}
          <div className="field-row">
            <label>{t('tagsLabel', lang)} <span className="hint">({t('tagHint', lang)})</span></label>
            <div className="tag-input-wrap">
              {tags.map(tag => (
                <span key={tag} className="tag-chip">
                  #{tag}
                  <button className="tag-remove" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>×</button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                placeholder={tags.length === 0 ? t('tagPlaceholder', lang) : ''}
              />
            </div>
          </div>

          {/* Systems */}
          <div className="field-row">
            <label>{t('systems', lang)} <span className="hint">({t('systemsHint', lang)})</span></label>
            {(catalog.systems || []).length > 0 ? (
              <div className="catalog-picker">
                {catalog.systems.map(sys => {
                  const selected = systems.some(s => s.id === sys.id);
                  return (
                    <button
                      key={sys.id}
                      type="button"
                      className={`catalog-chip${selected ? ' selected' : ''}`}
                      onClick={() => {
                        if (selected) {
                          setSystems(prev => prev.filter(s => s.id !== sys.id));
                        } else {
                          setSystems(prev => [...prev, sys]);
                        }
                      }}
                    >
                      {selected ? '✓ ' : ''}{sys.name || sys.url}
                      {sys.endpoints?.length > 0 && <span style={{ opacity: 0.7, marginLeft: 4 }}>🔑</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="field-hint-text">{t('noSystemsYet', lang)}</p>
            )}
          </div>

          {/* Demo Links */}
          <div className="field-row">
            <label>{t('demoLinksLabel', lang)}</label>
            {demoLinks.map((link, idx) => (
              <div key={link.id} className="demo-link-row">
                <input
                  type="text"
                  value={link.desc || ''}
                  onChange={e => setDemoLinks(prev => prev.map((l, i) => i === idx ? { ...l, desc: e.target.value } : l))}
                  placeholder={t('demoLinkDescPlaceholder', lang)}
                  className="demo-link-desc"
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={e => setDemoLinks(prev => prev.map((l, i) => i === idx ? { ...l, url: e.target.value } : l))}
                  placeholder={t('demoLinkUrlPlaceholder', lang)}
                  className="demo-link-url"
                />
                <button
                  type="button"
                  className="attach-remove-btn"
                  onClick={() => setDemoLinks(prev => prev.filter((_, i) => i !== idx))}
                >×</button>
              </div>
            ))}
            <button
              type="button"
              className="add-row-btn"
              onClick={() => setDemoLinks(prev => [...prev, { id: crypto.randomUUID(), url: '', desc: '' }])}
            >{t('addDemoLink', lang)}</button>
          </div>

          {/* Notes */}
          <div className="field-row">
            <label>{t('notes', lang)} <span className="hint">({t('notesHintModal', lang)})</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('notesPlaceholder', lang)} rows={3} />
          </div>

          {/* Attachments */}
          <div className="field-row">
            <label>{t('attachments', lang)} <span className="hint">({t('attHint', lang)})</span></label>
            <div
              ref={dropRef}
              className="attach-drop-zone"
              onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
              onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
              onDrop={handleDrop}
            >
              <span className="attach-drop-hint">
                {t('dropHere', lang)}{' '}
                <button type="button" className="attach-browse-link" onClick={() => fileInputRef.current?.click()}>{t('browse', lang)}</button>
              </span>
              <input type="file" ref={fileInputRef} multiple style={{ display:'none' }} onChange={e => addFiles(e.target.files)} />
            </div>
            <div className="attach-list">
              {existingAtts.filter(a => !pendingDeletes.includes(a.id)).map(a => (
                <div key={a.id} className="attach-row">
                  <span className="attach-icon">{fileIcon(a.type)}</span>
                  <button className="attach-name-btn" onClick={() => downloadExisting(a)}>{a.name}</button>
                  <span className="attach-size">{fmtSize(a.size)}</span>
                  <button className="attach-remove-btn" onClick={() => setPendingDeletes(prev => [...prev, a.id])}>×</button>
                </div>
              ))}
              {pendingFiles.map(f => (
                <div key={f._tempId} className="attach-row pending">
                  <span className="attach-icon">{fileIcon(f.type)}</span>
                  <span className="attach-name">{f.name}</span>
                  <span className="attach-size">{fmtSize(f.size)}</span>
                  <button className="attach-remove-btn" onClick={() => setPendingFiles(prev => prev.filter(x => x._tempId !== f._tempId))}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div id="modal-footer">
          <button className="action-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>{t('cancel', lang)}</button>
          <button className="action-btn primary" onClick={handleSave} disabled={saving}>{saving ? t('savingLabel', lang) : t('save', lang)}</button>
        </div>
      </div>
    </div>
  );
}
