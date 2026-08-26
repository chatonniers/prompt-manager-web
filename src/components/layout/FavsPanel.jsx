import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';
import PromptCard from '../prompts/PromptCard.jsx';

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1.5l1.8 3.6 4 .58-2.9 2.83.68 3.99L8 10.35l-3.58 1.88.68-3.99L2.2 5.68l4-.58L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

function DropZone({ className, onDrop, children }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`${className}${over ? ' dz-over' : ''}`}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); onDrop(e.dataTransfer.getData('promptId')); }}
    >
      {children}
    </div>
  );
}

export default function FavsPanel({ collapsed, onToggle }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const favs = (state.prompts || []).filter(p => p.isFavorite);
  const { selectedIds } = state;
  const isDragging = !!state.draggingId;

  async function handleDrop(id) {
    if (!id) return;
    const prompt = (state.prompts || []).find(p => p.id === id);
    if (!prompt) return;
    await StorageAPI.upsertPrompt({ ...prompt, isFavorite: true });
    dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
  }

  function onToggleSelect(id) {
    dispatch({ type: 'TOGGLE_SELECT', payload: id });
  }

  return (
    <aside id="favs-panel" className={collapsed ? 'favs-panel-collapsed' : ''}>
      <button className="favs-panel-toggle" onClick={onToggle} title={collapsed ? t('favorites', lang) : undefined}>
        <StarIcon />
        {collapsed
          ? (favs.length > 0 && <span className="favs-panel-badge">{favs.length}</span>)
          : (
            <>
              <span>{t('favorites', lang)}</span>
              <span className="section-count">{favs.length}</span>
            </>
          )
        }
      </button>
      {!collapsed && (
        <DropZone
          className={`favs-panel-dropzone${isDragging ? ' favs-panel-dropzone-active' : ''}`}
          onDrop={handleDrop}
        >
          {favs.length === 0
            ? <p className="favs-panel-empty">{t('noFavoritesYet', lang)}</p>
            : (
              <div className="favs-panel-list">
                {favs.map(p => (
                  <div key={p.id} className="favs-panel-item">
                    <PromptCard
                      prompt={p}
                      compact
                      isSelected={selectedIds?.has(p.id)}
                      onToggleSelect={onToggleSelect}
                    />
                  </div>
                ))}
              </div>
            )
          }
        </DropZone>
      )}
    </aside>
  );
}
