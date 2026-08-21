import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { filterAndRank } from '../../lib/search.js';
import { t } from '../../lib/i18n.js';
import { getFlowColor } from '../../lib/flowColors.js';
import PromptCard from './PromptCard.jsx';
import EmptyState from './EmptyState.jsx';
import BulkActionBar from './BulkActionBar.jsx';

function applyViewFilter(prompts, view, filter) {
  if (view === 'favorites') return prompts.filter(p => p.isFavorite);
  if (view === 'most-used') return [...prompts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).filter(p => p.usageCount > 0);
  if (view === 'flow') return prompts.filter(p => p.storyFlow === (filter?.storyFlow ?? filter));
  if (view === 'solution') return prompts.filter(p => p.solutions?.includes(filter?.solution ?? filter));
  if (view === 'category') return prompts.filter(p => p.category === filter?.category);
  return prompts;
}

function DropZone({ className, style, onDrop, children }) {
  const [over, setOver] = useState(false);
  return (
    <div
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

function CategoryBlock({ label, catKey, prompts, storyFlows, lang, selectedIds, onToggleSelect, onDrop }) {
  const usedFlows = storyFlows.filter(f => prompts.some(p => p.storyFlow === f));
  const noFlow = prompts.filter(p => !p.storyFlow);
  const hasAnyFlow = usedFlows.length > 0;

  if (!hasAnyFlow) {
    return (
      <DropZone className="category-block" onDrop={id => onDrop(id, { isFavorite: false, category: catKey, storyFlow: null })}>
        <div className="grid-section-label">{label}</div>
        <div className="category-flat-grid">
          {prompts.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
        </div>
      </DropZone>
    );
  }

  const columns = [
    ...usedFlows.map(f => ({ key: f, label: f, prompts: prompts.filter(p => p.storyFlow === f) })),
    ...(noFlow.length > 0 ? [{ key: '__none__', label: '—', prompts: noFlow }] : []),
  ];

  return (
    <DropZone className="category-block" onDrop={id => onDrop(id, { isFavorite: false, category: catKey, storyFlow: null })}>
      <div className="grid-section-label">{label}</div>
      <div className="category-flow-columns">
        {columns.map(col => {
          const color = col.key !== '__none__' ? getFlowColor(col.label) : null;
          const flowName = col.key !== '__none__' ? col.label : null;
          return (
            <DropZone
              key={col.key}
              className="flow-column"
              onDrop={id => onDrop(id, { isFavorite: false, category: catKey, storyFlow: flowName })}
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

export default function PromptGrid() {
  const { state, dispatch } = useApp();
  const { prompts, currentView, currentFilter, searchQuery, sapContext, settings, catalog, selectedIds } = state;
  const lang = settings?.lang || 'en';
  const categories = catalog.categories || [];
  const storyFlows = catalog.storyFlows || [];

  let pool = applyViewFilter(prompts, currentView, currentFilter);

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

  async function handleDrop(promptId, updates) {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;
    dispatch({ type: 'SET_DRAGGING', payload: null });
    await StorageAPI.upsertPrompt({ ...prompt, ...updates });
    const [fresh, freshCatalog] = await Promise.all([
      StorageAPI.getAllPrompts(), StorageAPI.getCatalog()
    ]);
    dispatch({ type: 'SET_PROMPTS', payload: fresh });
    dispatch({ type: 'SET_CATALOG', payload: freshCatalog });
  }

  if (ranked.length === 0) return <EmptyState />;

  if (currentView === 'all' && !searchQuery.trim()) {
    const favs = ranked.filter(p => p.isFavorite);
    const categoryBlocks = [];

    for (const cat of categories) {
      const catPrompts = ranked.filter(p => !p.isFavorite && p.category === cat);
      if (catPrompts.length > 0) {
        categoryBlocks.push({ key: cat, label: cat, prompts: catPrompts });
      }
    }
    const uncategorized = ranked.filter(p => !p.isFavorite && !p.category);

    return (
      <>
        <BulkActionBar visibleIds={visibleIds} />
        <div id="prompt-grid-outer">
          {/* Favorites zone */}
          <DropZone className="category-block" onDrop={id => handleDrop(id, { isFavorite: true })}>
            <div className="grid-section-label">{t('favorites', lang)}</div>
            {favs.length > 0 ? (
              <div className="category-flat-grid">
                {favs.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--pm-text3)', padding: '8px 2px', fontStyle: 'italic' }}>No favorites yet — drag a card here or click the star.</p>
            )}
          </DropZone>

          {categoryBlocks.map(block => (
            <CategoryBlock
              key={block.key}
              catKey={block.key}
              label={block.label}
              prompts={block.prompts}
              storyFlows={storyFlows}
              lang={lang}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onDrop={handleDrop}
            />
          ))}

          {uncategorized.length > 0 && (
            <CategoryBlock
              key="__uncategorized__"
              catKey={null}
              label={t('noCategory', lang)}
              prompts={uncategorized}
              storyFlows={storyFlows}
              lang={lang}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onDrop={handleDrop}
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
