import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { filterAndRank } from '../../lib/search.js';
import { t } from '../../lib/i18n.js';
import { getFlowColor } from '../../lib/flowColors.js';
import { extractVars } from '../../lib/substitution.js';
import SubstituteModal from '../shared/SubstituteModal.jsx';
import PromptCard from './PromptCard.jsx';
import EmptyState from './EmptyState.jsx';
import BulkActionBar from './BulkActionBar.jsx';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const REQ_ICONS = {
  pending:  { label: 'Pending',  color: '#D97706' },
  approved: { label: 'Approved', color: '#059669' },
  rejected: { label: 'Rejected', color: '#DC2626' },
};

function RowPreview({ p, mouseX, mouseY, lang }) {
  const pw = 380;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = mouseX + 16;
  if (left + pw > vw - 8) left = mouseX - pw - 16;
  let top = mouseY + 12;
  if (top + 320 > vh - 8) top = mouseY - 320;

  const items = p.promptItems?.length ? p.promptItems : [{ id: p.id, label: '', body: p.body || '', body_fr: p.body_fr || '' }];

  return createPortal(
    <div className="pt-row-preview" style={{ top: Math.max(8, top), left: Math.max(8, left) }}>
      <div className="pt-rp-title">{p.title}</div>
      {p.notes && <div className="pt-rp-notes">{p.notes}</div>}
      {items.map((item, idx) => {
        const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
        return (
          <div key={item.id || idx} className="pt-rp-item">
            {items.length > 1 && <div className="pt-rp-item-label">{item.label || `#${idx + 1}`}</div>}
            <div className="pt-rp-body">{body}</div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

function PromptTableRow({ p, selectedIds, onToggleSelect, onOpen, publishRequests, canEdit, lang, dispatch }) {
  const [activeItem, setActiveItem] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [substItem, setSubstItem] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const rowRef = useRef(null);
  const titleSpanRef = useRef(null);

  function handleMouseEnter(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
    hoverTimerRef.current = setTimeout(() => setHovered(true), 500);
  }
  function handleMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    setHovered(false);
  }

  const items = p.promptItems?.length ? p.promptItems : [{ id: p.id, label: '', body: p.body || '', body_fr: p.body_fr || '' }];
  const flowColor = p.storyFlow ? getFlowColor(p.storyFlow) : null;
  const req = (publishRequests || []).find(r => r.prompt_id === p.id);
  const reqInfo = req ? REQ_ICONS[req.status] : null;

  async function doCopy(text, item, idx) {
    await copyText(text);
    await StorageAPI.incrementUsage(p.id);
    const fresh = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: fresh });
    dispatch({ type: 'SHOW_TOAST', payload: t('copied', lang) });
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  async function handleCopy(idx) {
    const item = items[idx];
    const body = (lang === 'fr' && item.body_fr) ? item.body_fr : item.body;
    if (!body) return;
    const vars = extractVars(body);
    if (vars.length > 0) {
      setSubstItem({ item, body, idx });
      return;
    }
    await doCopy(body, item, idx);
  }

  return (
    <>
      <tr
        ref={rowRef}
        className={`pt-row${selectedIds?.has(p.id) ? ' pt-row-selected' : ''}${canEdit ? ' pt-row-clickable' : ''}`}
        onClick={() => canEdit && onOpen(p.id)}
      >
        <td className="pt-td pt-td-check" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={!!selectedIds?.has(p.id)} onChange={() => onToggleSelect(p.id)} />
        </td>

        {/* Title + copy tabs */}
        <td ref={titleSpanRef} className="pt-td pt-td-title-cell">
          <div className="pt-title-row">
            <span className="pt-title-text" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>{p.title}</span>
          </div>
          {/* Prompt item tabs */}
          <div className="pt-item-tabs">
            {items.map((item, idx) => {
              const label = item.label?.trim() || (items.length === 1 ? t('copy', lang) : `#${idx + 1}`);
              return (
                <button
                  key={item.id || idx}
                  className={`pt-item-tab${activeItem === idx ? ' active' : ''}${copiedIdx === idx ? ' copied' : ''}`}
                  onClick={e => { e.stopPropagation(); setActiveItem(idx); handleCopy(idx); }}
                  title={item.label?.trim() || `Copy prompt ${idx + 1}`}
                >
                  {copiedIdx === idx ? '✓' : label}
                </button>
              );
            })}
          </div>
        </td>

        <td className="pt-td">
          {p.status && <span className={`pill status-${p.status}`}>{p.status}</span>}
        </td>
        <td className="pt-td" style={{ textAlign: 'center' }}>
          {p.isPrivate
            ? <span title="Private" style={{ color: '#D97706', fontWeight: 700, fontSize: 11 }}>Private</span>
            : <span title="Public" style={{ color: '#059669', fontWeight: 700, fontSize: 11 }}>Public</span>}
        </td>
        <td className="pt-td" style={{ textAlign: 'center' }}>
          {reqInfo && <span style={{ color: reqInfo.color, fontWeight: 700, fontSize: 11 }}>{reqInfo.label}</span>}
        </td>
        <td className="pt-td pt-td-dim">{p.category || '—'}</td>
        <td className="pt-td">
          {p.storyFlow
            ? <span className="pill flow" style={flowColor ? { background: flowColor.bg, color: flowColor.text } : {}}>{p.storyFlow}</span>
            : <span className="pt-td-dim">—</span>}
        </td>
        <td className="pt-td pt-td-pills">
          {(p.solutions || []).slice(0, 3).map(s => <span key={s} className="pill">{s}</span>)}
          {(p.solutions || []).length > 3 && <span className="pt-more">+{p.solutions.length - 3}</span>}
        </td>
        <td className="pt-td pt-td-pills">
          {(p.tags || []).slice(0, 3).map(tag => <span key={tag} className="pill tag">#{tag}</span>)}
          {(p.tags || []).length > 3 && <span className="pt-more">+{p.tags.length - 3}</span>}
        </td>
        <td className="pt-td pt-td-num">{p.usageCount > 0 ? p.usageCount : '—'}</td>
        <td className="pt-td pt-td-dim">{relTime(p.updatedAt)}</td>
      </tr>
      {substItem && (
        <SubstituteModal
          text={substItem.body}
          lang={lang}
          onCopy={text => { doCopy(text, substItem.item, substItem.idx); setSubstItem(null); }}
          onClose={() => setSubstItem(null)}
        />
      )}
      {hovered && !substItem && <RowPreview p={p} mouseX={mousePos.x} mouseY={mousePos.y} lang={lang} />}
    </>
  );
}

function PromptTable({ prompts, selectedIds, onToggleSelect, onOpen, publishRequests, canEdit, lang, dispatch }) {
  const [sort, setSort] = useState({ col: 'title', dir: 1 });

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: -s.dir } : { col, dir: 1 });
  }

  const sorted = [...prompts].sort((a, b) => {
    let av, bv;
    if (sort.col === 'title')         { av = a.title || ''; bv = b.title || ''; }
    else if (sort.col === 'status')   { av = a.status || ''; bv = b.status || ''; }
    else if (sort.col === 'category') { av = a.category || ''; bv = b.category || ''; }
    else if (sort.col === 'flow')     { av = a.storyFlow || ''; bv = b.storyFlow || ''; }
    else if (sort.col === 'used')     { av = a.usageCount || 0; bv = b.usageCount || 0; return (bv - av) * sort.dir; }
    else if (sort.col === 'updated')  { av = a.updatedAt || ''; bv = b.updatedAt || ''; }
    else { av = ''; bv = ''; }
    return av.localeCompare(bv) * sort.dir;
  });

  function Th({ col, label }) {
    const active = sort.col === col;
    return (
      <th className={`pt-th${active ? ' pt-th-active' : ''}`} onClick={() => toggleSort(col)}>
        {label} {active ? (sort.dir === 1 ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div className="prompt-table-wrap">
      <table className="prompt-table">
        <thead>
          <tr>
            <th className="pt-th pt-th-check" />
            <Th col="title" label="Title / Copy" />
            <Th col="status" label="Status" />
            <th className="pt-th">Visibility</th>
            <th className="pt-th">Request</th>
            <Th col="category" label="Category" />
            <Th col="flow" label="Flow" />
            <th className="pt-th">Solutions</th>
            <th className="pt-th">Tags</th>
            <Th col="used" label="Used" />
            <Th col="updated" label="Updated" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <PromptTableRow
              key={p.id}
              p={p}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              publishRequests={publishRequests}
              canEdit={canEdit}
              lang={lang}
              dispatch={dispatch}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function applyViewFilter(prompts, view, filter, workspace, userId, canPublish, visibilityRules, role) {
  const roleKey = role === 'admin' ? 'admin' : role === 'editor' ? 'editor' : 'viewer';
  const wsRules = visibilityRules?.[roleKey]?.[workspace];

  if (wsRules) {
    prompts = prompts.filter(p => {
      if (!wsRules.statuses.includes(p.status)) return false;
      if (workspace === 'mine') return p.ownerId === userId;
      if (!wsRules.includePrivate && p.isPrivate) return false;
      return true;
    });
  } else {
    // fallback: legacy hardcoded logic
    if (workspace === 'mine') {
      prompts = prompts.filter(p => p.status === 'draft' && p.ownerId === userId);
    } else {
      prompts = prompts.filter(p =>
        p.status === 'published' ||
        (canPublish && p.status === 'draft' && p.isPrivate === false)
      );
    }
  }
  if (view === 'favorites') return prompts.filter(p => p.isFavorite);
  if (view === 'most-used') return [...prompts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).filter(p => p.usageCount > 0);
  if (view === 'flow') return prompts.filter(p => p.storyFlow === (filter?.storyFlow ?? filter));
  if (view === 'solution') return prompts.filter(p => p.solutions?.includes(filter?.solution ?? filter));
  if (view === 'category') return prompts.filter(p => p.category === filter?.category);
  return prompts;
}

function DropZone({ className, style, onDrop, children, blockRef }) {
  const [over, setOver] = useState(false);
  return (
    <div
      ref={blockRef}
      className={`${className} drop-zone${over ? ' dz-over' : ''}`}
      style={style}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); onDrop(e.dataTransfer.getData('promptId')); }}
    >
      {children}
    </div>
  );
}

function CategoryBlock({ label, catKey, prompts, storyFlows, lang, selectedIds, onToggleSelect, onDrop, hideLabel }) {
  const usedFlows = storyFlows.filter(f => prompts.some(p => p.storyFlow === f));
  const noFlow = prompts.filter(p => !p.storyFlow);
  const hasAnyFlow = usedFlows.length > 0;

  if (!hasAnyFlow) {
    return (
      <DropZone className="category-block" onDrop={id => onDrop(id, { category: catKey, storyFlow: null })}>
        {!hideLabel && <div className="grid-section-label">{label}<span className="section-count">{prompts.length}</span></div>}
        {prompts.length === 0
          ? <div className="category-block-empty-hint">Drop cards here</div>
          : <div className="category-flat-grid">
              {prompts.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
            </div>
        }
      </DropZone>
    );
  }

  const columns = [
    ...usedFlows.map(f => ({ key: f, label: f, prompts: prompts.filter(p => p.storyFlow === f) })),
    ...(noFlow.length > 0 ? [{ key: '__none__', label: '—', prompts: noFlow }] : []),
  ];

  return (
    <DropZone className="category-block" onDrop={id => onDrop(id, { category: catKey, storyFlow: null })}>
      {!hideLabel && <div className="grid-section-label">{label}<span className="section-count">{prompts.length}</span></div>}
      <div className="category-flow-columns">
        {columns.map(col => {
          const color = col.key !== '__none__' ? getFlowColor(col.label) : null;
          const flowName = col.key !== '__none__' ? col.label : null;
          return (
            <DropZone
              key={col.key}
              className="flow-column"
              onDrop={id => onDrop(id, { category: catKey, storyFlow: flowName })}
            >
              <div
                className="flow-column-label"
                style={color ? { borderLeftColor: color.border, background: color.bg, color: color.text } : {}}
              >
                {col.label}
              </div>
              {col.prompts.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
            </DropZone>
          );
        })}
      </div>
    </DropZone>
  );
}

function FavoritesRow({ favs, lang, selectedIds, onToggleSelect, onDrop, onHeightChange }) {
  const scrollRef = useRef(null);
  const blockRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!blockRef.current || !onHeightChange) return;
    const el = blockRef.current;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange]);

  function scroll(dir) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 400, behavior: 'smooth' });
  }

  return (
    <DropZone className="favs-block" onDrop={id => onDrop(id, { isFavorite: true })} blockRef={blockRef}>
      <div className="grid-section-label">
        {t('favorites', lang)}<span className="section-count">{favs.length}</span>
      </div>
      {favs.length > 0 ? (
        <div
          className="favs-row-wrap"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {hovered && (
            <button className="favs-nav favs-nav-left" onClick={() => scroll(-1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
          <div className="favs-row" ref={scrollRef}>
            {favs.map(p => (
              <div key={p.id} className="favs-row-item">
                <PromptCard prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />
              </div>
            ))}
          </div>
          {hovered && (
            <button className="favs-nav favs-nav-right" onClick={() => scroll(1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--pm-text3)', padding: '8px 2px', fontStyle: 'italic' }}>No favorites yet — drag a card here or click ★</p>
      )}
    </DropZone>
  );
}

export default function PromptGrid() {
  const { state, dispatch } = useApp();
  const { isAdmin, isEditor, profile } = useAuth();
  const canPublish = isAdmin || isEditor;
  const { prompts, currentView, currentFilter, searchQuery, sapContext, settings, catalog, selectedIds, draggingId, workspace, statusFilter, displayMode } = state;
  const lang = settings?.lang || 'en';
  const categories = catalog.categories || [];
  const storyFlows = catalog.storyFlows || [];
  const visibilityRules = catalog?.visibilityRules;
  const role = profile?.role || 'viewer';

  const publishRequests = state.publishRequests || [];
  let pool = applyViewFilter(prompts, currentView, currentFilter, workspace, profile?.id, canPublish, visibilityRules, role);
  if (statusFilter) {
    const REQ_STATUSES = new Set(['pending', 'approved', 'rejected']);
    if (REQ_STATUSES.has(statusFilter)) {
      const matchIds = new Set(publishRequests.filter(r => r.status === statusFilter).map(r => r.prompt_id));
      pool = pool.filter(p => matchIds.has(p.id));
    } else {
      pool = pool.filter(p => p.status === statusFilter);
    }
  }

  const showAll = currentView !== 'all' || !!searchQuery.trim();
  let ranked;
  if (searchQuery.trim()) {
    ranked = filterAndRank(pool, searchQuery, sapContext, true);
  } else {
    ranked = filterAndRank(pool, '', sapContext, showAll);
  }

  const visibleIds = ranked.map(p => p.id);

  function onToggleSelect(id) {
    dispatch({ type: 'TOGGLE_SELECT', payload: id });
  }

  const [activeTab, setActiveTab] = useState(null);
  const gridOuterRef = useRef(null);
  const dragTabRef = useRef(null);
  const [undoState, setUndoState] = useState(null); // { prev, countdown }
  const undoTimerRef = useRef(null);
  const undoIntervalRef = useRef(null);

  useEffect(() => {
    // Global dragend catches the case where the source card unmounts mid-drag
    // (tab switches during DnD), so onDragEnd on the card never fires.
    function onGlobalDragEnd() { dispatch({ type: 'SET_DRAGGING', payload: null }); }
    document.addEventListener('dragend', onGlobalDragEnd);
    return () => {
      document.removeEventListener('dragend', onGlobalDragEnd);
      clearTimeout(undoTimerRef.current);
      clearInterval(undoIntervalRef.current);
    };
  }, []);

  async function handleDrop(promptId, updates) {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;
    dispatch({ type: 'SET_DRAGGING', payload: null });

    const prev = { ...prompt };
    await StorageAPI.upsertPrompt({ ...prompt, ...updates });
    const [fresh, freshCatalog] = await Promise.all([
      StorageAPI.getAllPrompts(), StorageAPI.getCatalog()
    ]);
    dispatch({ type: 'SET_PROMPTS', payload: fresh });
    dispatch({ type: 'SET_CATALOG', payload: freshCatalog });

    // Start undo window
    clearTimeout(undoTimerRef.current);
    clearInterval(undoIntervalRef.current);
    setUndoState({ prev, countdown: 5 });
    undoIntervalRef.current = setInterval(() => {
      setUndoState(s => s ? { ...s, countdown: s.countdown - 1 } : null);
    }, 1000);
    undoTimerRef.current = setTimeout(() => {
      clearInterval(undoIntervalRef.current);
      setUndoState(null);
    }, 5000);
  }

  async function handleUndo() {
    if (!undoState) return;
    clearTimeout(undoTimerRef.current);
    clearInterval(undoIntervalRef.current);
    setUndoState(null);
    await StorageAPI.upsertPrompt(undoState.prev);
    const [fresh, freshCatalog] = await Promise.all([
      StorageAPI.getAllPrompts(), StorageAPI.getCatalog()
    ]);
    dispatch({ type: 'SET_PROMPTS', payload: fresh });
    dispatch({ type: 'SET_CATALOG', payload: freshCatalog });
  }

  if (ranked.length === 0) return <EmptyState />;

  // Viewers cannot edit in library mode
  const canEdit = canPublish || workspace === 'mine';

  if (displayMode === 'table') {
    return (
      <>
        <BulkActionBar visibleIds={visibleIds} />
        <PromptTable
          prompts={ranked}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onOpen={id => dispatch({ type: 'OPEN_EDIT', payload: id })}
          publishRequests={publishRequests}
          canEdit={canEdit}
          lang={lang}
          dispatch={dispatch}
        />
      </>
    );
  }

  if (currentView === 'all' && !searchQuery.trim() && !statusFilter) {
    const favs = ranked.filter(p => p.isFavorite);

    // Always include all catalog categories (even empty), plus uncategorized if any
    const allTabs = categories.map(cat => ({
      key: cat,
      label: cat,
      prompts: ranked.filter(p => p.category === cat),
    }));
    const uncategorized = ranked.filter(p => !p.isFavorite && !p.category);
    if (uncategorized.length > 0) {
      allTabs.push({ key: '__uncategorized__', label: t('noCategory', lang), prompts: uncategorized });
    }

    const tabKey = activeTab && allTabs.some(b => b.key === activeTab)
      ? activeTab
      : allTabs[0]?.key ?? null;
    const activeBlock = allTabs.find(b => b.key === tabKey);

    // Switch tab when dragging over a tab button — use a ref to debounce so
    // continuous dragOver doesn't re-trigger setActiveTab on every event.
    function handleTabDragOver(e, key) {
      e.preventDefault();
      if (dragTabRef.current === key) return;
      dragTabRef.current = key;
      if (draggingId) setActiveTab(key);
    }
    function handleTabDragLeave() {
      dragTabRef.current = null;
    }

    return (
      <>
        <BulkActionBar visibleIds={visibleIds} />
        {undoState && (
          <div className="dnd-undo-bar">
            <span>Card moved.</span>
            <button className="dnd-undo-btn" onClick={handleUndo}>
              Undo <span className="dnd-undo-countdown">{undoState.countdown}s</span>
            </button>
          </div>
        )}
        <div id="prompt-grid-outer" ref={gridOuterRef} className={draggingId ? 'is-drag-active' : ''}>
          <FavoritesRow
            favs={favs}
            lang={lang}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onDrop={handleDrop}
            onHeightChange={h => { if (gridOuterRef.current) gridOuterRef.current.style.setProperty('--favs-h', h + 'px'); }}
          />

          <div className="category-tabs-wrap" style={{ position: 'sticky', top: `var(--favs-h, 0px)`, zIndex: 19, background: 'var(--pm-bg)', paddingBottom: 4, marginBottom: 6 }}>
            <button
              className="category-tabs-nav nav-left"
              disabled={allTabs.findIndex(b => b.key === tabKey) === 0}
              onClick={() => {
                const i = allTabs.findIndex(b => b.key === tabKey);
                if (i > 0) setActiveTab(allTabs[i - 1].key);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            <div className="category-tabs">
              {allTabs.map(block => (
                <button
                  key={block.key}
                  className={`category-tab${tabKey === block.key ? ' category-tab-active' : ''}${block.prompts.length === 0 ? ' category-tab-empty' : ''}`}
                  onClick={() => setActiveTab(block.key)}
                  onDragEnter={() => { if (draggingId) { dragTabRef.current = block.key; setActiveTab(block.key); } }}
                  onDragOver={e => handleTabDragOver(e, block.key)}
                  onDragLeave={handleTabDragLeave}
                  onDrop={e => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('promptId');
                    if (id) handleDrop(id, {
                      category: block.key === '__uncategorized__' ? null : block.key,
                      storyFlow: null,
                    });
                  }}
                >
                  {block.label}
                  <span className="category-tab-count">{block.prompts.length}</span>
                </button>
              ))}
            </div>

            <button
              className="category-tabs-nav nav-right"
              disabled={allTabs.findIndex(b => b.key === tabKey) === allTabs.length - 1}
              onClick={() => {
                const i = allTabs.findIndex(b => b.key === tabKey);
                if (i < allTabs.length - 1) setActiveTab(allTabs[i + 1].key);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          {activeBlock && (
            <CategoryBlock
              key={activeBlock.key}
              catKey={activeBlock.key === '__uncategorized__' ? null : activeBlock.key}
              label={activeBlock.label}
              prompts={activeBlock.prompts}
              storyFlows={storyFlows}
              lang={lang}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onDrop={handleDrop}
              hideLabel
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <BulkActionBar visibleIds={visibleIds} />
      <div id="prompt-grid">
        {ranked.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
      </div>
    </>
  );
}
