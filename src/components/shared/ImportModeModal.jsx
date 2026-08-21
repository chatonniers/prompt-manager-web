import { useState } from 'react';
import { t } from '../../lib/i18n.js';

export default function ImportModeModal({ data, existingCount, lang, onConfirm, onClose }) {
  const [mode, setMode] = useState('merge');
  const [confirming, setConfirming] = useState(false);

  function handleProceed() {
    if (mode === 'replace' && !confirming) {
      setConfirming(true);
      return;
    }
    onConfirm(data, mode);
  }

  return (
    <div className="import-mode-backdrop" onClick={onClose}>
      <div className="import-mode-modal" onClick={e => e.stopPropagation()}>
        <div className="import-mode-header">
          <span className="import-mode-title">{t('importModeTitle', lang)}</span>
          <button className="import-mode-close" onClick={onClose}>✕</button>
        </div>

        {!confirming ? (
          <>
            <div className="import-mode-options">
              <label className={`import-mode-option${mode === 'merge' ? ' selected' : ''}`}>
                <input type="radio" name="import-mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                <div>
                  <div className="import-mode-option-label">{t('importMergeLbl', lang)}</div>
                </div>
              </label>
              <label className={`import-mode-option${mode === 'replace' ? ' selected' : ''}`}>
                <input type="radio" name="import-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                <div>
                  <div className="import-mode-option-label danger">{t('importReplaceLbl', lang)}</div>
                </div>
              </label>
            </div>
            <div className="import-mode-actions">
              <button className="import-mode-cancel" onClick={onClose}>{t('cancel', lang)}</button>
              <button className={`import-mode-confirm${mode === 'replace' ? ' danger' : ''}`} onClick={handleProceed}>
                {t('import', lang)}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="import-mode-warning">
              {t('importReplaceConfirm', lang, existingCount)}
            </div>
            <div className="import-mode-actions">
              <button className="import-mode-cancel" onClick={() => setConfirming(false)}>{t('cancel', lang)}</button>
              <button className="import-mode-confirm danger" onClick={() => onConfirm(data, 'replace')}>
                {t('importReplaceBtn', lang)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
