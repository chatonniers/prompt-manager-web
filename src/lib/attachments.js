// IndexedDB storage for prompt attachments
// Stored separately from chrome.storage.local to avoid the 10MB quota.
// Schema: db "pm-attachments" v1, store "attachments" keyed by id, index on promptId.

export const AttachmentsDB = (() => {
  const DB_NAME    = "pm-attachments";
  const DB_VERSION = 1;
  const STORE      = "attachments";

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("promptId", "promptId", { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function tx(db, mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  return {
    // Save one attachment (creates or replaces by id)
    async save(attachment) {
      const db = await open();
      return promisify(tx(db, "readwrite").put(attachment));
    },

    // Get all attachments for a prompt (metadata + data)
    async getForPrompt(promptId) {
      const db    = await open();
      const index = tx(db, "readonly").index("promptId");
      return promisify(index.getAll(IDBKeyRange.only(promptId)));
    },

    // Get single attachment by id (for download)
    async get(id) {
      const db = await open();
      return promisify(tx(db, "readonly").get(id));
    },

    // Delete one attachment
    async delete(id) {
      const db = await open();
      return promisify(tx(db, "readwrite").delete(id));
    },

    // Delete all attachments for a prompt (call when deleting prompt)
    async deleteForPrompt(promptId) {
      const attachments = await this.getForPrompt(promptId);
      await Promise.all(attachments.map(a => this.delete(a.id)));
    },

    // Get all attachments across all prompts (for export)
    async getAll() {
      const db = await open();
      return promisify(tx(db, "readonly").getAll());
    },

    // ArrayBuffer <-> base64 helpers for export/import
    bufToBase64(buf) {
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    },

    base64ToBuf(b64) {
      const bin  = atob(b64);
      const buf  = new ArrayBuffer(bin.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
      return buf;
    }
  };
})();
