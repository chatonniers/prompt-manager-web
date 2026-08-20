import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { AttachmentsDB } from '../../lib/attachments.js';
import { t } from '../../lib/i18n.js';

export default function ConfirmModal() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { isConfirmOpen, pendingDeleteId, prompts } = state;
  const prompt = prompts.find(p => p.id === pendingDeleteId);

  async function handleConfirm() {
    if (!pendingDeleteId) return;
    await AttachmentsDB.deleteForPrompt(pendingDeleteId);
    await StorageAPI.deletePrompt(pendingDeleteId);
    const updated = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: updated });
    dispatch({ type: 'SHOW_TOAST', payload: t('promptDeleted', lang) });
    dispatch({ type: 'CLOSE_CONFIRM' });
  }

  if (!isConfirmOpen) return null;

  return (
    <div
      id="confirm-backdrop"
      onClick={e => { if (e.target.id === 'confirm-backdrop') dispatch({ type: 'CLOSE_CONFIRM' }); }}
    >
      <div id="confirm-modal">
        <p id="confirm-msg">Delete &quot;{prompt?.title || 'this prompt'}&quot;?</p>
        <div className="confirm-actions">
          <button className="action-btn" onClick={() => dispatch({ type: 'CLOSE_CONFIRM' })}>
            {t('cancel', lang)}
          </button>
          <button className="action-btn danger" onClick={handleConfirm}>
            {t('del', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
