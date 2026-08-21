import { useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { t } from '../../lib/i18n.js';

export default function HelpModal({ onClose }) {
  const { state } = useApp();
  const lang = state.settings?.lang || 'en';

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sections = [
    { icon: '➕', titleKey: 'helpS1Title', bodyKey: 'helpS1Body', tipKey: 'helpS1Tip' },
    { icon: '📋', titleKey: 'helpS2Title', bodyKey: 'helpS2Body', tipKey: 'helpS2Tip' },
    { icon: '✏️', titleKey: 'helpS3Title', bodyKey: 'helpS3Body', tipKey: 'helpS3Tip' },
    { icon: '⧉',  titleKey: 'helpS4Title', bodyKey: 'helpS4Body' },
    { icon: '★',  titleKey: 'helpS5Title', bodyKey: 'helpS5Body' },
    { icon: '🗂️', titleKey: 'helpS6Title', bodyKey: 'helpS6Body', tipKey: 'helpS6Tip' },
    { icon: '🔗', titleKey: 'helpS7Title', bodyKey: 'helpS7Body', tipKey: 'helpS7Tip' },
    { icon: '📎', titleKey: 'helpS8Title', bodyKey: 'helpS8Body' },
    { icon: '↑↓', titleKey: 'helpS9Title', bodyKey: 'helpS9Body', tipKey: 'helpS9Tip' },
    { icon: '⚙',  titleKey: 'helpS10Title', bodyKey: 'helpS10Body' },
  ];

  return (
    <div className="help-backdrop" onClick={e => { if (e.target.classList.contains('help-backdrop')) onClose(); }}>
      <div className="help-modal">
        <div className="help-header">
          <div className="help-header-left">
            <span className="help-header-icon">?</span>
            <div>
              <div className="help-title">{t('helpTitle', lang)}</div>
              <div className="help-subtitle">{t('helpSubtitle', lang)}</div>
            </div>
          </div>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-body">
          <div className="help-grid">
            {sections.map(s => (
              <div key={s.titleKey} className="help-card">
                <div className="help-card-icon">{s.icon}</div>
                <div className="help-card-content">
                  <div className="help-card-title">{t(s.titleKey, lang)}</div>
                  <div className="help-card-body">{t(s.bodyKey, lang)}</div>
                  {s.tipKey && <div className="help-card-tip">💡 {t(s.tipKey, lang)}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="help-shortcuts">
            <div className="help-shortcuts-title">{t('helpShortcuts', lang)}</div>
            <div className="help-shortcut-row">
              <kbd>Esc</kbd>
              <span>{t('helpEscDesc', lang)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
