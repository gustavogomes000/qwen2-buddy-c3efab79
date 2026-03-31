import { supabase } from '@/integrations/supabase/client';

export const CAPTURE_INTERVALS = [5, 10, 15, 20] as const;
export type CaptureIntervalMinutes = (typeof CAPTURE_INTERVALS)[number];

const DEFAULT_CAPTURE_INTERVAL: CaptureIntervalMinutes = 5;
const CAPTURE_INTERVAL_STORAGE_KEY = 'rastro-capture-interval';
const LAST_LOCATION_STORAGE_KEY = 'rastro-last-location-v2';
const LIVE_TRACKING_EVENT = 'location-tracking-update';
const USER_ID_CACHE_TTL_MS = 5 * 60_000;
const UI_EMIT_THROTTLE_MS = 1_500;
const UI_MOVE_THRESHOLD_METERS = 3;
const WATCH_PERSIST_COOLDOWN_MS = 2_000;
const DB_MOVE_THRESHOLD_METERS = 30;

type LocationSource = 'gps' | 'ip' | 'ip_background' | string;

interface CoordinatesPayload {
  lat: number;
  lng: number;
  accuracy: number | null;
}

interface LocationInsert {
  usuario_id: string;
  latitude: number;
  longitude: number;
  precisao: number | null;
  fonte: LocationSource;
  bateria_nivel: number | null;
  em_movimento: boolean;
  user_agent: string;
}

export interface LiveTrackingPoint {
  usuario_id: string | null;
  latitude: number;
  longitude: number;
  precisao: number | null;
  fonte: LocationSource;
  bateria_nivel: number | null;
  em_movimento: boolean;
  criado_em: string;
  pending?: boolean;
}

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isTrackingActive = false;
let lastPersistAt = 0;
let lastPersistLat: number | null = null;
let lastPersistLng: number | null = null;
let lastUiEmitAt = 0;
let lastUiLat: number | null = null;
let lastUiLng: number | null = null;
let cachedUsuarioId: string | null = null;
let cachedUsuarioIdExpiry = 0;
let backgroundLocationHandler: ((event: Event) => void) | null = null;
let visibilityHandler: (() => void) | null = null;

function resetRuntimeState() {
  lastPersistAt = 0;
  lastPersistLat = null;
  lastPersistLng = null;
  lastUiEmitAt = 0;
  lastUiLat = null;
  lastUiLng = null;
}

function resetCachedUsuarioId() {
  cachedUsuarioId = null;
  cachedUsuarioIdExpiry = 0;
}

function isValidCaptureInterval(value: unknown): value is CaptureIntervalMinutes {
  return CAPTURE_INTERVALS.includes(Number(value) as CaptureIntervalMinutes);
}

export function getLiveTrackingEventName() {
  return LIVE_TRACKING_EVENT;
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

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function movedBeyond(
  fromLat: number | null,
  fromLng: number | null,
  toLat: number,
  toLng: number,
  thresholdMeters: number,
) {
  if (fromLat === null || fromLng === null) return true;
  return distanceMeters(fromLat, fromLng, toLat, toLng) >= thresholdMeters;
}

function readCachedPoint(): LiveTrackingPoint | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveTrackingPoint;

    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function emitLiveTrackingUpdate(point: LiveTrackingPoint) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify(point));
  window.dispatchEvent(new CustomEvent(LIVE_TRACKING_EVENT, { detail: point }));
  lastUiEmitAt = Date.now();
  lastUiLat = point.latitude;
  lastUiLng = point.longitude;
}

async function getBatteryLevel(): Promise<number | null> {
  try {
    const battery = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.();
    return battery ? Math.round(battery.level * 100) : null;
  } catch {
    return null;
  }
}

async function getUsuarioId(forceRefresh = false): Promise<string | null> {
  const now = Date.now();

  if (!forceRefresh && cachedUsuarioId && now < cachedUsuarioIdExpiry) {
    return cachedUsuarioId;
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      resetCachedUsuarioId();
      return null;
    }

    const { data, error } = await supabase
      .from('hierarquia_usuarios')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('ativo', true)
      .maybeSingle();

    if (error || !data?.id) {
      resetCachedUsuarioId();
      console.warn('[locationTracker] usuário sem vínculo ativo para rastreio', error?.message ?? user.id);
      return null;
    }

    cachedUsuarioId = data.id;
    cachedUsuarioIdExpiry = now + USER_ID_CACHE_TTL_MS;
    return cachedUsuarioId;
  } catch (error) {
    console.error('[locationTracker] falha ao resolver usuário de rastreio', error);
    resetCachedUsuarioId();
    return null;
  }
}

async function persistLocation(payload: LocationInsert) {
  let { error } = await supabase.from('localizacoes_usuarios').insert(payload);
  if (!error) return true;

  resetCachedUsuarioId();
  const refreshedUsuarioId = await getUsuarioId(true);

  if (!refreshedUsuarioId) {
    console.error('[locationTracker] falha ao persistir localização (sem usuário válido)', error);
    return false;
  }

  const retry = await supabase
    .from('localizacoes_usuarios')
    .insert({ ...payload, usuario_id: refreshedUsuarioId });

  if (retry.error) {
    console.error('[locationTracker] erro ao persistir localização', retry.error);
    return false;
  }

  cachedUsuarioId = refreshedUsuarioId;
  cachedUsuarioIdExpiry = Date.now() + USER_ID_CACHE_TTL_MS;
  return true;
}

function shouldEmitToUi(now: number, lat: number, lng: number, forcePersist: boolean) {
  if (forcePersist) return true;
  const movedEnough = movedBeyond(lastUiLat, lastUiLng, lat, lng, UI_MOVE_THRESHOLD_METERS);
  return movedEnough || now - lastUiEmitAt >= UI_EMIT_THROTTLE_MS;
}

function shouldPersistToDb(now: number, lat: number, lng: number, forcePersist: boolean) {
  if (forcePersist || lastPersistAt === 0) return true;
  if (now - lastPersistAt < WATCH_PERSIST_COOLDOWN_MS) return false;
  return movedBeyond(lastPersistLat, lastPersistLng, lat, lng, DB_MOVE_THRESHOLD_METERS);
}

async function processLocation(
  coords: CoordinatesPayload,
  fonte: LocationSource,
  forcePersist = false,
) {
  if (!isTrackingActive) return false;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;

  const now = Date.now();
  const usuarioId = await getUsuarioId();

  if (!usuarioId) {
    console.warn('[locationTracker] rastreio ignorado: usuário não encontrado');
    return false;
  }

  const bateria = await getBatteryLevel();
  const emMovimento = movedBeyond(lastPersistLat, lastPersistLng, coords.lat, coords.lng, 10);
  const point: LiveTrackingPoint = {
    usuario_id: usuarioId,
    latitude: coords.lat,
    longitude: coords.lng,
    precisao: coords.accuracy,
    fonte,
    bateria_nivel: bateria,
    em_movimento: emMovimento,
    criado_em: new Date(now).toISOString(),
    pending: true,
  };

  if (shouldEmitToUi(now, coords.lat, coords.lng, forcePersist)) {
    emitLiveTrackingUpdate(point);
  }

  if (!shouldPersistToDb(now, coords.lat, coords.lng, forcePersist)) {
    return true;
  }

  const persisted = await persistLocation({
    usuario_id: usuarioId,
    latitude: coords.lat,
    longitude: coords.lng,
    precisao: coords.accuracy,
    fonte,
    bateria_nivel: bateria,
    em_movimento: emMovimento,
    user_agent: navigator.userAgent,
  });

  if (!persisted) return false;

  lastPersistAt = now;
  lastPersistLat = coords.lat;
  lastPersistLng = coords.lng;
  emitLiveTrackingUpdate({ ...point, pending: false });
  return true;
}

const IP_PROVIDERS = [
  { url: 'https://ipapi.co/json/', extract: (data: any) => ({ lat: data?.latitude, lng: data?.longitude }) },
  { url: 'https://ipwho.is/', extract: (data: any) => ({ lat: data?.latitude, lng: data?.longitude }) },
  { url: 'https://ip-api.com/json/?fields=lat,lon', extract: (data: any) => ({ lat: data?.lat, lng: data?.lon }) },
];

async function captureByIP(forcePersist = false, fonte: LocationSource = 'ip') {
  for (const provider of IP_PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(provider.url, { signal: controller.signal });
      window.clearTimeout(timeout);

      if (!response.ok) continue;

      const json = await response.json();
      const coords = provider.extract(json);
      const lat = Number(coords.lat);
      const lng = Number(coords.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      await processLocation({ lat, lng, accuracy: 5_000 }, fonte, forcePersist);
      return;
    } catch {
      continue;
    }
  }
}

function captureGPS(forcePersist = false) {
  if (!('geolocation' in navigator)) {
    void captureByIP(forcePersist, 'ip');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      void processLocation(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        },
        'gps',
        forcePersist,
      );
    },
    () => {
      void captureByIP(forcePersist, 'ip');
    },
    {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 1_000,
    },
  );
}

function restartCaptureLoop() {
  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(() => {
    if (!isTrackingActive) return;
    captureGPS(true);
  }, getCaptureIntervalMs());
}

function registerVisibilityListener() {
  if (typeof document === 'undefined' || visibilityHandler) return;

  visibilityHandler = () => {
    if (document.visibilityState === 'visible' && isTrackingActive) {
      captureGPS(true);
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);
}

function unregisterVisibilityListener() {
  if (typeof document === 'undefined' || !visibilityHandler) return;
  document.removeEventListener('visibilitychange', visibilityHandler);
  visibilityHandler = null;
}

function registerBackgroundLocationListener() {
  if (typeof window === 'undefined' || backgroundLocationHandler) return;

  backgroundLocationHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const lat = Number(detail?.latitude);
    const lng = Number(detail?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    void processLocation(
      { lat, lng, accuracy: 5_000 },
      detail?.fonte ?? 'ip_background',
      true,
    );
  };

  window.addEventListener('background-location', backgroundLocationHandler);
}

function unregisterBackgroundLocationListener() {
  if (typeof window === 'undefined' || !backgroundLocationHandler) return;
  window.removeEventListener('background-location', backgroundLocationHandler);
  backgroundLocationHandler = null;
}

async function updatePeriodicSyncInterval() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('periodicSync' in registration) {
      await (registration as any).periodicSync.register('location-sync', {
        minInterval: getCaptureIntervalMs(),
      });
    }
  } catch {
    // Browser may block this API.
  }
}

export function registerBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready
    .then((registration) => {
      return Promise.allSettled([
        typeof (registration as any).sync?.register === 'function'
          ? (registration as any).sync.register('sync-location')
          : Promise.resolve(),
        typeof (registration as any).periodicSync?.register === 'function'
          ? (registration as any).periodicSync.register('location-sync', {
              minInterval: getCaptureIntervalMs(),
            })
          : Promise.resolve(),
      ]);
    })
    .catch(() => {
      // Ignore unsupported service worker sync APIs.
    });
}

export function startLocationTracking() {
  stopLocationTracking();
  isTrackingActive = true;
  resetRuntimeState();

  const cached = readCachedPoint();
  if (cached) {
    emitLiveTrackingUpdate(cached);
  }

  registerBackgroundLocationListener();
  registerVisibilityListener();

  captureGPS(true);

  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        void processLocation(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
          },
          'gps',
          false,
        );
      },
      () => {
        void captureByIP(false, 'ip');
      },
      {
        enableHighAccuracy: true,
        timeout: 5_000,
        maximumAge: 1_000,
      },
    );
  }

  restartCaptureLoop();
}

export function stopLocationTracking() {
  isTrackingActive = false;

  if (watchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  unregisterBackgroundLocationListener();
  unregisterVisibilityListener();
  resetCachedUsuarioId();
  resetRuntimeState();
}
