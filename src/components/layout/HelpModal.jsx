import { useEffect } from 'react';

const SECTIONS = [
  {
    icon: '➕',
    title: 'Create a prompt',
    body: 'Click "+ New Prompt" in the top bar. Fill in the title and body text — this is the text that will be copied to clipboard. Assign a category, story flow, and solutions to make it easy to find later.',
    tip: 'You can add multiple prompt bodies per card (e.g. Step 1, Step 2) — each gets its own Copy button.',
  },
  {
    icon: '📋',
    title: 'Copy a prompt',
    body: 'Click the "Copy" button on any prompt card. The text is instantly copied to your clipboard. Usage count is tracked automatically.',
    tip: 'Switch the language toggle (EN / FR) in the top bar to copy the French version when available.',
  },
  {
    icon: '✏️',
    title: 'Edit a prompt',
    body: 'Click anywhere on a card to flip it and reveal the inline edit form. Change the title, body, category, story flow, systems, notes, or attachments and click "Save Prompt". Click ✕ or "Cancel" to discard.',
    tip: 'The full modal (with all fields) opens from the "+ New Prompt" button.',
  },
  {
    icon: '⧉',
    title: 'Duplicate a prompt',
    body: 'Click the ⧉ button at the bottom of any card to create a copy. The duplicate appears immediately with "(copy)" appended to the title.',
  },
  {
    icon: '★',
    title: 'Favorites',
    body: 'Click the ★ star on any card to pin it to the Favorites section at the top of the main view. Click again to unpin.',
  },
  {
    icon: '🗂️',
    title: 'Categories & story flows',
    body: 'On the main "All Prompts" view, cards are grouped by Autonomous Suite category. Within each category, they are split into columns by story flow — each column is color-coded.',
    tip: 'Use the left sidebar to filter by category, story flow, or SAP solution.',
  },
  {
    icon: '🔗',
    title: 'Systems (landscapes)',
    body: 'In ⚙ Settings → Systems, add your SAP landscape URLs and MCP credentials. Then attach them to a prompt card. Click the system chip on a card to reveal connection details (endpoint URL, client ID, secret).',
    tip: 'Client secrets are hidden by default — click SHOW to reveal, or COPY to copy without revealing.',
  },
  {
    icon: '📎',
    title: 'Attachments',
    body: 'Attach files (ZIP, PDF, screenshots) to a prompt card via the edit form or the full modal. Files are stored locally in your browser (IndexedDB). Click a file name on the flipped card to download it.',
  },
  {
    icon: '↑↓',
    title: 'Import & Export',
    body: 'Use "↓ Export" to download all your prompts, catalog, and settings as a JSON file. Use "↑ Import" to load a file — choose Merge (keep existing) or Replace (overwrite all).',
    tip: 'Share the JSON with teammates so they can import your prompt library instantly.',
  },
  {
    icon: '⚙',
    title: 'Settings',
    body: 'Click ⚙ in the top-right corner to manage your catalog: Autonomous Suite categories, story flows, SAP solutions, and systems. Drag rows to reorder them.',
  },
];

export default function HelpModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="help-backdrop" onClick={e => { if (e.target.classList.contains('help-backdrop')) onClose(); }}>
      <div className="help-modal">
        <div className="help-header">
          <div className="help-header-left">
            <span className="help-header-icon">?</span>
            <div>
              <div className="help-title">How to use Prompt Manager</div>
              <div className="help-subtitle">Quick reference guide</div>
            </div>
          </div>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-body">
          <div className="help-grid">
            {SECTIONS.map(s => (
              <div key={s.title} className="help-card">
                <div className="help-card-icon">{s.icon}</div>
                <div className="help-card-content">
                  <div className="help-card-title">{s.title}</div>
                  <div className="help-card-body">{s.body}</div>
                  {s.tip && <div className="help-card-tip">💡 {s.tip}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="help-shortcuts">
            <div className="help-shortcuts-title">Keyboard shortcut</div>
            <div className="help-shortcut-row">
              <kbd>Esc</kbd>
              <span>Close this panel / close edit form</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
