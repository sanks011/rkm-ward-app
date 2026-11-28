const OFFLINE_DB_NAME = "rkm_offline_queue";
const OFFLINE_STORE = "pending_uploads";

export interface OfflineUploadItem {
  id?: number;
  mrd: string;
  slotType: string;
  photoDate: string;
  geoStoreText: string;
  uploadedBy: string;
  blob: Blob;
  createdAt: string;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OFFLINE_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueAdd(record: OfflineUploadItem): Promise<number> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const req = tx.objectStore(OFFLINE_STORE).add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function queueGetAll(): Promise<OfflineUploadItem[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineUploadItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function queueDelete(id: number): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const req = tx.objectStore(OFFLINE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function looksLikeNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err || "");
  return /network|failed to fetch|load failed|timeout/i.test(msg);
}
