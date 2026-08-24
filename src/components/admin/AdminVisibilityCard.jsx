import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';

const ROLES = ['admin', 'editor', 'viewer'];
const WORKSPACES = ['library', 'mine'];
const ALL_STATUSES = ['published', 'draft', 'archived'];
const ALL_KPIS = ['users', 'published', 'draft', 'pending', 'approved', 'rejected'];

const KPI_ROWS = [
  { key: 'admin',          label: 'Admin' },
  { key: 'editor',         label: 'Editor' },
  { key: 'viewer_library', label: 'Viewer — Library' },
  { key: 'viewer_mine',    label: 'Viewer — Mine' },
];

const KPI_APPLICABLE = {
  admin:          ['users', 'published', 'draft', 'pending', 'approved', 'rejected'],
  editor:         ['published', 'draft', 'pending', 'approved', 'rejected'],
  viewer_library: ['published', 'draft'],
  viewer_mine:    ['draft', 'pending', 'approved', 'rejected'],
};

const HELP_CARD_VISIBILITY = [
  { term: 'Allowed statuses', desc: 'Which prompt statuses (published / draft) are visible to this role in this workspace. Prompts with a status not checked are hidden entirely.' },
  { term: 'Include private drafts', desc: 'When checked, prompts marked Private are shown alongside public ones. When unchecked, only prompts with isPrivate = false pass through. Applies to both Library and Mine workspaces.' },
  { term: 'Library workspace', desc: 'The shared catalogue visible to all users. Typically admins/editors see both published and draft; viewers see published only.' },
  { term: 'Mine workspace', desc: 'Each user sees only prompts they own. The "Include private drafts" toggle controls whether their own private drafts appear here.' },
];

const HELP_KPI_PILLS = [
  { term: 'KPI pills', desc: 'The count badges shown in the header bar (e.g. "12 published", "3 draft"). Uncheck a pill to hide it for that role.' },
  { term: 'Users', desc: 'Total number of registered users. Only meaningful for admins — greyed out for other roles.' },
  { term: 'Published / Draft', desc: 'Count of prompts in each status that are visible to the role given the Card Visibility rules above.' },
  { term: 'Pending / Approved / Rejected', desc: 'Count of publish requests in each review state. Viewers see these for their own requests; admins/editors see all.' },
  { term: 'Greyed-out checkboxes', desc: 'A KPI is not applicable to that role (e.g. "users" for viewers). These cannot be enabled.' },
];

function HelpPopover({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="vr-help-wrap">
      <button
        className="vr-help-btn"
        onClick={() => setOpen(o => !o)}
        title="Show help"
        aria-expanded={open}
      >?</button>
      {open && (
        <div className="vr-help-popover">
          <button className="vr-help-close" onClick={() => setOpen(false)}>✕</button>
          {items.map(({ term, desc }) => (
            <div key={term} className="vr-help-item">
              <span className="vr-help-term">{term}</span>
              <span className="vr-help-desc">{desc}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

export default function AdminVisibilityCard() {
  const { state, dispatch } = useApp();
  const [vr, setVr] = useState(() => deepClone(state.catalog?.visibilityRules || {}));
  const [kr, setKr] = useState(() => deepClone(state.catalog?.kpiRules || {}));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.catalog?.visibilityRules) setVr(deepClone(state.catalog.visibilityRules));
    if (state.catalog?.kpiRules) setKr(deepClone(state.catalog.kpiRules));
  }, [!!state.catalog?.visibilityRules, !!state.catalog?.kpiRules]);

  function toggleStatus(role, ws, status) {
    setVr(prev => {
      const next = deepClone(prev);
      const statuses = next[role]?.[ws]?.statuses ?? [];
      if (statuses.includes(status)) {
        next[role][ws].statuses = statuses.filter(s => s !== status);
      } else {
        next[role][ws].statuses = [...statuses, status];
      }
      return next;
    });
  }

  function togglePrivate(role, ws) {
    setVr(prev => {
      const next = deepClone(prev);
      next[role][ws].includePrivate = !next[role][ws].includePrivate;
      return next;
    });
  }

  function toggleKpi(rowKey, kpi) {
    setKr(prev => {
      const next = deepClone(prev);
      const arr = next[rowKey] ?? [];
      if (arr.includes(kpi)) {
        next[rowKey] = arr.filter(k => k !== kpi);
      } else {
        next[rowKey] = [...arr, kpi];
      }
      return next;
    });
  }

  async function handleSave() {
    const updatedCatalog = { ...state.catalog, visibilityRules: vr, kpiRules: kr };
    await StorageAPI.saveCatalog(updatedCatalog);
    dispatch({ type: 'SET_CATALOG', payload: updatedCatalog });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <span>Visibility Rules</span>
        <button className="admin-save-btn" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* ── Card Visibility ────────────────────────────────── */}
      <div className="vr-section-title">
        Card Visibility — by role &amp; workspace
        <HelpPopover items={HELP_CARD_VISIBILITY} />
      </div>
      <table className="vr-table">
        <thead className="vr-thead">
          <tr>
            <th className="vr-th">Role / Workspace</th>
            <th className="vr-th">Allowed statuses</th>
            <th className="vr-th">Include private drafts</th>
          </tr>
        </thead>
        <tbody>
          {ROLES.map(role =>
            WORKSPACES.map(ws => {
              const rule = vr[role]?.[ws] ?? { statuses: [], includePrivate: false };
              return (
                <tr key={`${role}-${ws}`} className="vr-tr">
                  <td className="vr-td">
                    <span style={{ textTransform: 'capitalize' }}>{role}</span>
                    <span style={{ color: 'var(--pm-text3)', fontWeight: 400, marginLeft: 4 }}>/ {ws}</span>
                  </td>
                  <td className="vr-td">
                    <div className="vr-checkboxes">
                      {ALL_STATUSES.map(s => (
                        <label key={s} className="vr-checkbox-label">
                          <input
                            type="checkbox"
                            checked={rule.statuses.includes(s)}
                            onChange={() => toggleStatus(role, ws, s)}
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="vr-td">
                    <label className="vr-checkbox-label">
                      <input
                        type="checkbox"
                        checked={!!rule.includePrivate}
                        onChange={() => togglePrivate(role, ws)}
                      />
                      Yes
                    </label>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* ── KPI Pills ─────────────────────────────────────── */}
      <div className="vr-section-title">
        KPI Pills — by role
        <HelpPopover items={HELP_KPI_PILLS} />
      </div>
      <table className="vr-table">
        <thead className="vr-thead">
          <tr>
            <th className="vr-th">Role</th>
            {ALL_KPIS.map(k => <th key={k} className="vr-th" style={{ textAlign: 'center' }}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {KPI_ROWS.map(row => {
            const applicable = KPI_APPLICABLE[row.key];
            const enabled = kr[row.key] ?? [];
            return (
              <tr key={row.key} className="vr-tr">
                <td className="vr-td">{row.label}</td>
                {ALL_KPIS.map(kpi => {
                  const isApplicable = applicable.includes(kpi);
                  return (
                    <td key={kpi} className="vr-td" style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isApplicable && enabled.includes(kpi)}
                        disabled={!isApplicable}
                        onChange={() => isApplicable && toggleKpi(row.key, kpi)}
                        style={{ opacity: isApplicable ? 1 : 0.2, cursor: isApplicable ? 'pointer' : 'default' }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
