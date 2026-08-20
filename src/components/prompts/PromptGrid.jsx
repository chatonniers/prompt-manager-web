import { useApp } from '../../context/AppContext.jsx';
import { filterAndRank } from '../../lib/search.js';
import { t } from '../../lib/i18n.js';
import PromptCard from './PromptCard.jsx';
import EmptyState from './EmptyState.jsx';

function applyViewFilter(prompts, view, filter) {
  if (view === 'favorites') return prompts.filter(p => p.isFavorite);
  if (view === 'most-used') return [...prompts].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).filter(p => p.usageCount > 0);
  if (view === 'flow') return prompts.filter(p => p.storyFlow === (filter?.storyFlow ?? filter));
  if (view === 'solution') return prompts.filter(p => p.solutions?.includes(filter?.solution ?? filter));
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

export default function PromptGrid() {
  const { state } = useApp();
  const { prompts, currentView, currentFilter, searchQuery, sortOrder, sapContext, settings } = state;
  const lang = settings?.lang || 'en';

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

  if (ranked.length === 0) return <EmptyState />;

  if (currentView === 'all' && !searchQuery.trim()) {
    const favs = ranked.filter(p => p.isFavorite);
    const rest = ranked.filter(p => !p.isFavorite);
    if (favs.length > 0 && rest.length > 0) {
      return (
        <div id="prompt-grid">
          <div className="grid-section-label">⭐ {t('favorites', lang)}</div>
          {favs.map(p => <PromptCard key={p.id} prompt={p} />)}
          <div className="grid-section-label">{t('allPrompts', lang)}</div>
          {rest.map(p => <PromptCard key={p.id} prompt={p} />)}
        </div>
      );
    }
  }

  return (
    <div id="prompt-grid">
      {ranked.map(p => <PromptCard key={p.id} prompt={p} />)}
    </div>
  );
}
