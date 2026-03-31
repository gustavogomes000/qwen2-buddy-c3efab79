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
const GEOLOCATION_FALLBACK_COOLDOWN_MS = 20_000;

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

const IP_PROVIDERS = [
  { url: 'https://ipapi.co/json/', extract: (data: any) => ({ lat: data?.latitude, lng: data?.longitude }) },
  { url: 'https://ipwho.is/', extract: (data: any) => ({ lat: data?.latitude, lng: data?.longitude }) },
  { url: 'https://ip-api.com/json/?fields=lat,lon', extract: (data: any) => ({ lat: data?.lat, lng: data?.lon }) },
];

function isBrowserEnvironment() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function isValidCaptureInterval(value: unknown): value is CaptureIntervalMinutes {
  return CAPTURE_INTERVALS.includes(Number(value) as CaptureIntervalMinutes);
}

function safeStorageGet(key: string): string | null {
  if (!isBrowserEnvironment()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  if (!isBrowserEnvironment()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
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

class LocationTrackerSingleton {
  private started = false;
  private watchId: number | null = null;
  private persistIntervalId: ReturnType<typeof setInterval> | null = null;

  private visibilityHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private blurHandler: (() => void) | null = null;
  private backgroundLocationHandler: ((event: Event) => void) | null = null;

  private lastPersistAt = 0;
  private lastPersistLat: number | null = null;
  private lastPersistLng: number | null = null;
  private lastUiEmitAt = 0;
  private lastUiLat: number | null = null;
  private lastUiLng: number | null = null;

  private lastKnownCoords: CoordinatesPayload | null = null;
  private lastKnownSource: LocationSource = 'gps';
  private lastGeolocationFallbackAt = 0;

  private cachedUsuarioId: string | null = null;
  private cachedUsuarioIdExpiry = 0;

  private isBrowser() {
    return isBrowserEnvironment();
  }

  private hasGeolocation() {
    return this.isBrowser() && 'geolocation' in navigator;
  }

  private hasSecureGeolocation() {
    return this.hasGeolocation() && window.isSecureContext;
  }

  private resetRuntimeState() {
    this.lastPersistAt = 0;
    this.lastPersistLat = null;
    this.lastPersistLng = null;
    this.lastUiEmitAt = 0;
    this.lastUiLat = null;
    this.lastUiLng = null;
    this.lastKnownCoords = null;
    this.lastKnownSource = 'gps';
    this.lastGeolocationFallbackAt = 0;
  }

  private resetCachedUsuarioId() {
    this.cachedUsuarioId = null;
    this.cachedUsuarioIdExpiry = 0;
  }

  private readCachedPoint(): LiveTrackingPoint | null {
    try {
      const raw = safeStorageGet(LAST_LOCATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LiveTrackingPoint;
      if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private emitLiveTrackingUpdate(point: LiveTrackingPoint) {
    if (!this.isBrowser()) return;

    safeStorageSet(LAST_LOCATION_STORAGE_KEY, JSON.stringify(point));
    window.dispatchEvent(new CustomEvent(LIVE_TRACKING_EVENT, { detail: point }));

    this.lastUiEmitAt = Date.now();
    this.lastUiLat = point.latitude;
    this.lastUiLng = point.longitude;
  }

  private async getBatteryLevel(): Promise<number | null> {
    if (!this.isBrowser()) return null;

    try {
      const battery = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.();
      return battery ? Math.round(battery.level * 100) : null;
    } catch {
      return null;
    }
  }

  private async getUsuarioId(forceRefresh = false): Promise<string | null> {
    const now = Date.now();

    if (!forceRefresh && this.cachedUsuarioId && now < this.cachedUsuarioIdExpiry) {
      return this.cachedUsuarioId;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        this.resetCachedUsuarioId();
        return null;
      }

      const { data, error } = await supabase
        .from('hierarquia_usuarios')
        .select('id, criado_em')
        .eq('auth_user_id', user.id)
        .neq('ativo', false)
        .order('criado_em', { ascending: false })
        .limit(1);

      const selected = data?.[0]?.id ?? null;

      if (error || !selected) {
        this.resetCachedUsuarioId();
        console.warn('[locationTracker] usuário sem vínculo ativo para rastreio', error?.message ?? user.id);
        return null;
      }

      this.cachedUsuarioId = selected;
      this.cachedUsuarioIdExpiry = now + USER_ID_CACHE_TTL_MS;
      return this.cachedUsuarioId;
    } catch (error) {
      this.resetCachedUsuarioId();
      console.error('[locationTracker] falha ao resolver usuário de rastreio', error);
      return null;
    }
  }

  private async persistLocation(payload: LocationInsert) {
    let { error } = await supabase.from('localizacoes_usuarios').insert(payload);
    if (!error) return true;

    this.resetCachedUsuarioId();
    const refreshedUsuarioId = await this.getUsuarioId(true);

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

    this.cachedUsuarioId = refreshedUsuarioId;
    this.cachedUsuarioIdExpiry = Date.now() + USER_ID_CACHE_TTL_MS;
    return true;
  }

  private shouldEmitToUi(now: number, lat: number, lng: number, forcePersist: boolean) {
    if (forcePersist) return true;
    const movedEnough = movedBeyond(this.lastUiLat, this.lastUiLng, lat, lng, UI_MOVE_THRESHOLD_METERS);
    return movedEnough || now - this.lastUiEmitAt >= UI_EMIT_THROTTLE_MS;
  }

  private shouldPersistToDb(now: number, lat: number, lng: number, forcePersist: boolean) {
    if (forcePersist || this.lastPersistAt === 0) return true;
    if (now - this.lastPersistAt < WATCH_PERSIST_COOLDOWN_MS) return false;
    return movedBeyond(this.lastPersistLat, this.lastPersistLng, lat, lng, DB_MOVE_THRESHOLD_METERS);
  }

  private isPermissionDenied(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeCode = (error as { code?: number }).code;
    return maybeCode === 1;
  }

  private async processLocation(
    coords: CoordinatesPayload,
    fonte: LocationSource,
    forcePersist = false,
  ) {
    if (!this.started) return false;
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return false;

    const now = Date.now();
    const usuarioId = await this.getUsuarioId();

    if (!usuarioId) {
      console.warn('[locationTracker] rastreio ignorado: usuário não encontrado');
      return false;
    }

    const bateria = await this.getBatteryLevel();
    const emMovimento = movedBeyond(this.lastPersistLat, this.lastPersistLng, coords.lat, coords.lng, 10);

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

    this.lastKnownCoords = coords;
    this.lastKnownSource = fonte;

    if (this.shouldEmitToUi(now, coords.lat, coords.lng, forcePersist)) {
      this.emitLiveTrackingUpdate(point);
    }

    if (!this.shouldPersistToDb(now, coords.lat, coords.lng, forcePersist)) {
      return true;
    }

    const persisted = await this.persistLocation({
      usuario_id: usuarioId,
      latitude: coords.lat,
      longitude: coords.lng,
      precisao: coords.accuracy,
      fonte,
      bateria_nivel: bateria,
      em_movimento: emMovimento,
      user_agent: this.isBrowser() ? navigator.userAgent : 'unknown',
    });

    if (!persisted) return false;

    this.lastPersistAt = now;
    this.lastPersistLat = coords.lat;
    this.lastPersistLng = coords.lng;
    this.emitLiveTrackingUpdate({ ...point, pending: false });

    return true;
  }

  private async captureByIP(forcePersist = false, fonte: LocationSource = 'ip') {
    if (!this.isBrowser() || !this.started) return false;

    for (const provider of IP_PROVIDERS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        const response = await fetch(provider.url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const json = await response.json();
        const coords = provider.extract(json);
        const lat = Number(coords.lat);
        const lng = Number(coords.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        return this.processLocation({ lat, lng, accuracy: 5_000 }, fonte, forcePersist);
      } catch {
        continue;
      }
    }

    return false;
  }

  private async handleGeolocationError(error: unknown, forcePersist: boolean) {
    const now = Date.now();

    if (this.isPermissionDenied(error) || now - this.lastGeolocationFallbackAt >= GEOLOCATION_FALLBACK_COOLDOWN_MS) {
      this.lastGeolocationFallbackAt = now;
      return this.captureByIP(forcePersist, 'ip');
    }

    return false;
  }

  private async captureGPSOnce(forcePersist = false) {
    if (!this.started) return false;

    if (!this.hasSecureGeolocation()) {
      return this.captureByIP(forcePersist, 'ip');
    }

    try {
      const coords = await new Promise<CoordinatesPayload>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy ?? null,
            });
          },
          (error) => reject(error),
          {
            enableHighAccuracy: true,
            timeout: 12_000,
            maximumAge: 1_000,
          },
        );
      });

      return this.processLocation(coords, 'gps', forcePersist);
    } catch (error) {
      return this.handleGeolocationError(error, forcePersist);
    }
  }

  private async isPermissionDeniedByBrowser() {
    if (!this.hasSecureGeolocation()) return true;

    if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
      return false;
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state === 'denied';
    } catch {
      return false;
    }
  }

  private attachWatch() {
    if (!this.started || this.watchId !== null || !this.hasSecureGeolocation()) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        void this.processLocation(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
          },
          'gps',
          false,
        );
      },
      (error) => {
        void this.handleGeolocationError(error, false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 5_000,
      },
    );
  }

  private detachWatch() {
    if (!this.hasGeolocation() || this.watchId === null) return;
    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  private restartPersistLoop() {
    if (this.persistIntervalId) {
      clearInterval(this.persistIntervalId);
      this.persistIntervalId = null;
    }

    if (!this.started) return;

    this.persistIntervalId = setInterval(() => {
      void this.flushTick();
    }, getCaptureIntervalMs());
  }

  private async flushTick() {
    if (!this.started) return;

    if (this.lastKnownCoords) {
      await this.processLocation(this.lastKnownCoords, this.lastKnownSource, true);
      return;
    }

    await this.captureGPSOnce(true);
  }

  private registerLifecycleListeners() {
    if (!this.isBrowser()) return;

    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (!this.started) return;

        if (document.visibilityState === 'visible') {
          this.attachWatch();
          void this.captureGPSOnce(true);
          return;
        }

        this.detachWatch();
      };

      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    if (!this.focusHandler) {
      this.focusHandler = () => {
        if (!this.started) return;
        this.attachWatch();
        void this.captureGPSOnce(true);
      };
      window.addEventListener('focus', this.focusHandler);
    }

    if (!this.blurHandler) {
      this.blurHandler = () => {
        if (!this.started) return;
        this.detachWatch();
      };
      window.addEventListener('blur', this.blurHandler);
    }
  }

  private unregisterLifecycleListeners() {
    if (!this.isBrowser()) return;

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
      this.focusHandler = null;
    }

    if (this.blurHandler) {
      window.removeEventListener('blur', this.blurHandler);
      this.blurHandler = null;
    }
  }

  private registerBackgroundLocationListener() {
    if (!this.isBrowser() || this.backgroundLocationHandler) return;

    this.backgroundLocationHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const lat = Number(detail?.latitude);
      const lng = Number(detail?.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      void this.processLocation(
        { lat, lng, accuracy: 5_000 },
        detail?.fonte ?? 'ip_background',
        true,
      );
    };

    window.addEventListener('background-location', this.backgroundLocationHandler);
  }

  private unregisterBackgroundLocationListener() {
    if (!this.isBrowser() || !this.backgroundLocationHandler) return;
    window.removeEventListener('background-location', this.backgroundLocationHandler);
    this.backgroundLocationHandler = null;
  }

  async start() {
    if (!this.isBrowser() || this.started) return;

    this.stop();
    this.started = true;
    this.resetRuntimeState();

    const cached = this.readCachedPoint();
    if (cached) {
      this.lastKnownCoords = {
        lat: cached.latitude,
        lng: cached.longitude,
        accuracy: cached.precisao,
      };
      this.lastKnownSource = cached.fonte;
      this.emitLiveTrackingUpdate(cached);
    }

    this.registerBackgroundLocationListener();
    this.registerLifecycleListeners();

    const denied = await this.isPermissionDeniedByBrowser();
    if (!denied) {
      this.attachWatch();
    }

    await this.captureGPSOnce(true);
    this.restartPersistLoop();

    console.info('[locationTracker] rastreio iniciado');
  }

  stop() {
    this.started = false;

    this.detachWatch();

    if (this.persistIntervalId) {
      clearInterval(this.persistIntervalId);
      this.persistIntervalId = null;
    }

    this.unregisterBackgroundLocationListener();
    this.unregisterLifecycleListeners();
    this.resetCachedUsuarioId();
    this.resetRuntimeState();

    if (this.isBrowser()) {
      console.info('[locationTracker] rastreio parado');
    }
  }

  async onCaptureIntervalChanged() {
    this.restartPersistLoop();
  }
}

const tracker = new LocationTrackerSingleton();

export function getLiveTrackingEventName() {
  return LIVE_TRACKING_EVENT;
}

export function getCaptureIntervalMinutes(): CaptureIntervalMinutes {
  const stored = Number(safeStorageGet(CAPTURE_INTERVAL_STORAGE_KEY));
  return isValidCaptureInterval(stored) ? stored : DEFAULT_CAPTURE_INTERVAL;
}

export function getCaptureIntervalMs() {
  return getCaptureIntervalMinutes() * 60_000;
}

async function updatePeriodicSyncInterval() {
  if (!isBrowserEnvironment()) return;
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

export async function setCaptureIntervalMinutes(minutes: CaptureIntervalMinutes) {
  if (!isValidCaptureInterval(minutes)) return;

  safeStorageSet(CAPTURE_INTERVAL_STORAGE_KEY, String(minutes));
  await tracker.onCaptureIntervalChanged();
  await updatePeriodicSyncInterval();
}

export function registerBackgroundSync() {
  if (!isBrowserEnvironment()) return;
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
  void tracker.start();
}

export function stopLocationTracking() {
  tracker.stop();
}
