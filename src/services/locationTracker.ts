import { supabase } from '@/integrations/supabase/client';

// ─── CONFIG ────────────────────────────────────────────────────────
export const CAPTURE_INTERVALS = [5, 10, 15, 20] as const;
export type CaptureIntervalMinutes = (typeof CAPTURE_INTERVALS)[number];

const DEFAULT_CAPTURE_INTERVAL: CaptureIntervalMinutes = 5;
const CAPTURE_INTERVAL_STORAGE_KEY = 'rastro-capture-interval';
const MOVEMENT_THRESHOLD_METERS = 50;

// ─── STATE ─────────────────────────────────────────────────────────
let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSentTimestamp = 0;
let lastSentLat = 0;
let lastSentLng = 0;
let isTrackingActive = false;
let backgroundLocationHandler: ((event: Event) => void) | null = null;
let visibilityHandler: (() => void) | null = null;
let cachedUsuarioId: string | null = null;
let cachedUsuarioIdExpiry = 0;

// ─── INTERVAL HELPERS ──────────────────────────────────────────────
function isValidCaptureInterval(value: unknown): value is CaptureIntervalMinutes {
  return CAPTURE_INTERVALS.includes(Number(value) as CaptureIntervalMinutes);
}

export function getCaptureIntervalMinutes(): CaptureIntervalMinutes {
  if (typeof window === 'undefined') return DEFAULT_CAPTURE_INTERVAL;
  const stored = Number(window.localStorage.getItem(CAPTURE_INTERVAL_STORAGE_KEY));
  return isValidCaptureInterval(stored) ? stored : DEFAULT_CAPTURE_INTERVAL;
}

export function getCaptureIntervalMs() {
  return getCaptureIntervalMinutes() * 60_000;
}

export async function setCaptureIntervalMinutes(minutes: CaptureIntervalMinutes) {
  if (!isValidCaptureInterval(minutes)) return;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CAPTURE_INTERVAL_STORAGE_KEY, String(minutes));
  }
  if (isTrackingActive) restartCaptureLoop();
  await updatePeriodicSyncInterval();
}

// ─── USUARIO ID (cached for 5min) ─────────────────────────────────
async function getUsuarioId(): Promise<string | null> {
  const now = Date.now();
  if (cachedUsuarioId && now < cachedUsuarioIdExpiry) return cachedUsuarioId;
  try {
    const { data } = await supabase.rpc('get_meu_usuario_id');
    cachedUsuarioId = data as string | null;
    cachedUsuarioIdExpiry = now + 5 * 60_000;
    return cachedUsuarioId;
  } catch {
    return cachedUsuarioId;
  }
}

// ─── DISTANCE CALC (Haversine) ─────────────────────────────────────
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── BATTERY ───────────────────────────────────────────────────────
async function getBatteryLevel(): Promise<number | null> {
  try {
    const batt = await (navigator as any).getBattery?.();
    return batt ? Math.round(batt.level * 100) : null;
  } catch { return null; }
}

// ─── SEND LOCATION ────────────────────────────────────────────────
async function sendLocation(
  lat: number,
  lng: number,
  accuracy: number,
  fonte: string,
  force = false
) {
  const now = Date.now();
  const interval = getCaptureIntervalMs();
  const timeSinceLast = now - lastSentTimestamp;

  // Skip if too soon, UNLESS forced or moved significantly
  if (!force && timeSinceLast < interval) {
    // But still send if moved significantly (real-time movement detection)
    if (lastSentLat !== 0 && lastSentLng !== 0) {
      const dist = distanceMeters(lastSentLat, lastSentLng, lat, lng);
      if (dist < MOVEMENT_THRESHOLD_METERS) return;
    } else {
      return;
    }
  }

  const usuarioId = await getUsuarioId();
  if (!usuarioId) return;

  const bateria = await getBatteryLevel();
  const emMovimento = lastSentLat !== 0 && lastSentLng !== 0
    ? distanceMeters(lastSentLat, lastSentLng, lat, lng) > 10
    : false;

  lastSentTimestamp = now;
  lastSentLat = lat;
  lastSentLng = lng;

  await supabase.from('localizacoes_usuarios').insert({
    usuario_id: usuarioId,
    latitude: lat,
    longitude: lng,
    precisao: accuracy,
    fonte,
    user_agent: navigator.userAgent,
    bateria_nivel: bateria,
    em_movimento: emMovimento,
  } as any);
}

// ─── GPS CAPTURE ───────────────────────────────────────────────────
function captureGPS(force = false) {
  if (!navigator.geolocation) {
    captureByIP(force);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      sendLocation(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.accuracy,
        'gps',
        force
      );
    },
    () => {
      // GPS denied/failed → fallback to IP
      captureByIP(force);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

// ─── IP FALLBACK (multiple providers) ──────────────────────────────
const IP_PROVIDERS = [
  { url: 'https://ipapi.co/json/', extract: (d: any) => ({ lat: d.latitude, lng: d.longitude }) },
  { url: 'https://ipwho.is/', extract: (d: any) => ({ lat: d.latitude, lng: d.longitude }) },
  { url: 'https://ip-api.com/json/?fields=lat,lon', extract: (d: any) => ({ lat: d.lat, lng: d.lon }) },
];

async function captureByIP(force = false) {
  for (const provider of IP_PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(provider.url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const data = await res.json();
      const coords = provider.extract(data);

      if (coords.lat && coords.lng && Number.isFinite(Number(coords.lat))) {
        await sendLocation(Number(coords.lat), Number(coords.lng), 5000, 'ip', force);
        return;
      }
    } catch {
      continue;
    }
  }
}

// ─── CAPTURE LOOP ──────────────────────────────────────────────────
function restartCaptureLoop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => captureGPS(), getCaptureIntervalMs());
}

// ─── VISIBILITY CHANGE (capture when app resumes) ──────────────────
function registerVisibilityListener() {
  if (typeof document === 'undefined' || visibilityHandler) return;
  visibilityHandler = () => {
    if (document.visibilityState === 'visible' && isTrackingActive) {
      captureGPS(true); // Force send when user returns to app
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

function unregisterVisibilityListener() {
  if (typeof document === 'undefined' || !visibilityHandler) return;
  document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = null;
}

// ─── BACKGROUND LOCATION (Service Worker) ──────────────────────────
function registerBackgroundLocationListener() {
  if (typeof window === 'undefined' || backgroundLocationHandler) return;
  backgroundLocationHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const latitude = Number(detail?.latitude);
    const longitude = Number(detail?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    void sendLocation(latitude, longitude, 5000, detail?.fonte ?? 'ip_background', true);
  };
  window.addEventListener('background-location', backgroundLocationHandler);
}

function unregisterBackgroundLocationListener() {
  if (typeof window === 'undefined' || !backgroundLocationHandler) return;
  window.removeEventListener('background-location', backgroundLocationHandler);
  backgroundLocationHandler = null;
}

// ─── SERVICE WORKER SYNC ───────────────────────────────────────────
async function updatePeriodicSyncInterval() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      await (reg as any).periodicSync.register('location-sync', {
        minInterval: getCaptureIntervalMs(),
      });
    }
  } catch {}
}

export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((reg) => {
      return Promise.allSettled([
        (reg as any).sync?.register('sync-location'),
        'periodicSync' in reg
          ? (reg as any).periodicSync?.register('location-sync', {
              minInterval: getCaptureIntervalMs(),
            })
          : Promise.resolve(),
      ]);
    }).catch(() => {});
  }
}

// ─── START / STOP ──────────────────────────────────────────────────
export function startLocationTracking() {
  stopLocationTracking();
  isTrackingActive = true;

  registerBackgroundLocationListener();
  registerVisibilityListener();

  // Immediate first capture (forced)
  captureGPS(true);

  // Watch position for real-time movement detection
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          'gps'
        );
      },
      () => captureByIP(),
      { enableHighAccuracy: true, maximumAge: 60000 }
    );
  }

  // Periodic capture (interval-based)
  restartCaptureLoop();
}

export function stopLocationTracking() {
  isTrackingActive = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  unregisterBackgroundLocationListener();
  unregisterVisibilityListener();
}
