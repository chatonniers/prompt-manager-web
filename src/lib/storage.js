import { AttachmentsDB } from './attachments.js';

const DEFAULT_CATALOG = {
  solutions:  ["S/4HANA","IBP","Ariba","Joule","Joule Studio","BTP","Datasphere","SuccessFactors","Digital Manufacturing"],
  storyFlows: ["Procure-to-Pay","Order-to-Cash","Plan-to-Inventory","Hire-to-Retire","Record-to-Report","Lead-to-Cash","Design-to-Operate","Other"],
  landscapes: []
};

export const StorageAPI = {
  async getAllPrompts() {
    const raw = localStorage.getItem("pm-prompts");
    return raw ? JSON.parse(raw) : [];
  },

  async getCatalog() {
    const raw = localStorage.getItem("pm-catalog");
    const data = raw ? JSON.parse(raw) : {};
    // Migrate legacy string landscapes to { name, url } objects
    const rawLandscapes = data.landscapes ?? [...DEFAULT_CATALOG.landscapes];
    const landscapes = rawLandscapes.map(ls =>
      typeof ls === 'string'
        ? { name: ls, url: ls.startsWith('http') ? ls : '' }
        : ls
    );
    return {
      solutions:  data.solutions  ?? [...DEFAULT_CATALOG.solutions],
      storyFlows: data.storyFlows ?? [...DEFAULT_CATALOG.storyFlows],
      landscapes,
    };
  },

  async saveCatalog(catalog) {
    localStorage.setItem("pm-catalog", JSON.stringify(catalog));
    return Promise.resolve();
  },

  async upsertPrompt(prompt) {
    const prompts = await this.getAllPrompts();
    const idx = prompts.findIndex(p => p.id === prompt.id);
    const now = new Date().toISOString();
    if (idx >= 0) {
      prompts[idx] = { ...prompts[idx], ...prompt, updatedAt: now };
    } else {
      prompts.push({ ...prompt, createdAt: now, updatedAt: now });
    }
    localStorage.setItem("pm-prompts", JSON.stringify(prompts));
    return Promise.resolve();
  },

  async deletePrompt(id) {
    const prompts = await this.getAllPrompts();
    localStorage.setItem("pm-prompts", JSON.stringify(prompts.filter(p => p.id !== id)));
    return Promise.resolve();
  },

  async incrementUsage(id) {
    const prompts = await this.getAllPrompts();
    const p = prompts.find(p => p.id === id);
    if (p) {
      p.usageCount = (p.usageCount || 0) + 1;
      p.lastUsedAt = new Date().toISOString();
      localStorage.setItem("pm-prompts", JSON.stringify(prompts));
    }
    return Promise.resolve();
  },

  async getSettings() {
    const raw = localStorage.getItem("pm-settings");
    return raw ? JSON.parse(raw) : {
      autoFilterEnabled: true,
      overlayPosition: "right",
      theme: "light",
      lang: "en"
    };
  },

  async saveSettings(settings) {
    const current = await this.getSettings();
    localStorage.setItem("pm-settings", JSON.stringify({ ...current, ...settings }));
    return Promise.resolve();
  },

  async exportAll() {
    const [prompts, settings, catalog] = await Promise.all([
      this.getAllPrompts(),
      this.getSettings(),
      this.getCatalog()
    ]);
    let attachments = [];
    const raw = await AttachmentsDB.getAll();
    attachments = raw.map(a => ({
      id: a.id,
      promptId: a.promptId,
      name: a.name,
      type: a.type,
      size: a.size,
      data: AttachmentsDB.bufToBase64(a.data)
    }));
    return {
      prompts,
      settings,
      catalog,
      attachments,
      exportVersion: "1.1",
      exportedAt: new Date().toISOString()
    };
  },

  async importAll(data, mode = "merge") {
    if (!data.prompts || !Array.isArray(data.prompts)) throw new Error("Invalid import format");

    if (mode === "replace") {
      localStorage.setItem("pm-prompts", JSON.stringify(data.prompts));
      if (data.catalog) await this.saveCatalog(data.catalog);
      if (data.attachments) {
        await Promise.all(data.attachments.map(a =>
          AttachmentsDB.save({ ...a, data: AttachmentsDB.base64ToBuf(a.data) })
        ));
      }
      return { imported: data.prompts.length, skipped: 0 };
    }

    // merge mode
    const existing = await this.getAllPrompts();
    const existingIds = new Set(existing.map(p => p.id));
    const toAdd = data.prompts.filter(p => !existingIds.has(p.id));
    localStorage.setItem("pm-prompts", JSON.stringify([...existing, ...toAdd]));

    if (data.catalog) {
      const cur = await this.getCatalog();
      // Normalize incoming landscapes to { name, url } objects
      const incomingLandscapes = (data.catalog.landscapes || []).map(ls =>
        typeof ls === 'string' ? { name: ls, url: ls.startsWith('http') ? ls : '' } : ls
      );
      const mergedLandscapes = [...cur.landscapes];
      for (const incoming of incomingLandscapes) {
        if (!mergedLandscapes.some(ex => ex.name === incoming.name && ex.url === incoming.url)) {
          mergedLandscapes.push(incoming);
        }
      }
      await this.saveCatalog({
        solutions:  [...new Set([...cur.solutions,  ...(data.catalog.solutions  || [])])],
        storyFlows: [...new Set([...cur.storyFlows, ...(data.catalog.storyFlows || [])])],
        landscapes: mergedLandscapes,
      });
    }

    if (data.attachments) {
      const addedIds = new Set(toAdd.map(p => p.id));
      const attachsToImport = data.attachments.filter(a => addedIds.has(a.promptId));
      await Promise.all(attachsToImport.map(a =>
        AttachmentsDB.save({ ...a, data: AttachmentsDB.base64ToBuf(a.data) })
      ));
    }

    return { imported: toAdd.length, skipped: data.prompts.length - toAdd.length };
  }
};
