import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI, uploadSkillFile, deleteSkillFile } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { t, tl } from '../../lib/i18n.js';
import JouleDiamond from '../shared/JouleDiamond.jsx';

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function makeItem(body = '', body_fr = '') {
  return { id: crypto.randomUUID(), label: '', label_fr: '', body, body_fr };
}

function MultiSelectDropdown({ options, selected, onChange, placeholder, lang = 'en' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);
  // Normalize options to { value, label } — value is always the EN key
  const normalized = options.map(o => typeof o === 'object' ? { value: o.en, label: tl(o, lang) } : { value: o, label: o });
  function toggle(val) {
    onChange(selected.includes(val) ? selected.filter(x => x !== val) : [...selected, val]);
  }
  const label = selected.length === 0 ? placeholder
    : selected.length === 1 ? (normalized.find(o => o.value === selected[0])?.label ?? selected[0]) : `${selected.length} selected`;
  return (
    <div className="ms-dropdown" ref={ref}>
      <button type="button" className={`ms-trigger${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
        <span className={selected.length === 0 ? 'ms-placeholder' : 'ms-value'}>{label}</span>
        <span className="ms-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="ms-menu">
          {normalized.map(({ value, label: lbl }) => {
            const isSel = selected.includes(value);
            return (
              <label key={value} className={`ms-option${isSel ? ' ms-selected' : ''}`}>
                <input type="checkbox" checked={isSel} onChange={() => toggle(value)} />
                {lbl}
              </label>
            );
          })}
          {normalized.length === 0 && <div className="ms-empty">No options</div>}
        </div>
      )}
      {selected.length > 0 && (
        <div className="card-edit-selected-pills">
          {selected.map(val => (
            <span key={val} className="card-edit-sys-chip selected">
              · {normalized.find(o => o.value === val)?.label ?? val}
              <button type="button" className="card-edit-tag-del" onClick={() => onChange(selected.filter(x => x !== val))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({ options, value, onChange, placeholder, lang = 'en' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);
  const normalized = options.map(o => typeof o === 'object' ? { value: o.en, label: tl(o, lang) } : { value: o, label: o });
  const displayLabel = normalized.find(o => o.value === value)?.label ?? value ?? '';
  return (
    <div className="ms-dropdown" ref={ref}>
      <button type="button" className={`ms-trigger${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
        <span className={!value ? 'ms-placeholder' : 'ms-value'}>{displayLabel || placeholder}</span>
        <span className="ms-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="ms-menu">
          <label className={`ms-option${!value ? ' ms-selected' : ''}`} onClick={() => { onChange(''); setOpen(false); }}>
            <span style={{ opacity: 0.5 }}>{placeholder}</span>
          </label>
          {normalized.map(({ value: v, label: lbl }) => (
            <label key={v} className={`ms-option${value === v ? ' ms-selected' : ''}`} onClick={() => { onChange(v); setOpen(false); }}>
              {lbl}
            </label>
          ))}
          {normalized.length === 0 && <div className="ms-empty">No options</div>}
        </div>
      )}
    </div>
  );
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

  const myRequest = existing ? state.publishRequests?.find(r => r.prompt_id === existing.id) : null;
  const isApprovedRequest = myRequest?.status === 'approved';
  const isPendingRequest = myRequest?.status === 'pending';

  const [activeTab, setActiveTab] = useState('content');
  const [historyNames, setHistoryNames] = useState({});

  useEffect(() => {
    if (!existing) return;
    const ids = [existing.ownerId, existing.updatedById].filter(Boolean);
    if (ids.length) StorageAPI.getProfileNames(ids).then(setHistoryNames);
  }, [existing?.id]);
  const [title, setTitle] = useState('');
  const [promptItems, setPromptItems] = useState([makeItem()]);
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [itemTabs, setItemTabs] = useState({});
  const [storyFlow, setStoryFlow] = useState('');
  const [category, setCategory] = useState('');
  const [assistant, setAssistant] = useState('');
  const [industry, setIndustry] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedSolutions, setSelectedSolutions] = useState([]);
  const [personas, setPersonas] = useState([]);
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
      setAssistant(existing.assistant || '');
      setIndustry(existing.industry || '');
      setIsFavorite(existing.isFavorite || false);
      setSelectedSolutions(existing.solutions || []);
      setPersonas(existing.personas || []);
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
          return m ? { ...a, isJouleSkill: m.isJouleSkill || false, skill_url: m.skill_url || null } : a;
        }));
      });
    } else {
      setTitle('');
      setPromptItems([makeItem()]);
      setItemTabs({});
      setStoryFlow('');
      setCategory('');
      setAssistant('');
      setIndustry('');
      setIsFavorite(false);
      setSelectedSolutions([]);
      setPersonas([]);
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

  function getItemTab(id) { return itemTabs[id] || 'en'; }
  function setItemTab(id, tab) { setItemTabs(prev => ({ ...prev, [id]: tab })); }

  function addFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        setPendingFiles(prev => [...prev, {
          _tempId: crypto.randomUUID(),
          name: file.name, type: file.type, size: file.size, data: ev.target.result,
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
      const att = existingAtts.find(a => a.id === attId);
      if (att?.skill_url) {
        try { await deleteSkillFile(promptId, attId, att.name); } catch (e) { console.error('Skill delete failed:', e); }
      }
    }
    for (const att of savedNewAtts) {
      if (!att.isJouleSkill) continue;
      const fileObj = pendingFiles.find(f => f.name === att.name);
      if (fileObj?.data) {
        try { att.skill_url = await uploadSkillFile(promptId, att.id, att.name, fileObj.data); }
        catch (e) { console.error('Skill upload failed:', e); dispatch({ type: 'SHOW_TOAST', payload: `Skill upload failed: ${e.message}` }); }
      }
    }
    for (const att of existingAtts) {
      if (!att.isJouleSkill || att.skill_url || pendingDeletes.includes(att.id)) continue;
      const stored = await AttachmentsDB.get(att.id);
      if (stored?.data) {
        try { att.skill_url = await uploadSkillFile(promptId, att.id, att.name, stored.data); }
        catch (e) { console.error('Skill upload failed:', e); }
      }
    }

    const attachmentsMeta = [
      ...existingAtts.filter(a => !pendingDeletes.includes(a.id)).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size, isJouleSkill: a.isJouleSkill || false, skill_url: a.skill_url || null })),
      ...savedNewAtts,
    ];

    const finalItems = validItems.map((item, idx) => ({
      ...item,
      label: item.label.trim() || (validItems.length === 1 ? title.trim() : `Part ${idx + 1}`),
      label_fr: item.label_fr?.trim() || null,
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
      assistant: assistant || null,
      industry: industry || null,
      solutions: selectedSolutions,
      personas,
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
  const filteredAssistants = (catalog.assistants || []).filter(a => !a.domain || a.domain === category || !category);

  return (
    <div id="modal-backdrop" onClick={e => { if (e.target.id === 'modal-backdrop') dispatch({ type: 'CLOSE_MODAL' }); }}>
      <div id="modal">
        <div id="modal-header">
          <h2 id="modal-title">{isNew ? t('newPrompt', lang) : t('edit', lang)}</h2>
          <div className="modal-tabs">
            <button className={`modal-tab${activeTab === 'content' ? ' active' : ''}`} onClick={() => setActiveTab('content')}>{t('tabContent', lang)}</button>
            <button className={`modal-tab${activeTab === 'details' ? ' active' : ''}`} onClick={() => setActiveTab('details')}>{t('tabDetails', lang)}</button>
            {!isNew && <button className={`modal-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>{t('tabHistory', lang)}</button>}
          </div>
          {canEdit && (
            <div className="modal-header-visibility tb-display-seg">
              <button type="button" className={`tb-display-seg-btn${isPrivate !== false ? ' active' : ''}`} onClick={() => setIsPrivate(true)}>
                {t('visibilityPrivate', lang)}
              </button>
              <button type="button" className={`tb-display-seg-btn${isPrivate === false ? ' active' : ''}`} onClick={() => setIsPrivate(false)}>
                {t('visibilityPublic', lang)}
              </button>
            </div>
          )}
          <button className="modal-close-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div id="modal-body">

          {/* ── CONTENT TAB ─────────────────────────────────────── */}
          {activeTab === 'content' && <>

            <div className="field-row">
              <label>Title <span className="req">*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder', lang)} maxLength={120} className={errors.title ? 'input-error' : ''} />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>

            {filteredAssistants.length > 0 && (
              <div className="field-row">
                <label>{t('aiAssistantLabel', lang)}</label>
                <SingleSelectDropdown
                  options={[...filteredAssistants].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).map(a => a.name)}
                  value={assistant}
                  onChange={setAssistant}
                  placeholder={t('selectNone', lang)}
                />
              </div>
            )}

            <div className="field-row">
              <label>{t('personasLabel', lang)}</label>
              {(catalog.personas || []).length > 0 ? (
                <MultiSelectDropdown
                  options={catalog.personas || []}
                  selected={personas}
                  onChange={setPersonas}
                  placeholder={t('selectPersonas', lang)}
                  lang={lang}
                />
              ) : (
                <p className="hint" style={{ fontSize: 12, margin: '4px 0 0' }}>{t('noPersonasYet', lang)}</p>
              )}
            </div>

            <div className="field-row">
              <label>{t('notes', lang)} <span className="hint">({t('notesHintModal', lang)})</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('notesPlaceholder', lang)} rows={2} />
            </div>

            <div className="field-row">
              <label>{t('promptBodiesLabel', lang)} <span className="req">*</span></label>
              {errors.body && <span className="field-error">{errors.body}</span>}
              <div className="modal-item-tabs">
                {promptItems.map((item, idx) => (
                  <button key={item.id} className={`modal-item-tab${activeItemIdx === idx ? ' active' : ''}`} onClick={() => setActiveItemIdx(idx)}>
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
              {activeItem && (
                <div className="modal-item-editor">
                  <div className="modal-lang-tabs">
                    <button className={`modal-lang-btn${itemLang === 'en' ? ' active' : ''}`} onClick={() => setItemTab(activeItem.id, 'en')}>EN</button>
                    <button className={`modal-lang-btn${itemLang === 'fr' ? ' active' : ''}`} onClick={() => setItemTab(activeItem.id, 'fr')}>FR</button>
                  </div>
                  <input type="text" className="modal-item-label-input"
                    value={itemLang === 'en' ? activeItem.label : (activeItem.label_fr || '')}
                    onChange={e => updateItem(activeItem.id, itemLang === 'en' ? 'label' : 'label_fr', e.target.value)}
                    placeholder={itemLang === 'en' ? t('promptItemLabel', lang) : (t('promptItemLabel', lang) + ' (FR)')} />
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

            {/* Status */}
            <div className="field-row">
              <label>{t('statusLabel', lang)}</label>
              {canPublish ? (
                <div className={`status-seg ${status || 'draft'}`}>
                  {['draft', 'published', 'archived'].map(s => (
                    <button key={s} type="button" className="status-seg-btn" onClick={() => setStatus(s)}>
                      {t(`status${s.charAt(0).toUpperCase() + s.slice(1)}`, lang)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="status-seg draft status-seg-readonly">
                  <button type="button" className="status-seg-btn" disabled>
                    {t('statusDraft', lang)}
                  </button>
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
                <SingleSelectDropdown
                  options={[...(catalog.categories || [])].sort((a, b) => (typeof a === 'object' ? a.en : a).localeCompare(typeof b === 'object' ? b.en : b, undefined, { sensitivity: 'base' }))}
                  value={category}
                  onChange={v => { setCategory(v); setAssistant(''); }}
                  placeholder={`— ${t('noCategory', lang)} —`}
                  lang={lang}
                />
              </div>
              <div className="field-col">
                <label>{t('storyFlow', lang)}</label>
                <SingleSelectDropdown
                  options={[...(catalog.storyFlows || [])].sort((a, b) => (typeof a === 'object' ? a.en : a).localeCompare(typeof b === 'object' ? b.en : b, undefined, { sensitivity: 'base' }))}
                  value={storyFlow}
                  onChange={setStoryFlow}
                  placeholder={t('selectFlowNone', lang)}
                  lang={lang}
                />
              </div>
            </div>

            {/* Industry */}
            {(catalog.industries || []).length > 0 && (
              <div className="field-row">
                <label>{t('industryLabel', lang)}</label>
                <SingleSelectDropdown
                  options={[...(catalog.industries || [])].sort((a, b) => (typeof a === 'object' ? a.en : a).localeCompare(typeof b === 'object' ? b.en : b, undefined, { sensitivity: 'base' }))}
                  value={industry}
                  onChange={setIndustry}
                  placeholder={t('selectNone', lang)}
                  lang={lang}
                />
              </div>
            )}

            {/* Solutions */}
            {((catalog.solutions || []).length > 0 || selectedSolutions.length > 0) && (
              <div className="field-row">
                <label>{t('solutionsLabel', lang)}</label>
                <MultiSelectDropdown
                  options={catalog.solutions || []}
                  selected={selectedSolutions}
                  onChange={setSelectedSolutions}
                  placeholder={t('selectSolutions', lang)}
                  lang={lang}
                />
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
                    <button type="button" className={`card-edit-att-joule${a.isJouleSkill ? ' active' : ''}`}
                      title={a.isJouleSkill ? 'Unmark as Joule Skill' : 'Mark as Joule Skill'}
                      onClick={() => {
                        if (!a.isJouleSkill) {
                          setExistingAtts(prev => prev.map(x => ({ ...x, isJouleSkill: x.id === a.id })));
                          setPendingFiles(prev => prev.map(x => ({ ...x, isJouleSkill: false })));
                        } else {
                          setExistingAtts(prev => prev.map(x => x.id === a.id ? { ...x, isJouleSkill: false } : x));
                        }
                      }}><JouleDiamond size={13} /></button>
                    <button className="attach-remove-btn" onClick={() => setPendingDeletes(prev => [...prev, a.id])}>×</button>
                  </div>
                ))}
                {pendingFiles.map(f => (
                  <div key={f._tempId} className="attach-row pending">
                    <span className="attach-name">{f.name}</span>
                    <span className="attach-size">{fmtSize(f.size)}</span>
                    <button type="button" className={`card-edit-att-joule${f.isJouleSkill ? ' active' : ''}`}
                      title={f.isJouleSkill ? 'Unmark as Joule Skill' : 'Mark as Joule Skill'}
                      onClick={() => {
                        if (!f.isJouleSkill) {
                          setExistingAtts(prev => prev.map(x => ({ ...x, isJouleSkill: false })));
                          setPendingFiles(prev => prev.map(x => ({ ...x, isJouleSkill: x._tempId === f._tempId })));
                        } else {
                          setPendingFiles(prev => prev.map(x => x._tempId === f._tempId ? { ...x, isJouleSkill: false } : x));
                        }
                      }}><JouleDiamond size={13} /></button>
                    <button className="attach-remove-btn" onClick={() => setPendingFiles(prev => prev.filter(x => x._tempId !== f._tempId))}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* ── HISTORY TAB ─────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="card-edit-body card-history-tab">
              <div className="card-history-row">
                <span className="card-history-label">{t('createdBy', lang)}</span>
                <span className="card-history-user">{historyNames[existing?.ownerId] || '—'}</span>
                {existing?.createdAt && (
                  <span className="card-history-date">{new Date(existing.createdAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                )}
              </div>
              {(existing?.updatedById || existing?.updatedAt) && (
                <div className="card-history-row">
                  <span className="card-history-label">{t('lastSavedBy', lang)}</span>
                  <span className="card-history-user">{existing?.updatedById ? (historyNames[existing.updatedById] || '…') : '—'}</span>
                  {existing?.updatedAt && (
                    <span className="card-history-date">{new Date(existing.updatedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div id="modal-footer">
          {!isNew && (canPublish || (isOwner && existing?.isPrivate !== false && existing?.status === 'draft')) && (
            <button className="card-edit-del-btn" onClick={handleDelete}>{t('del', lang)}</button>
          )}
          {!isNew && !canPublish && isOwner && existing?.status === 'draft' && isPrivate === false && !isApprovedRequest && (
            <button className="card-request-btn" onClick={handlePublishRequest}>
              {isPendingRequest ? t('cancelRequest', lang) : t('requestPublish', lang)}
            </button>
          )}
          {canEdit && <button className="card-edit-cancel-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>{t('cancel', lang)}</button>}
          {canEdit && <button className="card-edit-save-btn" onClick={handleSave} disabled={saving}>{saving ? t('savingLabel', lang) : t('save', lang)}</button>}
          {!canEdit && <button className="card-edit-cancel-btn" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>{t('close', lang)}</button>}
        </div>
      </div>
    </div>
  );
}
