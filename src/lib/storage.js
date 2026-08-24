import { supabase } from './supabase.js';
import { AttachmentsDB } from './attachments.js';

export async function uploadSkillFile(promptId, attId, fileName, arrayBuffer) {
  const path = `${promptId}/${attId}/${fileName}`;
  const { error } = await supabase.storage.from('skills').upload(path, arrayBuffer, {
    contentType: 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('skills').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteSkillFile(promptId, attId, fileName) {
  const path = `${promptId}/${attId}/${fileName}`;
  await supabase.storage.from('skills').remove([path]);
}

const SETTINGS_DEFAULTS = {
  autoFilterEnabled: true,
  overlayPosition: 'right',
  theme: 'dark',
  lang: 'en',
};

const CATALOG_ID = '00000000-0000-0000-0000-000000000001';

// ── shape converters ──────────────────────────────────────────────────────
function dbToPrompt(row) {
  return {
    id:           row.id,
    title:        row.title,
    body:         row.body,
    body_fr:      row.body_fr,
    promptItems:  row.prompt_items || [],
    category:     row.category,
    storyFlow:    row.story_flow,
    solutions:    row.solutions || [],
    personas:     row.personas  || [],
    tags:         row.tags      || [],
    notes:        row.notes,
    status:       row.status,
    isFavorite:   row.is_favorite,
    usageCount:   row.usage_count  || 0,
    lastUsedAt:   row.last_used_at,
    demoLinks:    row.demo_links   || [],
    systems:      row.systems      || [],
    attachments:  row.attachments  || [],
    ownerId:      row.owner_id,
    isPrivate:    row.is_private ?? true,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

function promptToDb(p, userId) {
  const row = {
    id:            p.id,
    owner_id:      p.ownerId || userId,
    title:         p.title,
    body:          p.body   || '',
    body_fr:       p.body_fr || null,
    prompt_items:  p.promptItems || [],
    category:      p.category   || null,
    story_flow:    p.storyFlow  || null,
    solutions:     p.solutions  || [],
    personas:      p.personas   || [],
    tags:          p.tags       || [],
    notes:         p.notes      || null,
    status:        p.status     || null,
    is_favorite:   p.isFavorite || false,
    is_private:    p.isPrivate  ?? true,
    demo_links:    p.demoLinks  || [],
    systems:       p.systems    || [],
    attachments:   p.attachments|| [],
  };
  // Preserve timestamps and usage on import (only set if provided)
  if (p.usageCount != null)  row.usage_count  = p.usageCount;
  if (p.lastUsedAt != null)  row.last_used_at = p.lastUsedAt;
  if (p.createdAt  != null)  row.created_at   = p.createdAt;
  return row;
}

function dbToCatalog(row) {
  if (!row) return { solutions: [], storyFlows: [], categories: [], systems: [], personas: [], tags: [], visibilityRules: null, kpiRules: null };
  return {
    solutions:       row.solutions   || [],
    storyFlows:      row.story_flows || [],
    categories:      row.categories  || [],
    systems:         row.systems     || [],
    personas:        row.personas    || [],
    tags:            row.tags        || [],
    visibilityRules: row.visibility_rules ?? null,
    kpiRules:        row.kpi_rules        ?? null,
  };
}

function catalogToDb(catalog) {
  return {
    solutions:         catalog.solutions  || [],
    story_flows:       catalog.storyFlows || [],
    categories:        catalog.categories || [],
    systems:           catalog.systems    || [],
    personas:          catalog.personas   || [],
    tags:              catalog.tags       || [],
    visibility_rules:  catalog.visibilityRules ?? null,
    kpi_rules:         catalog.kpiRules        ?? null,
  };
}

// ── Current user id helper ────────────────────────────────────────────────
async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ── Per-user favorites set (loaded once per session) ─────────────────────
let _favoritesCache = null;
async function getFavoritesSet() {
  if (_favoritesCache) return _favoritesCache;
  const userId = await getCurrentUserId();
  if (!userId) return new Set();
  const { data } = await supabase.from('favorites').select('prompt_id').eq('user_id', userId);
  _favoritesCache = new Set((data || []).map(r => r.prompt_id));
  return _favoritesCache;
}
function invalidateFavCache() { _favoritesCache = null; }

// ── StorageAPI ────────────────────────────────────────────────────────────
export const StorageAPI = {
  async getAllPrompts() {
    const [{ data, error }, favs] = await Promise.all([
      supabase.from('prompts').select('*').order('created_at', { ascending: false }),
      getFavoritesSet(),
    ]);
    if (error) throw error;
    return (data || []).map(row => ({ ...dbToPrompt(row), isFavorite: favs.has(row.id) }));
  },

  async getCatalog() {
    const { data, error } = await supabase.from('catalog').select('*').eq('id', CATALOG_ID).single();
    if (error && error.code !== 'PGRST116') throw error;
    return dbToCatalog(data);
  },

  async saveCatalog(catalog) {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from('catalog').upsert({
      id: CATALOG_ID,
      ...catalogToDb(catalog),
      updated_by: userId,
    });
    if (error) throw error;
  },

  async upsertPrompt(prompt) {
    const userId = await getCurrentUserId();
    const row = promptToDb(prompt, userId);

    // Handle isFavorite separately via favorites table
    const isFav = prompt.isFavorite;
    const favs = await getFavoritesSet();
    const wasFav = favs.has(prompt.id);

    if (isFav !== wasFav && userId) {
      if (isFav) {
        await supabase.from('favorites').upsert({ user_id: userId, prompt_id: prompt.id });
        favs.add(prompt.id);
      } else {
        await supabase.from('favorites').delete().eq('user_id', userId).eq('prompt_id', prompt.id);
        favs.delete(prompt.id);
      }
    }

    const isNew = !prompt.id || !(await supabase.from('prompts').select('id').eq('id', prompt.id).maybeSingle()).data;
    let error;
    if (isNew) {
      ({ error } = await supabase.from('prompts').insert(row));
    } else {
      ({ error } = await supabase.from('prompts').update(row).eq('id', row.id));
    }
    if (error) throw error;
  },

  async deletePrompt(id) {
    const { error } = await supabase.from('prompts').delete().eq('id', id);
    if (error) throw error;
    invalidateFavCache();
  },

  async deletePrompts(ids) {
    const { error } = await supabase.from('prompts').delete().in('id', ids);
    if (error) throw error;
    invalidateFavCache();
  },

  async incrementUsage(id) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    // Insert usage event — DB trigger bumps usage_count on prompts table
    const { error } = await supabase.from('usage_events').insert({ prompt_id: id, user_id: userId });
    if (error) throw error;
  },

  async getSettings() {
    const raw = localStorage.getItem('pm-settings');
    return raw ? { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) } : { ...SETTINGS_DEFAULTS };
  },

  async saveSettings(settings) {
    const current = await this.getSettings();
    localStorage.setItem('pm-settings', JSON.stringify({ ...current, ...settings }));
  },

  // ── Export / Import (unchanged from local version) ──────────────────────
  async exportAll() {
    const [prompts, settings, catalog] = await Promise.all([
      this.getAllPrompts(),
      this.getSettings(),
      this.getCatalog(),
    ]);
    let attachments = [];
    try {
      const raw = await AttachmentsDB.getAll();
      attachments = raw.map(a => ({
        id: a.id, promptId: a.promptId, name: a.name, type: a.type, size: a.size,
        data: AttachmentsDB.bufToBase64(a.data),
      }));
    } catch { /* attachments optional */ }
    return { prompts, settings, catalog, attachments, exportVersion: '1.2', exportedAt: new Date().toISOString() };
  },

  async importAll(data, mode = 'merge') {
    if (!data.prompts || !Array.isArray(data.prompts)) throw new Error('Invalid import format');
    const userId = await getCurrentUserId();

    if (mode === 'replace') {
      // Delete all existing prompts and favorites
      const { error } = await supabase.from('prompts').delete().neq('id', 'none');
      if (error) throw error;
      invalidateFavCache();

      // Insert prompts preserving timestamps/usage
      const rows = data.prompts.map(p => promptToDb(p, userId));
      const { error: e2 } = await supabase.from('prompts').insert(rows);
      if (e2) throw e2;

      // Restore favorites for current user
      const favIds = data.prompts.filter(p => p.isFavorite).map(p => p.id);
      if (favIds.length > 0 && userId) {
        await supabase.from('favorites').upsert(favIds.map(id => ({ user_id: userId, prompt_id: id })));
        invalidateFavCache();
      }

      // Restore catalog (including visibilityRules, kpiRules, systems)
      if (data.catalog) await this.saveCatalog(data.catalog);

      // Restore settings
      if (data.settings) await this.saveSettings(data.settings);

      return { imported: data.prompts.length, skipped: 0 };
    }

    // merge mode
    const existing = await this.getAllPrompts();
    const existingIds = new Set(existing.map(p => p.id));
    const toAdd = data.prompts.filter(p => !existingIds.has(p.id));
    if (toAdd.length > 0) {
      const rows = toAdd.map(p => promptToDb(p, userId));
      const { error } = await supabase.from('prompts').insert(rows);
      if (error) throw error;

      // Restore favorites for newly added prompts
      const favIds = toAdd.filter(p => p.isFavorite).map(p => p.id);
      if (favIds.length > 0 && userId) {
        await supabase.from('favorites').upsert(favIds.map(id => ({ user_id: userId, prompt_id: id })));
        invalidateFavCache();
      }
    }

    if (data.catalog) {
      const cur = await this.getCatalog();
      await this.saveCatalog({
        solutions:       [...new Set([...cur.solutions,  ...(data.catalog.solutions  || [])])],
        storyFlows:      [...new Set([...cur.storyFlows, ...(data.catalog.storyFlows || [])])],
        personas:        [...new Set([...cur.personas,   ...(data.catalog.personas   || [])])],
        categories:      [...new Set([...cur.categories, ...(data.catalog.categories || [])])],
        tags:            [...new Set([...cur.tags,       ...(data.catalog.tags       || [])])],
        // Merge systems by id, preferring existing
        systems:         [
          ...cur.systems,
          ...(data.catalog.systems || []).filter(s => !cur.systems.some(cs => cs.id === s.id)),
        ],
        // Preserve current visibilityRules/kpiRules — don't overwrite from import
        visibilityRules: cur.visibilityRules,
        kpiRules:        cur.kpiRules,
      });
    }

    // Merge settings (only missing keys, don't overwrite existing preferences)
    if (data.settings) {
      const cur = await this.getSettings();
      const merged = { ...data.settings, ...cur }; // cur wins on conflict
      await this.saveSettings(merged);
    }

    return { imported: toAdd.length, skipped: data.prompts.length - toAdd.length };
  },

  // ── Publish requests ───────────────────────────────────────────────────
  async getPublishRequests() {
    const { data, error } = await supabase
      .from('publish_requests')
      .select('*, prompt:prompts(title,body,prompt_items), requester:profiles!requester_id(display_name,email)')
      .order('created_at', { ascending: false });
    if (error) {
      // Table may not exist yet (pre-migration) — fail silently
      if (error.code === 'PGRST116' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  },

  async createPublishRequest(promptId) {
    const { data: { user } } = await supabase.auth.getUser();
    // Delete any existing non-pending request (rejected/approved) before re-inserting
    await supabase
      .from('publish_requests')
      .delete()
      .eq('prompt_id', promptId)
      .eq('requester_id', user.id)
      .neq('status', 'pending');
    const { error } = await supabase
      .from('publish_requests')
      .insert({ prompt_id: promptId, requester_id: user.id, status: 'pending' });
    if (error) throw error;
  },

  async deletePublishRequest(promptId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('publish_requests')
      .delete()
      .eq('prompt_id', promptId)
      .eq('requester_id', user.id);
    if (error) throw error;
  },

  async reviewPublishRequest(requestId, promptId, approve) {
    const { data: { user } } = await supabase.auth.getUser();
    if (approve) {
      const { error: pe } = await supabase.from('prompts').update({ is_private: false }).eq('id', promptId);
      if (pe) throw pe;
    }
    const { error } = await supabase
      .from('publish_requests')
      .update({ status: approve ? 'approved' : 'rejected', reviewed_by: user.id })
      .eq('id', requestId);
    if (error) throw error;
  },

  // ── Real-time subscription ─────────────────────────────────────────────
  subscribeToPrompts(onUpdate) {
    return supabase
      .channel('prompts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prompts' }, onUpdate)
      .subscribe();
  },

  subscribeToCatalog(onUpdate) {
    return supabase
      .channel('catalog-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog' }, onUpdate)
      .subscribe();
  },

  subscribeToPublishRequests(onUpdate) {
    return supabase
      .channel('publish-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publish_requests' }, onUpdate)
      .subscribe();
  },

  unsubscribe(channel) {
    supabase.removeChannel(channel);
  },
};
