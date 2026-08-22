import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stats-kpi-card">
      <div className="stats-kpi-value" style={{ color: color || 'var(--pm-accent)' }}>{value}</div>
      <div className="stats-kpi-label">{label}</div>
      {sub && <div className="stats-kpi-sub">{sub}</div>}
    </div>
  );
}

function fmtDuration(s) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

const RANGE_OPTIONS = [
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null },
];

function buildActivityBars(usage, days, appCreatedAt) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  let points = [];

  if (days === null) {
    // All time: bucket by week from app creation
    const start = appCreatedAt ? new Date(appCreatedAt) : new Date(now - 365 * day);
    start.setHours(0, 0, 0, 0);
    const totalDays = Math.ceil((now - start) / day) + 1;

    if (totalDays <= 14) {
      // Daily buckets
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start.getTime() + i * day);
        const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        const count = usage?.filter(u => new Date(u.copied_at).toDateString() === d.toDateString()).length || 0;
        points.push({ label, count });
      }
    } else {
      // Weekly buckets
      const weekMs = 7 * day;
      const numWeeks = Math.ceil(totalDays / 7);
      for (let i = 0; i < numWeeks; i++) {
        const weekStart = new Date(start.getTime() + i * weekMs);
        const weekEnd = new Date(Math.min(weekStart.getTime() + weekMs, now.getTime()));
        const label = weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        const count = usage?.filter(u => {
          const t = new Date(u.copied_at).getTime();
          return t >= weekStart.getTime() && t < weekEnd.getTime();
        }).length || 0;
        points.push({ label, count });
      }
    }
  } else {
    // Fixed day range — daily buckets
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * day);
      const label = days <= 7
        ? d.toLocaleDateString('en', { weekday: 'short' })
        : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      const count = usage?.filter(u => new Date(u.copied_at).toDateString() === d.toDateString()).length || 0;
      points.push({ label, count });
    }
  }

  const maxCount = Math.max(...points.map(p => p.count), 1);
  return { points, maxCount };
}

export default function AdminStatsView() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityDays, setActivityDays] = useState(7);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    const [
      { data: prompts },
      { data: profiles },
      { data: usage },
      { data: favorites },
      { data: sessions },
    ] = await Promise.all([
      supabase.from('prompts').select('id, title, usage_count, last_used_at, category, story_flow, solutions, status, owner_id, created_at'),
      supabase.from('profiles').select('id, email, display_name, role, created_at'),
      supabase.from('usage_events').select('prompt_id, user_id, copied_at').order('copied_at', { ascending: true }),
      supabase.from('favorites').select('prompt_id, user_id'),
      supabase.from('sessions').select('id, user_id, started_at, ended_at, duration_s').order('started_at', { ascending: false }).limit(100),
    ]);

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    const totalPrompts = prompts?.length || 0;
    const totalUsage = prompts?.reduce((s, p) => s + (p.usage_count || 0), 0) || 0;
    const usedPrompts = prompts?.filter(p => p.usage_count > 0).length || 0;
    const draftCount = prompts?.filter(p => p.status === 'draft').length || 0;
    const publishedCount = prompts?.filter(p => p.status === 'published').length || 0;
    const noStatusCount = prompts?.filter(p => !p.status).length || 0;

    const topPrompts = [...(prompts || [])]
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, 5);

    const catMap = {};
    prompts?.forEach(p => { const k = p.category || '—'; catMap[k] = (catMap[k] || 0) + 1; });
    const categoryBreakdown = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const totalUsers = profiles?.length || 0;
    const byRole = { admin: 0, editor: 0, viewer: 0, blocked: 0 };
    profiles?.forEach(p => { if (byRole[p.role] !== undefined) byRole[p.role]++; });
    const newUsersThisWeek = profiles?.filter(p => (now - new Date(p.created_at)) < 7 * day).length || 0;

    const userUsage = {};
    usage?.forEach(u => { userUsage[u.user_id] = (userUsage[u.user_id] || 0) + 1; });
    const topUsers = Object.entries(userUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uid, count]) => ({
        name: profiles?.find(p => p.id === uid)?.display_name || profiles?.find(p => p.id === uid)?.email || uid,
        count,
      }));

    const favMap = {};
    favorites?.forEach(f => { favMap[f.prompt_id] = (favMap[f.prompt_id] || 0) + 1; });
    const topFavorited = Object.entries(favMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, count]) => ({
        title: prompts?.find(p => p.id === pid)?.title || pid,
        count,
      }));

    const recentSessions = (sessions || []).map(s => ({
      name: profiles?.find(p => p.id === s.user_id)?.display_name || profiles?.find(p => p.id === s.user_id)?.email || '—',
      started: new Date(s.started_at),
      ended: s.ended_at ? new Date(s.ended_at) : null,
      duration_s: s.duration_s,
    }));

    const completedSessions = recentSessions.filter(s => s.duration_s != null);
    const avgDuration = completedSessions.length
      ? Math.round(completedSessions.reduce((sum, s) => sum + s.duration_s, 0) / completedSessions.length)
      : null;

    // Earliest data point for "all time" range
    const earliestUsage = usage?.length ? new Date(usage[0].copied_at) : null;
    const earliestPrompt = prompts?.length
      ? new Date(Math.min(...prompts.map(p => new Date(p.created_at).getTime())))
      : null;
    const appCreatedAt = [earliestUsage, earliestPrompt].filter(Boolean)
      .reduce((min, d) => (min === null || d < min ? d : min), null);

    setRaw({
      totalPrompts, totalUsage, usedPrompts, draftCount, publishedCount, noStatusCount,
      topPrompts, categoryBreakdown,
      totalUsers, byRole, newUsersThisWeek,
      topUsers, topFavorited,
      recentSessions, avgDuration,
      allUsage: usage || [],
      appCreatedAt,
    });
    setLoading(false);
  }

  const { points: activityPoints, maxCount: activityMax } = useMemo(() => {
    if (!raw) return { points: [], maxCount: 1 };
    return buildActivityBars(raw.allUsage, activityDays, raw.appCreatedAt);
  }, [raw, activityDays]);

  if (loading) return <div className="admin-loading">Loading statistics…</div>;
  const s = raw;

  const rangeLabel = activityDays === null
    ? `All time (${activityPoints.length > 14 ? 'weekly' : 'daily'} view)`
    : `Last ${activityDays} days`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPIs */}
      <div className="view-card">
        <h2>Overview</h2>
        <div className="stats-kpi-grid">
          <StatCard label="Total prompts" value={s.totalPrompts} color="var(--pm-accent)" />
          <StatCard label="Total copies" value={s.totalUsage} color="#818CF8" />
          <StatCard label="Prompts used" value={s.usedPrompts} sub={`${Math.round(s.usedPrompts / Math.max(s.totalPrompts, 1) * 100)}% of library`} color="#34D399" />
          <StatCard label="Total users" value={s.totalUsers} sub={`${s.newUsersThisWeek} new this week`} color="#F59E0B" />
          <StatCard label="Avg session" value={s.avgDuration != null ? fmtDuration(s.avgDuration) : '—'} sub="completed sessions" color="#F472B6" />
        </div>
      </div>

      {/* Activity chart */}
      <div className="view-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>Activity — {rangeLabel}</h2>
          <div className="stats-range-pills">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.label}
                className={`stats-range-pill${activityDays === opt.days ? ' active' : ''}`}
                onClick={() => setActivityDays(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="stats-bar-chart" style={{ marginTop: 16 }}>
          {activityPoints.map((d, i) => (
            <div key={i} className="stats-bar-col" style={{ minWidth: activityPoints.length > 30 ? 0 : undefined }}>
              <div className="stats-bar-value">{d.count > 0 ? d.count : ''}</div>
              <div className="stats-bar" style={{ height: `${Math.round((d.count / activityMax) * 80)}px` }} />
              {activityPoints.length <= 30 && <div className="stats-bar-label">{d.label}</div>}
            </div>
          ))}
        </div>
        {activityPoints.length > 30 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--pm-text3)', marginTop: 4 }}>
            <span>{activityPoints[0]?.label}</span>
            <span>{activityPoints[activityPoints.length - 1]?.label}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        <div className="view-card">
          <h2>Top prompts by usage</h2>
          {s.topPrompts.length === 0 ? <p style={{ color: 'var(--pm-text3)', fontSize: 12 }}>No usage yet.</p> : (
            <table className="stats-table">
              <tbody>
                {s.topPrompts.map(p => (
                  <tr key={p.id}>
                    <td className="stats-table-name">{p.title}</td>
                    <td className="stats-table-count">{p.usage_count}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="view-card">
          <h2>Most active users</h2>
          {s.topUsers.length === 0 ? <p style={{ color: 'var(--pm-text3)', fontSize: 12 }}>No usage yet.</p> : (
            <table className="stats-table">
              <tbody>
                {s.topUsers.map((u, i) => (
                  <tr key={i}>
                    <td className="stats-table-name">{u.name}</td>
                    <td className="stats-table-count">{u.count} copies</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="view-card">
          <h2>Prompt status</h2>
          <div className="stats-status-grid">
            <div className="stats-status-row"><span className="pill status-published">Published</span><strong>{s.publishedCount}</strong></div>
            <div className="stats-status-row"><span className="pill status-draft">Draft</span><strong>{s.draftCount}</strong></div>
            <div className="stats-status-row"><span style={{ fontSize: 11, color: 'var(--pm-text3)' }}>No status</span><strong>{s.noStatusCount}</strong></div>
          </div>
        </div>

        <div className="view-card">
          <h2>Users by role</h2>
          <div className="stats-status-grid">
            <div className="stats-status-row"><span className="role-badge role-admin">Admin</span><strong>{s.byRole.admin}</strong></div>
            <div className="stats-status-row"><span className="role-badge role-editor">Editor</span><strong>{s.byRole.editor}</strong></div>
            <div className="stats-status-row"><span className="role-badge role-viewer">Viewer</span><strong>{s.byRole.viewer}</strong></div>
            <div className="stats-status-row"><span className="role-badge" style={{ background: 'rgba(107,114,128,0.15)', color: '#9CA3AF' }}>Blocked</span><strong>{s.byRole.blocked}</strong></div>
          </div>
        </div>

        <div className="view-card">
          <h2>Prompts by category</h2>
          <table className="stats-table">
            <tbody>
              {s.categoryBreakdown.map(([cat, count]) => (
                <tr key={cat}>
                  <td className="stats-table-name">{cat}</td>
                  <td className="stats-table-count">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="view-card">
          <h2>Most favorited prompts</h2>
          {s.topFavorited.length === 0 ? <p style={{ color: 'var(--pm-text3)', fontSize: 12 }}>No favorites yet.</p> : (
            <table className="stats-table">
              <tbody>
                {s.topFavorited.map((f, i) => (
                  <tr key={i}>
                    <td className="stats-table-name">{f.title}</td>
                    <td className="stats-table-count">★ {f.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Recent connections */}
      <div className="view-card">
        <h2>Recent connections</h2>
        {s.recentSessions.length === 0 ? (
          <p style={{ color: 'var(--pm-text3)', fontSize: 12 }}>No sessions recorded yet. Make sure the sessions table is created in Supabase.</p>
        ) : (
          <table className="stats-table stats-sessions-table">
            <thead>
              <tr>
                <th className="stats-table-name" style={{ fontWeight: 700, fontSize: 11, color: 'var(--pm-text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User</th>
                <th className="stats-table-count" style={{ fontWeight: 700, fontSize: 11, color: 'var(--pm-text2)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Login</th>
                <th className="stats-table-count" style={{ fontWeight: 700, fontSize: 11, color: 'var(--pm-text2)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Logout</th>
                <th className="stats-table-count" style={{ fontWeight: 700, fontSize: 11, color: 'var(--pm-text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {s.recentSessions.map((sess, i) => (
                <tr key={i}>
                  <td className="stats-table-name">{sess.name}</td>
                  <td className="stats-table-count" style={{ textAlign: 'left', color: 'var(--pm-text2)', fontWeight: 400 }}>
                    {sess.started.toLocaleDateString('en', { month: 'short', day: 'numeric' })} {sess.started.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="stats-table-count" style={{ textAlign: 'left', color: 'var(--pm-text2)', fontWeight: 400 }}>
                    {sess.ended
                      ? `${sess.ended.toLocaleDateString('en', { month: 'short', day: 'numeric' })} ${sess.ended.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`
                      : <span style={{ color: '#34D399', fontWeight: 600 }}>● Active</span>
                    }
                  </td>
                  <td className="stats-table-count">{fmtDuration(sess.duration_s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <button className="action-btn" onClick={loadStats}>↻ Refresh</button>
      </div>
    </div>
  );
}
