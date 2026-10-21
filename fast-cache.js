/* =========================================================
   Whale Love Club - Fast Cache Helper
   File: /fast-cache.js
   - JSON: localStorage
   - Images: IndexedDB
   - Never stores LINE tokens
   ========================================================= */
(function () {
  const JSON_PREFIX = 'wlc-fast-v1:';
  const DB_NAME = 'wlc-fast-image-cache-v1';
  const STORE = 'images';
  const IMAGE_MAX_ITEMS = 120;
  const IMAGE_MAX_BYTES = 80 * 1024 * 1024;

  function userKey() {
    try {
      if (
        window.liff &&
        typeof liff.getDecodedIDToken === 'function'
      ) {
        const d = liff.getDecodedIDToken();
        if (d && d.sub) return String(d.sub);
      }
    } catch (_) {}
    return '';
  }

  function key(scope, suffix) {
    const u = userKey();
    if (!u) return '';
    return JSON_PREFIX + u + ':' + scope + ':' + (suffix || 'main');
  }

  function getJSON(scope, suffix, maxAgeMs) {
    const k = key(scope, suffix);
    if (!k) return null;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (!item || !item.savedAt) return null;
      const maxAge =
        Number(maxAgeMs || (30 * 24 * 60 * 60 * 1000));
      if (Date.now() - Number(item.savedAt) > maxAge) {
        localStorage.removeItem(k);
        return null;
      }
      return item.data;
    } catch (_) {
      return null;
    }
  }

  function setJSON(scope, suffix, data) {
    const k = key(scope, suffix);
    if (!k) return false;
    try {
      localStorage.setItem(
        k,
        JSON.stringify({
          savedAt: Date.now(),
          data: data
        })
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function removeJSON(scope, suffix) {
    const k = key(scope, suffix);
    if (!k) return;
    try { localStorage.removeItem(k); } catch (_) {}
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('lastUsed', 'lastUsed');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  async function getImage(id) {
    id = String(id || '').trim();
    if (!id) return '';
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.get(id);
        req.onsuccess = () => {
          const item = req.result;
          if (!item || !item.src) {
            resolve('');
            return;
          }
          item.lastUsed = Date.now();
          try { store.put(item); } catch (_) {}
          resolve(item.src);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (_) {
      return '';
    }
  }

  async function setImage(id, src) {
    id = String(id || '').trim();
    src = String(src || '');
    if (!id || !src) return;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.put({
          id,
          src,
          bytes: src.length * 0.75,
          lastUsed: Date.now()
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      pruneImages().catch(() => {});
    } catch (_) {}
  }

  async function pruneImages() {
    const db = await openDb();
    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    items.sort((a, b) => Number(b.lastUsed || 0) - Number(a.lastUsed || 0));

    let bytes = 0;
    const keep = new Set();
    for (const item of items) {
      const itemBytes = Number(item.bytes || 0);
      if (
        keep.size < IMAGE_MAX_ITEMS &&
        bytes + itemBytes <= IMAGE_MAX_BYTES
      ) {
        keep.add(item.id);
        bytes += itemBytes;
      }
    }

    const remove = items.filter(x => !keep.has(x.id));
    if (!remove.length) return;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      remove.forEach(x => store.delete(x.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  window.WLCFastCache = {
    getJSON,
    setJSON,
    removeJSON,
    getImage,
    setImage,
    userKey
  };
})();
