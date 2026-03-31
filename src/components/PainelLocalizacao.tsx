import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CAPTURE_INTERVALS, getCaptureIntervalMinutes, getLiveTrackingEventName, setCaptureIntervalMinutes, type CaptureIntervalMinutes, type LiveTrackingPoint } from '@/services/locationTracker';
import { MapPin, Clock, Battery, Wifi, ChevronDown, ChevronUp, RefreshCw, Loader2, Navigation, Map, List, Route } from 'lucide-react';

// Lazy-load Leaflet and react-leaflet to prevent top-level crashes
let leafletLib: any = null;
let reactLeafletModule: any = null;
let leafletReady = false;

async function ensureLeaflet() {
  if (leafletReady) return;
  try {
    const [lMod, rlMod] = await Promise.all([
      import('leaflet'),
      import('react-leaflet'),
    ]);
    await import('leaflet/dist/leaflet.css');
    leafletLib = lMod.default ?? lMod;
    reactLeafletModule = rlMod;
    delete (leafletLib.Icon.Default.prototype as any)._getIconUrl;
    leafletLib.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
    leafletReady = true;
  } catch (err) {
    console.error('[PainelLocalizacao] Failed to load leaflet', err);
  }
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function createUserIcon(initial: string, color: string) {
  if (!leafletLib) return undefined as any;
  const L = leafletLib;
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${initial}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createDotIcon(color: string) {
  if (!leafletLib) return undefined as any;
  const L = leafletLib;
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:8px;height:8px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

interface LocationRecord {
  id: string;
  usuario_id: string;
  latitude: number;
  longitude: number;
  precisao: number | null;
  fonte: string | null;
  bateria_nivel: number | null;
  em_movimento: boolean;
  criado_em: string;
  pending?: boolean;
}

interface UserLocationGroup {
  usuario_id: string;
  nome: string;
  tipo: string;
  locations: LocationRecord[];
  lastLocation: LocationRecord;
  color: string;
}

function FitBounds({ bounds }: { bounds: any | null }) {
  const map = reactLeafletModule!.useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [bounds, map]);
  return null;
}

type DateFilter = '24h' | '48h' | '7d' | '30d' | 'all';

const DATE_FILTER_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '48h', label: '48h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'all', label: 'Tudo' },
];

function getDateFilterISO(filter: DateFilter): string | null {
  const now = new Date();
  switch (filter) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    case '48h': return new Date(now.getTime() - 48 * 60 * 60_000).toISOString();
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
    default: return null;
  }
}

const LIVE_POINT_ID_PREFIX = 'live-';

function buildLiveLocationRecord(point: LiveTrackingPoint): LocationRecord | null {
  if (!point.usuario_id) return null;
  return {
    id: `${LIVE_POINT_ID_PREFIX}${point.usuario_id}`,
    usuario_id: point.usuario_id,
    latitude: point.latitude,
    longitude: point.longitude,
    precisao: point.precisao,
    fonte: point.fonte,
    bateria_nivel: point.bateria_nivel,
    em_movimento: point.em_movimento,
    criado_em: point.criado_em,
    pending: point.pending,
  };
}

export default function PainelLocalizacao() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [captureInterval, setCaptureInterval] = useState<CaptureIntervalMinutes>(() => getCaptureIntervalMinutes());
  const [dateFilter, setDateFilter] = useState<DateFilter>('24h');
  const hasFetched = useRef(false);

  // Lazy-load leaflet on mount
  useEffect(() => {
    ensureLeaflet().then(() => setMapReady(true));
  }, []);

  const fetchData = useCallback(async (filter?: DateFilter) => {
    setLoading(true);
    try {
      const activeFilter = filter ?? dateFilter;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLocations([]); setUsuarios([]); return; }

      const { data: currentUser } = await supabase
        .from('hierarquia_usuarios')
        .select('id, tipo')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (!currentUser) { setLocations([]); setUsuarios([]); return; }

      const isAdmin = currentUser.tipo === 'super_admin' || currentUser.tipo === 'coordenador';

      let locationQuery = supabase
        .from('localizacoes_usuarios')
        .select('id, usuario_id, latitude, longitude, precisao, fonte, bateria_nivel, em_movimento, criado_em')
        .order('criado_em', { ascending: false })
        .limit(300);

      const since = getDateFilterISO(activeFilter);
      if (since) locationQuery = locationQuery.gte('criado_em', since);
      if (!isAdmin) locationQuery = locationQuery.eq('usuario_id', currentUser.id);

      const userQuery = supabase.from('hierarquia_usuarios').select('id, nome, tipo').eq('ativo', true);
      if (!isAdmin) userQuery.eq('id', currentUser.id);

      const [locRes, usrRes] = await Promise.all([locationQuery, userQuery]);
      setLocations((locRes.data || []) as unknown as LocationRecord[]);
      setUsuarios(usrRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    const eventName = getLiveTrackingEventName();

    const handleLiveTracking = (event: Event) => {
      const point = buildLiveLocationRecord((event as CustomEvent<LiveTrackingPoint>).detail);
      if (!point) return;

      setLocations((prev) => {
        const withoutSameUser = prev.filter((item) => item.usuario_id !== point.usuario_id || !item.pending);
        return [point, ...withoutSameUser].sort(
          (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
        ).slice(0, 300);
      });
    };

    window.addEventListener(eventName, handleLiveTracking as EventListener);
    return () => window.removeEventListener(eventName, handleLiveTracking as EventListener);
  }, []);

  const handleDateFilterChange = (f: DateFilter) => {
    setDateFilter(f);
    fetchData(f);
  };

  const handleCaptureIntervalChange = async (minutes: CaptureIntervalMinutes) => {
    setCaptureInterval(minutes);
    await setCaptureIntervalMinutes(minutes);
  };

  const userGroups = useMemo(() => {
    const map: Record<string, LocationRecord[]> = {};
    locations.forEach(loc => {
      if (!map[loc.usuario_id]) map[loc.usuario_id] = [];
      map[loc.usuario_id].push(loc);
    });

    return Object.entries(map).map(([uid, locs], i) => {
      const user = usuarios.find(u => u.id === uid);
      const sorted = locs.sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
      return {
        usuario_id: uid,
        nome: user?.nome || 'Desconhecido',
        tipo: user?.tipo || '—',
        locations: sorted,
        lastLocation: sorted[sorted.length - 1],
        color: COLORS[i % COLORS.length],
      } as UserLocationGroup;
    }).sort((a, b) => new Date(b.lastLocation.criado_em).getTime() - new Date(a.lastLocation.criado_em).getTime());
  }, [locations, usuarios]);

  const displayGroups = useMemo(() => {
    const filtered = selectedUserId ? userGroups.filter(g => g.usuario_id === selectedUserId) : userGroups;
    return filtered.flatMap(g => {
      const valid = g.locations.filter(l =>
        Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)) &&
        Math.abs(Number(l.latitude)) <= 90 && Math.abs(Number(l.longitude)) <= 180
      ).map(l => ({ ...l, latitude: Number(l.latitude), longitude: Number(l.longitude) }));
      if (!valid.length) return [];
      const sampled = valid.length <= 150 ? valid : valid.filter((_, i) => {
        const step = Math.ceil(valid.length / 150);
        return i === 0 || i === valid.length - 1 || i % step === 0;
      });
      return [{ ...g, locations: sampled, lastLocation: valid[valid.length - 1] }];
    });
  }, [userGroups, selectedUserId]);

  const mapBounds = useMemo(() => {
    if (!leafletLib) return null;
    const L = leafletLib;
    const pts = displayGroups.flatMap(g => g.locations.map(l => [l.latitude, l.longitude] as [number, number]));
    return pts.length ? L.latLngBounds(pts) : null;
  }, [displayGroups]);

  const formatTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const fonteIcon = (f: string | null) => f === 'gps' ? <Navigation size={10} className="text-primary" /> : <Wifi size={10} className="text-muted-foreground" />;
  const fonteLabel = (f: string | null) => f === 'gps' ? 'GPS' : f === 'ip' ? 'IP' : f === 'ip_background' ? 'IP(bg)' : f || '—';
  const openMaps = (lat: number, lng: number) => window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">📍 Rastreamento</h2>
          <p className="text-[10px] text-muted-foreground">
            {loading ? 'Carregando...' : `${userGroups.length} usuários · ${locations.length} pontos`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setView(view === 'map' ? 'list' : 'map')}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all">
            {view === 'map' ? <List size={16} className="text-foreground" /> : <Map size={16} className="text-foreground" />}
          </button>
          <button onClick={() => fetchData()} disabled={loading}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all">
            <RefreshCw size={16} className={`text-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Capture interval */}
      <div className="section-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Intervalo de captura</p>
          <p className="text-[10px] text-muted-foreground">Frequência de gravação da posição.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CAPTURE_INTERVALS.map(m => (
            <button key={m} onClick={() => handleCaptureIntervalChange(m)}
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold transition-all active:scale-95 ${
                captureInterval === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'
              }`}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      {/* Date filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {DATE_FILTER_OPTIONS.map(opt => (
          <button key={opt.id} onClick={() => handleDateFilterChange(opt.id)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all active:scale-95 ${
              dateFilter === opt.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* User filter chips */}
      {userGroups.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setSelectedUserId(null)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
              !selectedUserId ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}>
            Todos
          </button>
          {userGroups.map(g => (
            <button key={g.usuario_id} onClick={() => setSelectedUserId(selectedUserId === g.usuario_id ? null : g.usuario_id)}
              className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 flex items-center gap-1 ${
                selectedUserId === g.usuario_id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
              }`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
              {g.nome.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Loading overlay on data area */}
      {loading && locations.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : userGroups.length === 0 && !loading ? (
        <div className="section-card text-center py-8">
          <MapPin size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma localização registrada</p>
        </div>
      ) : view === 'map' && mapReady && reactLeafletModule ? (
        (() => {
          const { MapContainer, TileLayer, Polyline, Marker, Popup } = reactLeafletModule!;
          return (
        <div className="rounded-2xl overflow-hidden border border-border relative" style={{ height: 400 }}>
          {loading && (
            <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          )}
          <MapContainer center={[-15.78, -47.93]} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds bounds={mapBounds} />
            {displayGroups.map(group => {
              const path = group.locations.map(l => [l.latitude, l.longitude] as [number, number]);
              if (!path.length) return null;
              const last = group.locations[group.locations.length - 1];
              return (
                <React.Fragment key={group.usuario_id}>
                  {path.length > 1 && (
                    <Polyline positions={path} pathOptions={{ color: group.color, weight: 3, opacity: 0.7, dashArray: '8, 6' }} />
                  )}
                  {group.locations.slice(1, -1).filter((_, i) => i % 3 === 0).map(loc => (
                    <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={createDotIcon(group.color)}>
                      <Popup><div className="text-xs"><strong>{group.nome}</strong><br/>{formatDateTime(loc.criado_em)}<br/>Fonte: {fonteLabel(loc.fonte)}</div></Popup>
                    </Marker>
                  ))}
                  <Marker position={[last.latitude, last.longitude]} icon={createUserIcon(group.nome.charAt(0).toUpperCase(), group.color)}>
                    <Popup>
                      <div className="text-xs space-y-0.5">
                        <strong>{group.nome}</strong> <span style={{ color: '#999' }}>({group.tipo})</span><br/>
                        📍 Última posição<br/>{formatDateTime(last.criado_em)}<br/>
                        Fonte: {fonteLabel(last.fonte)}<br/>
                        {last.precisao && <>Precisão: ±{Math.round(last.precisao)}m<br/></>}
                        {last.bateria_nivel !== null && <>🔋 {last.bateria_nivel}%<br/></>}
                        <a href={`https://www.google.com/maps?q=${last.latitude},${last.longitude}`} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>Google Maps</a>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>
          );
        })()
      ) : view === 'map' && !mapReady ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {displayGroups.map(group => {
            const isExpanded = expandedUser === group.usuario_id;
            const last = group.lastLocation;
            const sortedDesc = [...group.locations].reverse();
            return (
              <div key={group.usuario_id} className="section-card !p-0 overflow-hidden">
                <button onClick={() => setExpandedUser(isExpanded ? null : group.usuario_id)}
                  className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/50 transition-all">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: group.color + '20' }}>
                    <span className="text-sm font-bold" style={{ color: group.color }}>{group.nome.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{group.nome}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{group.tipo}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{formatTime(last.criado_em)}</span>
                      {fonteIcon(last.fonte)}
                      {last.bateria_nivel !== null && (
                        <>
                          <Battery size={10} className={last.bateria_nivel > 20 ? 'text-emerald-400' : 'text-red-400'} />
                          <span className="text-[10px] text-muted-foreground">{last.bateria_nivel}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedUserId(group.usuario_id); setView('map'); }}
                      className="p-1.5 rounded-lg active:scale-95" style={{ background: group.color + '15', color: group.color }}>
                      <Route size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openMaps(last.latitude, last.longitude); }}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary active:scale-95">
                      <MapPin size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5 max-h-[300px] overflow-y-auto">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Histórico ({group.locations.length} pontos)
                    </p>
                    {sortedDesc.slice(0, 30).map(loc => (
                      <div key={loc.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                        {fonteIcon(loc.fonte)}
                        <span className="text-[10px] text-muted-foreground w-12 shrink-0">{fonteLabel(loc.fonte)}</span>
                        <button onClick={() => openMaps(loc.latitude, loc.longitude)} className="text-[10px] text-primary underline truncate">
                          {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                        </button>
                        {loc.precisao && <span className="text-[9px] text-muted-foreground">±{Math.round(loc.precisao)}m</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTime(loc.criado_em)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
