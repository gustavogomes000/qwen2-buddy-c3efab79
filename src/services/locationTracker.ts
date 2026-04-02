import { supabase } from '@/integrations/supabase/client';

// ── Config ──────────────────────────────────────────────────────────────────
export const CAPTURE_INTERVALS = [5, 10, 15, 20] as const;
export type CaptureIntervalMinutes = (typeof CAPTURE_INTERVALS)[number];

const DEFAULT_INTERVAL: CaptureIntervalMinutes = 5;
const STORAGE_KEY_INTERVAL = 'rastro-interval';
const LIVE_EVENT = 'location-tracking-update';
const IDB_NAME = 'rastro-db';
const IDB_STORE = 'locations';
const IDB_VERSION = 1;

// Background mode: capture every 2 minutes when minimized
const BG_CAPTURE_MS = 2 * 60_000;

const IP_PROVIDERS = [
  { url: 'https://ipapi.co/json/', extract: (d: any) => ({ lat: d?.latitude, lng: d?.longitude }) },
  { url: 'https://ipwho.is/', extract: (d: any) => ({ lat: d?.latitude, lng: d?.longitude }) },
  { url: 'https://ip-api.com/json/?fields=lat,lon', extract: (d: any) => ({ lat: d?.lat, lng: d?.lon }) },
];

// ── Types ───────────────────────────────────────────────────────────────────
export interface LiveTrackingPoint {
  id?: string;
  usuario_id: string | null;
  latitude: number;
  longitude: number;
  precisao: number | null;
  fonte: string;
  bateria_nivel: number | null;
  em_movimento: boolean;
  criado_em: string;
  endereco?: string | null;
  synced?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function isBrowser() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch {}
}

function distM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── IndexedDB helpers ───────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser() || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('criado_em', 'criado_em', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(point: LiveTrackingPoint): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add(point);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch (e) {
    console.warn('[idb] save failed', e);
  }
}

async function idbGetUnsynced(): Promise<LiveTrackingPoint[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const idx = tx.objectStore(IDB_STORE).index('synced');
    const req = idx.getAll(IDBKeyRange.only(false));
    const result = await new Promise<LiveTrackingPoint[]>((res, rej) => {
      req.onsuccess = () => res(req.result ?? []);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return result;
  } catch {
    return [];
  }
}

async function idbMarkSynced(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        getReq.result.synced = true;
        store.put(getReq.result);
      }
    };
    await new Promise<void>((res) => { tx.oncomplete = () => res(); });
    db.close();
  } catch {}
}

export async function idbGetAll(limit = 200): Promise<LiveTrackingPoint[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const idx = tx.objectStore(IDB_STORE).index('criado_em');
    const req = idx.openCursor(null, 'prev');
    const results: LiveTrackingPoint[] = [];
    await new Promise<void>((resolve) => {
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
    db.close();
    return results;
  } catch {
    return [];
  }
}

// ── Reverse geocoding (Nominatim) ───────────────────────────────────────────
const geocodeCache = new Map<string, string>();

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { signal: controller.signal, headers: { 'Accept-Language': 'pt-BR' } },
    );
    clearTimeout(timeout);
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data.display_name || '';
    geocodeCache.set(key, addr);
    return addr;
  } catch {
    return '';
  }
}

// ── Wake Lock helper ────────────────────────────────────────────────────────
class WakeLockManager {
  private sentinel: any = null;

  async acquire() {
    if (!isBrowser() || !('wakeLock' in navigator)) return;
    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel?.addEventListener('release', () => { this.sentinel = null; });
      console.info('[wakeLock] acquired');
    } catch (e) {
      console.warn('[wakeLock] failed', e);
    }
  }

  release() {
    this.sentinel?.release?.();
    this.sentinel = null;
  }

  get active() { return this.sentinel !== null; }

  // Re-acquire on page re-focus (wake lock releases when tab goes background)
  async reacquire() {
    if (document.visibilityState === 'visible' && !this.sentinel) {
      await this.acquire();
    }
  }
}

// ── Core tracker singleton ──────────────────────────────────────────────────
class Tracker {
  private running = false;
  private watchId: number | null = null;
  private fgIntervalId: ReturnType<typeof setInterval> | null = null;
  private bgTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private cachedUserId: string | null = null;
  private cachedUserExpiry = 0;
  private lastLat: number | null = null;
  private lastLng: number | null = null;
  private lastPersistAt = 0;
  private syncing = false;
  private wakeLock = new WakeLockManager();
  private isBackground = false;

  async start() {
    if (!isBrowser() || this.running) return;
    this.running = true;
    this.isBackground = document.visibilityState === 'hidden';

    await this.wakeLock.acquire();
    this.attachWatch();
    await this.captureOnce(true);
    this.startForegroundLoop();
    this.syncUnsynced();
    this.listenLifecycle();

    console.info('[tracker] started — wake lock:', this.wakeLock.active ? 'ON' : 'OFF');
  }

  stop() {
    this.running = false;
    this.detachWatch();
    this.clearAllTimers();
    this.wakeLock.release();
    console.info('[tracker] stopped');
  }

  restartLoop() {
    this.clearAllTimers();
    if (this.running) {
      if (this.isBackground) {
        this.startBackgroundLoop();
      } else {
        this.startForegroundLoop();
      }
    }
  }

  private clearAllTimers() {
    if (this.fgIntervalId) { clearInterval(this.fgIntervalId); this.fgIntervalId = null; }
    if (this.bgTimeoutId) { clearTimeout(this.bgTimeoutId); this.bgTimeoutId = null; }
  }

  // ── GPS watch (máxima precisão) ──
  private attachWatch() {
    if (this.watchId !== null || !isBrowser() || !('geolocation' in navigator) || !window.isSecureContext) return;
    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => void this.handleCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps'),
        (err) => { if (err.code === 1) this.detachWatch(); void this.captureByIP(); },
        { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
      );
    } catch {
      void this.captureByIP();
    }
  }

  private detachWatch() {
    if (this.watchId !== null && isBrowser() && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // ── Capture once (GPS com múltiplas tentativas → fallback IP) ──
  private async captureOnce(force = false) {
    if (!this.running) return;
    if (!isBrowser() || !('geolocation' in navigator) || !window.isSecureContext) {
      return this.captureByIP(force);
    }

    // Tentar GPS com maximumAge=0 para leitura fresca do chip GPS
    try {
      const pos = await new Promise<GeolocationPosition>((ok, fail) =>
        navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }),
      );

      // Se precisão > 100m, tentar uma segunda leitura (o GPS pode ainda estar aquecendo)
      if (pos.coords.accuracy > 100) {
        try {
          const pos2 = await new Promise<GeolocationPosition>((ok, fail) =>
            navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }),
          );
          // Usar a leitura com melhor precisão
          const best = pos2.coords.accuracy < pos.coords.accuracy ? pos2 : pos;
          await this.handleCoords(best.coords.latitude, best.coords.longitude, best.coords.accuracy, 'gps', force);
          return;
        } catch {
          // Se a segunda falhar, usar a primeira
        }
      }

      await this.handleCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, 'gps', force);
    } catch {
      await this.captureByIP(force);
    }
  }

  // ── IP fallback ──
  private async captureByIP(force = false) {
    if (!this.running) return;
    for (const p of IP_PROVIDERS) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8_000);
        const res = await fetch(p.url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const json = await res.json();
        const c = p.extract(json);
        if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
          await this.handleCoords(c.lat, c.lng, 5000, 'ip', force);
          return;
        }
      } catch { continue; }
    }
  }

  // ── Process coordinates ──
  private async handleCoords(lat: number, lng: number, accuracy: number | null, fonte: string, force = false) {
    if (!this.running || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const now = Date.now();
    const moved = this.lastLat === null || distM(this.lastLat, this.lastLng!, lat, lng) >= 10;
    const elapsed = now - this.lastPersistAt >= 20_000;

    if (!force && !moved && !elapsed) return;

    // Filtro de qualidade: se temos GPS e precisão > 500m, descartar (provável cache ruim)
    if (fonte === 'gps' && accuracy !== null && accuracy > 500) {
      console.info(`[tracker] descartando leitura GPS com precisão ruim: ${accuracy}m`);
      return;
    }

    const userId = await this.getUserId();
    if (!userId) return;

    const battery = await this.getBattery();
    const emMovimento = this.lastLat !== null && distM(this.lastLat, this.lastLng!, lat, lng) >= 5;

    // Mark background captures
    const actualFonte = this.isBackground ? `${fonte}_bg` : fonte;

    const point: LiveTrackingPoint = {
      usuario_id: userId,
      latitude: lat,
      longitude: lng,
      precisao: accuracy,
      fonte: actualFonte,
      bateria_nivel: battery,
      em_movimento: emMovimento,
      criado_em: new Date(now).toISOString(),
      synced: false,
    };

    // Save to IndexedDB first (offline-first)
    await idbSave(point);

    this.lastLat = lat;
    this.lastLng = lng;
    this.lastPersistAt = now;

    // Emit to UI
    window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: point }));

    // Try to sync to Supabase
    await this.persistToSupabase(point);
  }

  private async persistToSupabase(point: LiveTrackingPoint) {
    if (!point.usuario_id) return;
    try {
      const { error } = await supabase.from('localizacoes_usuarios').insert({
        usuario_id: point.usuario_id,
        latitude: point.latitude,
        longitude: point.longitude,
        precisao: point.precisao,
        fonte: point.fonte,
        bateria_nivel: point.bateria_nivel,
        em_movimento: point.em_movimento,
        user_agent: navigator.userAgent,
      });
      if (error) console.warn('[tracker] persist error', error.message);
    } catch (e) {
      console.warn('[tracker] persist failed (offline?)', e);
    }
  }

  // ── Sync unsynced from IndexedDB ──
  async syncUnsynced() {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    try {
      const unsynced = await idbGetUnsynced();
      for (const p of unsynced.slice(0, 50)) {
        if (!p.usuario_id) continue;
        const { error } = await supabase.from('localizacoes_usuarios').insert({
          usuario_id: p.usuario_id,
          latitude: p.latitude,
          longitude: p.longitude,
          precisao: p.precisao,
          fonte: p.fonte,
          bateria_nivel: p.bateria_nivel,
          em_movimento: p.em_movimento,
          user_agent: 'sync',
        });
        if (!error && (p as any).id) {
          await idbMarkSynced((p as any).id);
        }
      }
    } catch {} finally {
      this.syncing = false;
    }
  }

  // ── Foreground loop (normal interval) ──
  private startForegroundLoop() {
    this.fgIntervalId = setInterval(() => void this.captureOnce(true), getCaptureIntervalMs());
  }

  // ── Background loop (aggressive, uses recursive setTimeout to survive browser throttling) ──
  private startBackgroundLoop() {
    const tick = () => {
      if (!this.running || !this.isBackground) return;
      void this.captureOnce(true).then(() => {
        if (this.running && this.isBackground) {
          this.bgTimeoutId = setTimeout(tick, BG_CAPTURE_MS);
        }
      });
    };
    this.bgTimeoutId = setTimeout(tick, BG_CAPTURE_MS);
  }

  // ── Lifecycle ──
  private listenLifecycle() {
    if (!isBrowser()) return;

    document.addEventListener('visibilitychange', () => {
      if (!this.running) return;

      if (document.visibilityState === 'hidden') {
        // App minimized / tab switched
        this.isBackground = true;
        this.clearAllTimers();
        // Immediate capture before going background
        void this.captureOnce(true);
        this.startBackgroundLoop();
        console.info('[tracker] → background mode (2min interval)');
      } else {
        // App returned to foreground
        this.isBackground = false;
        this.clearAllTimers();
        this.attachWatch();
        void this.captureOnce(true);
        void this.syncUnsynced();
        void this.wakeLock.reacquire();
        this.startForegroundLoop();
        console.info('[tracker] → foreground mode');
      }
    });

    // Also capture on page freeze (mobile browsers freeze tabs)
    document.addEventListener('freeze', () => {
      if (this.running) void this.captureOnce(true);
    });

    // Capture before user navigates away
    window.addEventListener('beforeunload', () => {
      if (this.running) void this.captureOnce(true);
    });

    // Re-acquire wake lock when page regains focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.wakeLock.reacquire();
      }
    });

    window.addEventListener('online', () => void this.syncUnsynced());

    // Listen for SW background location messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_LOCATION') {
          const { latitude, longitude, fonte } = event.data;
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            void this.handleCoords(latitude, longitude, 5000, fonte || 'sw_bg', true);
          }
        }
      });
    }
  }

  // ── User ID resolution ──
  private async getUserId(): Promise<string | null> {
    if (this.cachedUserId && Date.now() < this.cachedUserExpiry) return this.cachedUserId;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('hierarquia_usuarios')
        .select('id').eq('auth_user_id', user.id).neq('ativo', false).limit(1);
      const id = data?.[0]?.id ?? null;
      if (id) { this.cachedUserId = id; this.cachedUserExpiry = Date.now() + 5 * 60_000; }
      return id;
    } catch { return null; }
  }

  private async getBattery(): Promise<number | null> {
    try {
      const b = await (navigator as any).getBattery?.();
      return b ? Math.round(b.level * 100) : null;
    } catch { return null; }
  }
}

// ── Singleton & exports ─────────────────────────────────────────────────────
const tracker = new Tracker();

export function getLiveTrackingEventName() { return LIVE_EVENT; }

export function getCaptureIntervalMinutes(): CaptureIntervalMinutes {
  const v = Number(safeGet(STORAGE_KEY_INTERVAL));
  return CAPTURE_INTERVALS.includes(v as CaptureIntervalMinutes) ? (v as CaptureIntervalMinutes) : DEFAULT_INTERVAL;
}

export function getCaptureIntervalMs() {
  return getCaptureIntervalMinutes() * 60_000;
}

export async function setCaptureIntervalMinutes(minutes: CaptureIntervalMinutes) {
  if (!CAPTURE_INTERVALS.includes(minutes)) return;
  safeSet(STORAGE_KEY_INTERVAL, String(minutes));
  tracker.restartLoop();
}

export function registerBackgroundSync() {
  if (!isBrowser() || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if ('sync' in reg) (reg as any).sync.register('sync-location').catch(() => {});
    if ('periodicSync' in reg) (reg as any).periodicSync.register('location-sync', { minInterval: getCaptureIntervalMs() }).catch(() => {});
  }).catch(() => {});
}

export function startLocationTracking() { void tracker.start(); }
export function stopLocationTracking() { tracker.stop(); }
