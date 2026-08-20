import { useApp } from '../../context/AppContext.jsx';
import { t } from '../../lib/i18n.js';

export default function EmptyState() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🗂</div>
      <div className="empty-state-title">{t('noPrompts', lang)}</div>
      <div className="empty-state-hint">{t('noPromptsHint', lang)}</div>
      <button className="action-btn primary" style={{ marginTop: 16 }} onClick={() => dispatch({ type: 'OPEN_EDIT', id: null })}>
        {t('newPrompt', lang)}
      </button>
    </div>
  );
}
