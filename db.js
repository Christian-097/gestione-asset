// db.js - IndexedDB helper (v2 con indici)
export function uuid() {
  return (crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    })
  );
}

const DB_NAME = "centraleDB";
const DB_VERSION = 2;

let _dbPromise = null;

export function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // STORE SALE
      let saleStore;
      if (!db.objectStoreNames.contains("sale")) {
        saleStore = db.createObjectStore("sale", { keyPath: "id" });
      } else {
        saleStore = req.transaction.objectStore("sale");
      }
      if (!saleStore.indexNames.contains("nome")) {
        saleStore.createIndex("nome", "nome", { unique: false });
      }

      // STORE ASSET
      let assetStore;
      if (!db.objectStoreNames.contains("asset")) {
        assetStore = db.createObjectStore("asset", { keyPath: "id" });
      } else {
        assetStore = req.transaction.objectStore("asset");
      }
      if (!assetStore.indexNames.contains("salaId")) {
        assetStore.createIndex("salaId", "salaId", { unique: false });
      }
      if (!assetStore.indexNames.contains("categoria")) {
        assetStore.createIndex("categoria", "categoria", { unique: false });
      }
      if (!assetStore.indexNames.contains("nome")) {
        assetStore.createIndex("nome", "nome", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _dbPromise;
}

function store(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const st = store(db, storeName, "readonly");
    const req = st.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getOne(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const st = store(db, storeName, "readonly");
    const req = st.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function save(storeName, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const st = store(db, storeName, "readwrite");
    const req = st.put(obj);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const st = store(db, storeName, "readwrite");
    const req = st.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const st = store(db, storeName, "readonly");
    const idx = st.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}