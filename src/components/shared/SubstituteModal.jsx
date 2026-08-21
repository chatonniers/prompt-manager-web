import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { extractVars, applyVars } from '../../lib/substitution.js';
import { t } from '../../lib/i18n.js';

export default function SubstituteModal({ text, onCopy, onClose, lang }) {
  const vars = extractVars(text);
  const [values, setValues] = useState(() => Object.fromEntries(vars.map(v => [v, ''])));

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleCopyWithValues() {
    onCopy(applyVars(text, values));
    onClose();
  }

  function handleCopyAsIs() {
    onCopy(text);
    onClose();
  }

  return createPortal(
    <div className="subst-backdrop" onClick={onClose}>
      <div className="subst-modal" onClick={e => e.stopPropagation()}>
        <div className="subst-header">
          <span className="subst-title">{t('varSubstTitle', lang)}</span>
          <button className="subst-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="subst-vars">
          {vars.map(v => (
            <div key={v} className="subst-var-row">
              <label className="subst-var-label">[{v}]</label>
              <input
                className="subst-var-input card-edit-input"
                type="text"
                placeholder={v}
                value={values[v]}
                onChange={e => setValues(prev => ({ ...prev, [v]: e.target.value }))}
                autoFocus={vars[0] === v}
              />
            </div>
          ))}
        </div>
        <div className="subst-actions">
          <button className="subst-btn-secondary" onClick={handleCopyAsIs}>{t('varSubstCopyAsIs', lang)}</button>
          <button className="subst-btn-primary" onClick={handleCopyWithValues}>{t('varSubstCopyBtn', lang)}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
