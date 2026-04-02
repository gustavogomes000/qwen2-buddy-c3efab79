// ── Offline Queue using IndexedDB ────────────────────────────────────────────
// Stores pending registrations when offline and syncs when back online.

const DB_NAME = 'rede-sarelli-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_registrations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineRegistration {
  id?: number;
  type: 'lideranca' | 'fiscal' | 'eleitor';
  pessoa: Record<string, any>;
  registro: Record<string, any>;
  pessoaExistenteId?: string | null;
  createdAt: string;
  attempts: number;
}

export async function addToOfflineQueue(reg: Omit<OfflineRegistration, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add({
    ...reg,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const count = store.count();
    return new Promise((resolve) => {
      count.onsuccess = () => { db.close(); resolve(count.result); };
      count.onerror = () => { db.close(); resolve(0); };
    });
  } catch {
    return 0;
  }
}

export async function getAllPending(): Promise<OfflineRegistration[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function updateAttempts(id: number, attempts: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const getReq = store.get(id);
  getReq.onsuccess = () => {
    if (getReq.result) {
      getReq.result.attempts = attempts;
      store.put(getReq.result);
    }
  };
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
