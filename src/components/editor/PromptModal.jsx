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

export default function PromptModal() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { isModalOpen, editingPromptId, catalog, prompts } = state;
  const isNew = editingPromptId === undefined || editingPromptId === null;
  const existing = isNew ? null : prompts.find(p => p.id === editingPromptId);

  const [bodyTab, setBodyTab] = useState('en');
  const [title, setTitle] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyFr, setBodyFr] = useState('');
  const [storyFlow, setStoryFlow] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedSolutions, setSelectedSolutions] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [landscapes, setLandscapes] = useState([]);
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
      setBodyEn(existing.body || '');
      setBodyFr(existing.body_fr || '');
      setStoryFlow(existing.storyFlow || '');
      setIsFavorite(existing.isFavorite || false);
      setSelectedSolutions(existing.solutions || []);
      setTags(existing.tags || []);
      setLandscapes(existing.landscapes || []);
      setNotes(existing.notes || '');
      AttachmentsDB.getForPrompt(existing.id).then(atts => setExistingAtts(atts));
    } else {
      setTitle(''); setBodyEn(''); setBodyFr(''); setStoryFlow('');
      setIsFavorite(false); setSelectedSolutions([]); setTags([]);
      setLandscapes([]); setNotes(''); setExistingAtts([]); setPendingFiles([]);
    }
    setPendingDeletes([]); setPendingFiles([]); setErrors({});
  }, [editingPromptId]);

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
    if (!bodyEn.trim()) { setErrors({ body: 'Prompt body (EN) is required' }); return; }
    setSaving(true);

    const promptId = existing?.id || crypto.randomUUID();

    // Save pending attachment files to IndexedDB first
    const savedNewAtts = [];
    for (const f of pendingFiles) {
      const attId = crypto.randomUUID();
      await AttachmentsDB.save({ id: attId, promptId, name: f.name, type: f.type, size: f.size, data: f.data });
      savedNewAtts.push({ id: attId, name: f.name, type: f.type, size: f.size });
    }
    // Delete removed attachments
    for (const attId of pendingDeletes) {
      await AttachmentsDB.delete(attId);
    }

    const attachmentsMeta = [
      ...existingAtts.filter(a => !pendingDeletes.includes(a.id)).map(a => ({ id: a.id, name: a.name, type: a.type, size: a.size })),
      ...savedNewAtts,
    ];

    await StorageAPI.upsertPrompt({
      id: promptId,
      title: title.trim(),
      body: bodyEn.trim(),
      body_fr: bodyFr.trim() || null,
      storyFlow,
      solutions: selectedSolutions,
      tags,
      landscapes: landscapes.filter(l => l.trim()),
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

  const activeBody = bodyTab === 'en' ? bodyEn : bodyFr;

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

          {/* Body EN/FR */}
          <div className="field-row">
            <div className="body-tabs">
              <button className={`body-tab${bodyTab === 'en' ? ' active-tab' : ''}`} onClick={() => setBodyTab('en')}>EN</button>
              <button className={`body-tab${bodyTab === 'fr' ? ' active-tab' : ''}`} onClick={() => setBodyTab('fr')}>FR</button>
              <span className="body-tab-hint">EN is required · FR is optional</span>
            </div>
            {bodyTab === 'en' ? (
              <textarea value={bodyEn} onChange={e => setBodyEn(e.target.value)} placeholder="The full prompt text that will be copied to clipboard…" rows={6} className={errors.body ? 'input-error' : ''} />
            ) : (
              <textarea value={bodyFr} onChange={e => setBodyFr(e.target.value)} placeholder="Le texte complet du prompt qui sera copié dans le presse-papier…" rows={6} />
            )}
            <span className="char-count">{activeBody.length} chars</span>
            {errors.body && <span className="field-error">{errors.body}</span>}
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
            <label>Landscapes <span className="hint">(tenant URLs / system names)</span></label>
            {landscapes.map((ls, i) => (
              <div key={i} className="landscape-row">
                <input
                  type="text"
                  value={ls}
                  onChange={e => setLandscapes(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder="https://tenant.example.com"
                  list="landscape-datalist"
                />
                <button className="row-remove-btn" onClick={() => setLandscapes(prev => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <datalist id="landscape-datalist">
              {catalog.landscapes.map(ls => <option key={ls} value={ls} />)}
            </datalist>
            <button type="button" className="add-row-btn" onClick={() => setLandscapes(prev => [...prev, ''])}>+ Add Landscape</button>
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
