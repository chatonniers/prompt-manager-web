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

const CAT_ICONS = {
  'Autonomous Finance':       '💰',
  'Autonomous Supply Chain':  '🔗',
  'Autonomous Spend':         '🛒',
  'Autonomous HCM':           '👥',
  'Autonomous CX':            '💬',
};

export default function PromptGrid() {
  const { state } = useApp();
  const { prompts, currentView, currentFilter, searchQuery, sortOrder, sapContext, settings, catalog } = state;
  const lang = settings?.lang || 'en';
  const categories = catalog.categories || [];

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

  // "All Prompts" view without search: group by category then favorites
  if (currentView === 'all' && !searchQuery.trim()) {
    const groups = [];

    // Favorites first
    const favs = ranked.filter(p => p.isFavorite);
    if (favs.length > 0) {
      groups.push({ label: `★ ${t('favorites', lang)}`, prompts: favs });
    }

    // Then group by category
    for (const cat of categories) {
      const catPrompts = ranked.filter(p => !p.isFavorite && p.category === cat);
      if (catPrompts.length > 0) {
        groups.push({ label: cat, prompts: catPrompts });
      }
    }

    // Uncategorized last
    const uncategorized = ranked.filter(p => !p.isFavorite && !p.category);
    if (uncategorized.length > 0) {
      groups.push({ label: t('noCategory', lang), prompts: uncategorized });
    }

    if (groups.length <= 1) {
      return (
        <div id="prompt-grid">
          {ranked.map(p => <PromptCard key={p.id} prompt={p} />)}
        </div>
      );
    }

    return (
      <div id="prompt-grid">
        {groups.map(group => (
          <>
            <div key={group.label} className="grid-section-label">{group.label}</div>
            {group.prompts.map(p => <PromptCard key={p.id} prompt={p} />)}
          </>
        ))}
      </div>
    );
  }

  return (
    <div id="prompt-grid">
      {ranked.map(p => <PromptCard key={p.id} prompt={p} />)}
    </div>
  );
}
