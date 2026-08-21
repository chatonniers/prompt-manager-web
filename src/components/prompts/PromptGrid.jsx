import { useApp } from '../../context/AppContext.jsx';
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

function applySortOrder(prompts, order) {
  const copy = [...prompts];
  if (order === 'title') copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (order === 'usage') copy.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  else if (order === 'created') copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else copy.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return copy;
}

// Render a category block: full-width label + flow columns below
function CategoryBlock({ label, prompts, storyFlows, lang, selectedIds, onToggleSelect }) {
  // Collect flows that actually have prompts, preserving catalog order
  const usedFlows = storyFlows.filter(f => prompts.some(p => p.storyFlow === f));
  const noFlow = prompts.filter(p => !p.storyFlow);

  const hasAnyFlow = usedFlows.length > 0;

  // No prompts have story flows — just render a flat grid
  if (!hasAnyFlow) {
    return (
      <div className="category-block">
        <div className="grid-section-label">{label}</div>
        <div className="category-flat-grid">
          {prompts.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
        </div>
      </div>
    );
  }

  const columns = [
    ...usedFlows.map(f => ({ key: f, label: f, prompts: prompts.filter(p => p.storyFlow === f) })),
    ...(noFlow.length > 0 ? [{ key: '__none__', label: '—', prompts: noFlow }] : []),
  ];

  return (
    <div className="category-block">
      <div className="grid-section-label">{label}</div>
      <div className="category-flow-columns">
        {columns.map(col => {
          const color = col.key !== '__none__' ? getFlowColor(col.label) : null;
          return (
            <div key={col.key} className="flow-column">
              <div
                className="flow-column-label"
                style={color ? { borderLeftColor: color.border, background: color.bg, color: color.text } : {}}
              >
                {col.label}
              </div>
              {col.prompts.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PromptGrid() {
  const { state, dispatch } = useApp();
  const { prompts, currentView, currentFilter, searchQuery, sortOrder, sapContext, settings, catalog, selectedIds } = state;
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
    if (currentView !== 'most-used') {
      ranked = applySortOrder(ranked, sortOrder);
    }
  }

  const visibleIds = ranked.map(p => p.id);

  function onToggleSelect(id) {
    dispatch({ type: 'TOGGLE_SELECT', payload: id });
  }

  if (ranked.length === 0) return <EmptyState />;

  // "All Prompts" view without search: category blocks with flow columns
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
          {favs.length > 0 && (
            <div className="category-block">
              <div className="grid-section-label">★ {t('favorites', lang)}</div>
              <div className="category-flat-grid">
                {favs.map(p => <PromptCard key={p.id} prompt={p} isSelected={selectedIds?.has(p.id)} onToggleSelect={onToggleSelect} />)}
              </div>
            </div>
          )}
          {categoryBlocks.map(block => (
            <CategoryBlock
              key={block.key}
              label={block.label}
              prompts={block.prompts}
              storyFlows={storyFlows}
              lang={lang}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
          {uncategorized.length > 0 && (
            <CategoryBlock
              key="__uncategorized__"
              label={t('noCategory', lang)}
              prompts={uncategorized}
              storyFlows={storyFlows}
              lang={lang}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
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
