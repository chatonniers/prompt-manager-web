import { useApp } from '../../context/AppContext.jsx';
import { t } from '../../lib/i18n.js';

export default function EmptyState() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  return (
    <div className="empty-state">
      <h3>{t('noPrompts', lang)}</h3>
      <p>{t('noPromptsHint', lang)}</p>
      <button
        className="action-btn primary"
        style={{ marginTop: 16 }}
        onClick={() => dispatch({ type: 'OPEN_MODAL', payload: undefined })}
      >
        {t('newPrompt', lang)}
      </button>
    </div>
  );
}
