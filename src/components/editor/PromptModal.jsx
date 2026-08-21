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
  const [itemTabs, setItemTabs] = useState({}); // { [itemId]: 'en' | 'fr' }
  const [storyFlow, setStoryFlow] = useState('');
  const [category, setCategory] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedSolutions, setSelectedSolutions] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [landscapes, setLandscapes] = useState([]); // [{ name, url }]
  const [notes, setNotes] = useState('');
  const [mcpCredentials, setMcpCredentials] = useState([]); // [{ id, label, clientId, clientSecret, showSecret }]
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
      // Migrate legacy single body to promptItems
      const items = existing.promptItems?.length
        ? existing.promptItems
        : [makeItem(existing.body || '', existing.body_fr || '')];
      setPromptItems(items);
      setItemTabs({});
      setStoryFlow(existing.storyFlow || '');
      setCategory(existing.category || '');
      setIsFavorite(existing.isFavorite || false);
      setSelectedSolutions(existing.solutions || []);
      setTags(existing.tags || []);
      // Migrate legacy string landscapes to objects
      const lss = (existing.landscapes || []).map(ls =>
        typeof ls === 'string' ? { name: ls, url: ls.startsWith('http') ? ls : '' } : ls
      );
      setLandscapes(lss);
      setNotes(existing.notes || '');
      // Migrate legacy single mcpClientId/mcpClientSecret to array
      if (existing.mcpCredentials?.length) {
        setMcpCredentials(existing.mcpCredentials.map(c => ({ ...c, showSecret: false })));
      } else if (existing.mcpClientId) {
        setMcpCredentials([{ id: crypto.randomUUID(), label: '', clientId: existing.mcpClientId, clientSecret: existing.mcpClientSecret || '', showSecret: false }]);
      } else {
        setMcpCredentials([]);
      }
      AttachmentsDB.getForPrompt(existing.id).then(atts => setExistingAtts(atts));
    } else {
      setTitle('');
      setPromptItems([makeItem()]);
      setItemTabs({});
      setStoryFlow('');
      setCategory('');
      setIsFavorite(false);
      setSelectedSolutions([]);
      setTags([]);
      setLandscapes([]);
      setNotes('');
      setMcpCredentials([]);
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
    if (!title.trim()) { setErrors({ title: 'Title is required' }); return; }
    const validItems = promptItems.filter(item => item.body.trim());
    if (validItems.length === 0) { setErrors({ body: 'At least one prompt body is required' }); return; }
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
      // Keep legacy fields in sync with first item for export compat
      body: finalItems[0]?.body || '',
      body_fr: finalItems[0]?.body_fr || null,
      promptItems: finalItems,
      category: category || null,
      storyFlow,
      solutions: selectedSolutions,
      tags,
      landscapes: landscapes.filter(ls => ls.name.trim() || ls.url.trim()),
      notes: notes.trim(),
      mcpCredentials: mcpCredentials
        .filter(c => c.clientId.trim() || c.clientSecret.trim())
        .map(({ id, label, clientId, clientSecret }) => ({ id, label, clientId: clientId.trim(), clientSecret: clientSecret.trim() })),
      // Keep legacy fields for backwards compat (first credential)
      mcpClientId: mcpCredentials[0]?.clientId.trim() || null,
      mcpClientSecret: mcpCredentials[0]?.clientSecret.trim() || null,
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
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Short display name…" maxLength={120} className={errors.title ? 'input-error' : ''} />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          {/* Prompt Items */}
          <div className="field-row">
            <label>Prompt Bodies <span className="req">*</span> <span className="hint">(one Copy button per prompt)</span></label>
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
                        placeholder="Label (optional, e.g. 'Step 1')…"
                      />
                      {promptItems.length > 1 && (
                        <button className="prompt-item-delete-btn" title="Remove this prompt" onClick={() => removeItem(item.id)}>✕</button>
                      )}
                    </div>
                    <div className="body-tabs">
                      <button className={`body-tab${tab === 'en' ? ' active-tab' : ''}`} onClick={() => setItemTab(item.id, 'en')}>EN</button>
                      <button className={`body-tab${tab === 'fr' ? ' active-tab' : ''}`} onClick={() => setItemTab(item.id, 'fr')}>FR</button>
                      <span className="body-tab-hint">EN is required · FR is optional</span>
                    </div>
                    {tab === 'en' ? (
                      <textarea
                        value={item.body}
                        onChange={e => updateItem(item.id, 'body', e.target.value)}
                        placeholder="The full prompt text that will be copied to clipboard…"
                        rows={5}
                      />
                    ) : (
                      <textarea
                        value={item.body_fr || ''}
                        onChange={e => updateItem(item.id, 'body_fr', e.target.value)}
                        placeholder="Le texte complet du prompt qui sera copié dans le presse-papier…"
                        rows={5}
                      />
                    )}
                    <span className="char-count">{activeBody.length} chars</span>
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
              <label>Story Flow</label>
              <select value={storyFlow} onChange={e => setStoryFlow(e.target.value)}>
                <option value="">— Select —</option>
                {catalog.storyFlows.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="field-col">
              <label>Favorite</label>
              <label className="toggle-label">
                <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)} />
                <span> Mark as Favorite ★</span>
              </label>
            </div>
          </div>

          {/* Solutions */}
          <div className="field-row">
            <label>Solutions</label>
            <div className="checkbox-group">
              {catalog.solutions.map(sol => (
                <label key={sol} className="checkbox-label">
                  <input type="checkbox" checked={selectedSolutions.includes(sol)} onChange={() => toggleSolution(sol)} />
                  <span>{sol}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="field-row">
            <label>Tags <span className="hint">(press Enter to add)</span></label>
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
                placeholder={tags.length === 0 ? 'Add a tag…' : ''}
              />
            </div>
          </div>

          {/* Landscapes */}
          <div className="field-row">
            <label>Landscapes <span className="hint">(name + system URL)</span></label>
            {/* Catalog picker */}
            {catalog.landscapes.length > 0 && (
              <div className="catalog-picker">
                {catalog.landscapes.map((ls, i) => {
                  const selected = landscapes.some(l => l.name === ls.name && l.url === ls.url);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`catalog-chip${selected ? ' selected' : ''}`}
                      onClick={() => {
                        if (selected) {
                          setLandscapes(prev => prev.filter(l => !(l.name === ls.name && l.url === ls.url)));
                        } else {
                          setLandscapes(prev => [...prev, { name: ls.name, url: ls.url }]);
                        }
                      }}
                    >
                      {selected ? '✓ ' : ''}{ls.name || ls.url}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Custom rows for overrides or new entries not in catalog */}
            {landscapes.filter(ls => !catalog.landscapes.some(cl => cl.name === ls.name && cl.url === ls.url)).map((ls, i) => {
              const realIdx = landscapes.indexOf(ls);
              return (
                <div key={realIdx} className="landscape-row-2col">
                  <input
                    type="text"
                    value={ls.name}
                    onChange={e => setLandscapes(prev => prev.map((v, j) => j === realIdx ? { ...v, name: e.target.value } : v))}
                    placeholder="Display name (e.g. DEV, PROD)…"
                  />
                  <input
                    type="text"
                    value={ls.url}
                    onChange={e => setLandscapes(prev => prev.map((v, j) => j === realIdx ? { ...v, url: e.target.value } : v))}
                    placeholder="https://tenant.example.com"
                  />
                  <button className="row-remove-btn" onClick={() => setLandscapes(prev => prev.filter((_, j) => j !== realIdx))}>×</button>
                </div>
              );
            })}
            <button type="button" className="add-row-btn" onClick={() => setLandscapes(prev => [...prev, { name: '', url: '' }])}>+ Add Custom Landscape</button>
          </div>

          {/* MCP Credentials */}
          <div className="field-row mcp-section">
            <label>{t('mcpCredentials', lang)} <span className="hint">{t('mcpOptional', lang)}</span></label>
            {/* Catalog picker */}
            {catalog.mcpCredentials?.length > 0 && (
              <div className="catalog-picker">
                {catalog.mcpCredentials.map(cat => {
                  const selected = mcpCredentials.some(c => c.id === cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`catalog-chip${selected ? ' selected' : ''}`}
                      onClick={() => {
                        if (selected) {
                          setMcpCredentials(prev => prev.filter(c => c.id !== cat.id));
                        } else {
                          setMcpCredentials(prev => [...prev, { ...cat, showSecret: false }]);
                        }
                      }}
                    >
                      {selected ? '✓ ' : ''}🔑 {cat.label || cat.clientId}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Custom / inline credentials not from catalog */}
            {mcpCredentials.filter(c => !catalog.mcpCredentials?.some(cat => cat.id === c.id)).map((cred, i) => {
              const realIdx = mcpCredentials.indexOf(cred);
              return (
                <div key={cred.id} className="mcp-credential-row">
                  <input
                    type="text"
                    className="mcp-label-input"
                    value={cred.label}
                    onChange={e => setMcpCredentials(prev => prev.map((c, j) => j === realIdx ? { ...c, label: e.target.value } : c))}
                    placeholder="Label (e.g. DEV, PROD)…"
                  />
                  <div className="mcp-fields">
                    <input
                      type="text"
                      value={cred.clientId}
                      onChange={e => setMcpCredentials(prev => prev.map((c, j) => j === realIdx ? { ...c, clientId: e.target.value } : c))}
                      placeholder={t('mcpClientId', lang) + '…'}
                    />
                    <div className="mcp-secret-row">
                      <input
                        type={cred.showSecret ? 'text' : 'password'}
                        value={cred.clientSecret}
                        onChange={e => setMcpCredentials(prev => prev.map((c, j) => j === realIdx ? { ...c, clientSecret: e.target.value } : c))}
                        placeholder={t('mcpClientSecret', lang) + '…'}
                      />
                      <button
                        type="button"
                        className="mcp-eye-btn"
                        title={cred.showSecret ? 'Hide' : 'Show'}
                        onClick={() => setMcpCredentials(prev => prev.map((c, j) => j === realIdx ? { ...c, showSecret: !c.showSecret } : c))}
                      >{cred.showSecret ? '🙈' : '👁'}</button>
                    </div>
                  </div>
                  <button
                    className="row-remove-btn"
                    onClick={() => setMcpCredentials(prev => prev.filter((_, j) => j !== realIdx))}
                  >×</button>
                </div>
              );
            })}
            <button
              type="button"
              className="add-row-btn"
              onClick={() => setMcpCredentials(prev => [...prev, { id: crypto.randomUUID(), label: '', clientId: '', clientSecret: '', showSecret: false }])}
            >+ Add Custom Credential</button>
          </div>

          {/* Notes */}
          <div className="field-row">
            <label>Notes <span className="hint">(internal, not copied)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Demo tips, context notes…" rows={3} />
          </div>

          {/* Attachments */}
          <div className="field-row">
            <label>Attachments <span className="hint">(files / ZIP — stored locally)</span></label>
            <div
              ref={dropRef}
              className="attach-drop-zone"
              onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('drag-over'); }}
              onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
              onDrop={handleDrop}
            >
              <span className="attach-drop-hint">
                Drop files here or{' '}
                <button type="button" className="attach-browse-link" onClick={() => fileInputRef.current?.click()}>browse</button>
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
          <button className="action-btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : t('save', lang)}</button>
        </div>
      </div>
    </div>
  );
}
