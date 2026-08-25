import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { filterAndRank } from '../../lib/search.js';
import { t } from '../../lib/i18n.js';
import { getFlowColor } from '../../lib/flowColors.js';
import { ASSISTANT_COLORS as CATEGORY_COLORS } from '../../lib/assistantColors.js';
import { extractVars } from '../../lib/substitution.js';
import SubstituteModal from '../shared/SubstituteModal.jsx';
import JouleSkillModal from '../shared/JouleSkillModal.jsx';
import PromptCard from './PromptCard.jsx';
import JouleDiamond from '../shared/JouleDiamond.jsx';
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

function PromptTableRow({ p, selectedIds, onToggleSelect, onOpen, publishRequests, canEdit, canPublish, profile, workspace, lang, dispatch }) {
  const { state } = useApp();
  const { profile: authProfile } = useAuth();
  const [activeItem, setActiveItem] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [substItem, setSubstItem] = useState(null);
  const [jouleModal, setJouleModal] = useState(null);
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

  const isOwner = p.ownerId === profile?.id;
  const rowCanEdit = canPublish || (workspace === 'mine' && isOwner);

  // Publish request button: same logic as PromptCard
  const isPendingRequest = req?.status === 'pending';
  const isApprovedRequest = req?.status === 'approved';
  const showRequestBtn = workspace === 'mine' && !canPublish && isOwner
    && p.status === 'draft' && p.isPrivate === false && !isApprovedRequest;

  async function doCopy(text, item, idx) {
    await copyText(text);
    await StorageAPI.incrementUsage(p.id);
    const fresh = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: fresh });
    const jouleAtt = (p.attachments || []).find(a => a.isJouleSkill);
    const jouleWillHandle = jouleAtt && authProfile?.joule_integration && authProfile?.joule_connected && p.status === 'published';
    if (!jouleWillHandle) {
      dispatch({ type: 'SHOW_TOAST', payload: t('copied', lang) });
    }
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
    // If Joule integration is enabled and this prompt has a Joule skill attachment
    if (jouleAtt && authProfile?.joule_integration && authProfile?.joule_connected) {
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
        setJouleModal({ skillName: null, skillContent: null, promptText: text });
      }
    }
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

  async function handleToggleFav(e) {
    e.stopPropagation();
    const updated = { ...p, isFavorite: !p.isFavorite };
    await StorageAPI.upsertPrompt(updated);
    const fresh = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: fresh });
  }

  async function handlePublishRequest(e) {
    e.stopPropagation();
    if (isPendingRequest) {
      await StorageAPI.deletePublishRequest(p.id);
    } else {
      await StorageAPI.createPublishRequest(p.id);
    }
    const fresh = await StorageAPI.getPublishRequests().catch(() => []);
    dispatch({ type: 'SET_PUBLISH_REQUESTS', payload: fresh });
  }

  return (
    <>
      <tr
        ref={rowRef}
        className={`pt-row${selectedIds?.has(p.id) ? ' pt-row-selected' : ''}${rowCanEdit ? ' pt-row-clickable' : ''}`}
        onClick={() => rowCanEdit && onOpen(p.id)}
      >
        <td className="pt-td pt-td-check" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={!!selectedIds?.has(p.id)} onChange={() => onToggleSelect(p.id)} />
        </td>

        {/* Title + copy tabs */}
        <td ref={titleSpanRef} className="pt-td pt-td-title-cell" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div className="pt-title-row">
            <span className="pt-title-text">{p.title}</span>
            {(p.attachments || []).some(a => a.isJouleSkill) && (
              <span className="pt-joule-badge" title="Joule Skill"><JouleDiamond size={12} /></span>
            )}
            <button
              className={`pt-fav-btn${p.isFavorite ? ' active' : ''}`}
              onClick={handleToggleFav}
              title={p.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {p.isFavorite ? '★' : '☆'}
            </button>
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
          {showRequestBtn && (
            <button
              className="card-request-btn"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={handlePublishRequest}
            >
              {isPendingRequest ? 'Cancel' : t('requestPublish', lang)}
            </button>
          )}
        </td>
        <td className="pt-td pt-td-dim">{p.category || '—'}</td>
        <td className="pt-td">
          {p.storyFlow
            ? <span className="pill flow" style={flowColor ? { background: flowColor.bg, color: flowColor.text } : {}}>{p.storyFlow}</span>
            : <span className="pt-td-dim">—</span>}
        </td>
        <td className="pt-td">
          {p.assistant
            ? <span className="pill assistant-pill">{p.assistant}</span>
            : <span className="pt-td-dim">—</span>}
        </td>
        <td className="pt-td pt-td-pills">
          {(p.solutions || []).slice(0, 3).map(s => <span key={s} className="pill">{s}</span>)}
          {(p.solutions || []).length > 3 && <span className="pt-more">+{p.solutions.length - 3}</span>}
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
      {jouleModal && (
        <JouleSkillModal
          skillName={jouleModal.skillName}
          skillContent={jouleModal.skillContent}
          promptText={jouleModal.promptText}
          onClose={() => setJouleModal(null)}
        />
      )}
      {hovered && !substItem && <RowPreview p={p} mouseX={mousePos.x} mouseY={mousePos.y} lang={lang} />}
    </>
  );
}

function PromptTable({ prompts, selectedIds, onToggleSelect, onOpen, publishRequests, canEdit, canPublish, profile, workspace, lang, dispatch }) {
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
    else if (sort.col === 'assistant') { av = a.assistant || ''; bv = b.assistant || ''; }
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
            <Th col="assistant" label="Assistant" />
            <th className="pt-th">Solutions</th>
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
              canPublish={canPublish}
              profile={profile}
              workspace={workspace}
              lang={lang}
              dispatch={dispatch}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function applyViewFilter(prompts, view, filter, workspace, userId, canPublish, visibilityRules, role, statusFilter) {
  const roleKey = role === 'admin' ? 'admin' : role === 'editor' ? 'editor' : 'viewer';
  const wsRules = visibilityRules?.[roleKey]?.[workspace];

  if (wsRules) {
    prompts = prompts.filter(p => {
      // When explicitly filtering for archived, bypass saved status rules for editors/admins
      if (statusFilter === 'archived' && canPublish) {
        if (p.status !== 'archived') return false;
      } else {
        if (!wsRules.statuses.includes(p.status)) return false;
      }
      if (!wsRules.includePrivate && p.isPrivate) return false;
      if (workspace === 'mine') return p.ownerId === userId;
      return true;
    });
  } else {
    // visibilityRules not yet loaded — show nothing until catalog is ready
    return [];
  }
  if (view === 'favorites') return prompts.filter(p => p.isFavorite);
  if (view === 'most-used') return [...prompts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).filter(p => p.usageCount > 0);
  if (view === 'flow') return prompts.filter(p => p.storyFlow === (filter?.storyFlow ?? filter));
  if (view === 'solution') return prompts.filter(p => p.solutions?.includes(filter?.solution ?? filter));
  if (view === 'assistant') return prompts.filter(p => p.assistant === filter?.assistant);
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

function CategoryBlock({ label, catKey, prompts, storyFlows, lang, selectedIds, onToggleSelect, onDrop, hideLabel, groupingMode, assistants }) {
  const effectiveMode = groupingMode || 'flow';
  const scrollRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  function scroll(dir) {
    scrollRef.current?.scrollBy({ left: dir * 420, behavior: 'smooth' });
  }

  let columns;
  if (effectiveMode === 'assistant') {
    const domainAssistants = (assistants || []).filter(a => !a.domain || a.domain === catKey);
    const usedAssistants = domainAssistants.filter(a => prompts.some(p => p.assistant === a.name));
    const noAssistant = prompts.filter(p => !p.assistant);
    columns = [
      ...usedAssistants.map(a => {
        const globalIdx = (assistants || []).findIndex(x => x.id === a.id);
        return { key: a.id, label: a.name, prompts: prompts.filter(p => p.assistant === a.name), isAssistant: true, colorIdx: globalIdx >= 0 ? globalIdx : 0 };
      }),
      ...(noAssistant.length > 0 ? [{ key: '__none__', label: '—', prompts: noAssistant, isAssistant: false }] : []),
    ];
  } else {
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
    columns = [
      ...usedFlows.map(f => ({ key: f, label: f, prompts: prompts.filter(p => p.storyFlow === f), isFlow: true })),
      ...(noFlow.length > 0 ? [{ key: '__none__', label: '—', prompts: noFlow, isFlow: false }] : []),
    ];
  }

  return (
    <DropZone className="category-block" onDrop={id => onDrop(id, { category: catKey, storyFlow: null })}>
      {!hideLabel && <div className="grid-section-label">{label}<span className="section-count">{prompts.length}</span></div>}
      <div
        className="category-columns-wrap"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hovered && (
          <button className="favs-nav favs-nav-left" onClick={() => scroll(-1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <div className="category-flow-columns" ref={scrollRef}>
          {columns.map(col => {
            const isAssistantCol = effectiveMode === 'assistant' && col.isAssistant;
            const assistantColor = isAssistantCol ? CATEGORY_COLORS[col.colorIdx % CATEGORY_COLORS.length] : null;
            const color = (!isAssistantCol && col.key !== '__none__') ? getFlowColor(col.label) : null;
            const dropTarget = effectiveMode === 'assistant'
              ? { category: catKey }
              : { category: catKey, storyFlow: col.key !== '__none__' ? col.label : null };
            return (
              <DropZone
                key={col.key}
                className="flow-column"
                onDrop={id => onDrop(id, dropTarget)}
              >
                <div
                  className="flow-column-label"
                  style={
                    isAssistantCol
                      ? { borderLeftColor: assistantColor.border, background: assistantColor.bg, color: assistantColor.text }
                      : (color ? { borderLeftColor: color.border, background: color.bg, color: color.text } : {})
                  }
                >
                  {col.label}
                </div>
                {col.prompts.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
              </DropZone>
            );
          })}
        </div>
        {hovered && (
          <button className="favs-nav favs-nav-right" onClick={() => scroll(1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>
    </DropZone>
  );
}

function FavoritesRow({ favs, lang, selectedIds, onToggleSelect, onDrop, onHeightChange }) {
  const scrollRef = useRef(null);
  const blockRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pm-favs-collapsed') === 'true');

  function toggleCollapse() {
    setCollapsed(v => {
      const next = !v;
      localStorage.setItem('pm-favs-collapsed', next);
      return next;
    });
  }

  useEffect(() => {
    if (!blockRef.current || !onHeightChange) return;
    const el = blockRef.current;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, collapsed]);

  function scroll(dir) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 400, behavior: 'smooth' });
  }

  return (
    <DropZone className="favs-block" onDrop={id => onDrop(id, { isFavorite: true })} blockRef={blockRef}>
      <div className="grid-section-label favs-section-label" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={toggleCollapse}>
        <span className="favs-collapse-chevron" style={{ marginRight: 5, fontSize: 10, opacity: 0.6, transition: 'transform 0.15s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
        {t('favorites', lang)}<span className="section-count">{favs.length}</span>
      </div>
      {!collapsed && (favs.length > 0 ? (
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
                <PromptCard prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} compact />
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
      ))}
    </DropZone>
  );
}

export default function PromptGrid() {
  const { state, dispatch } = useApp();
  const { isAdmin, isEditor, profile } = useAuth();
  const canPublish = isAdmin || isEditor;
  const { prompts, currentView, currentFilter, searchQuery, sapContext, settings, catalog, selectedIds, draggingId, workspace, statusFilter, displayMode, groupingMode } = state;
  const lang = settings?.lang || 'en';
  const categories = catalog.categories || [];
  const storyFlows = catalog.storyFlows || [];
  const visibilityRules = catalog?.visibilityRules;
  const role = profile?.role || 'viewer';

  const publishRequests = state.publishRequests || [];
  let pool = applyViewFilter(prompts, currentView, currentFilter, workspace, profile?.id, canPublish, visibilityRules, role, statusFilter);
  // Hide archived prompts from normal views unless explicitly filtering for them
  if (statusFilter !== 'archived') {
    pool = pool.filter(p => p.status !== 'archived');
  }
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
          canPublish={canPublish}
          profile={profile}
          workspace={workspace}
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
            <div className="category-tabs">
              {allTabs.map((block, idx) => {
                  const isActive = tabKey === block.key;
                  const colorIdx = idx % CATEGORY_COLORS.length;
                  return (
                <button
                  key={block.key}
                  className={`category-tab category-tab-c${colorIdx}${isActive ? ' category-tab-active' : ''}${block.prompts.length === 0 ? ' category-tab-empty' : ''}`}
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
                  );
                })}
            </div>

            <button
              className={`grouping-flip-btn${groupingMode === 'assistant' ? ' active' : ''}`}
              title={groupingMode === 'assistant' ? 'Switch to Story Flow grouping' : 'Switch to AI Assistant grouping'}
              onClick={() => dispatch({ type: 'SET_GROUPING_MODE', payload: groupingMode === 'assistant' ? 'flow' : 'assistant' })}
            >
              {groupingMode === 'assistant' ? '⊞ Assistant' : '⊞ Flow'}
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
              groupingMode={groupingMode}
              assistants={catalog.assistants || []}
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
