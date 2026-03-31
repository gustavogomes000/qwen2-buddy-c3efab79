import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Battery, Wifi, ChevronDown, ChevronUp, RefreshCw, Loader2, Navigation, Map, List, Route } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function createUserIcon(initial: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${initial}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createDotIcon(color: string) {
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
}

interface UserLocationGroup {
  usuario_id: string;
  nome: string;
  tipo: string;
  locations: LocationRecord[];
  lastLocation: LocationRecord;
  color: string;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [bounds, map]);
  return null;
}

export default function PainelLocalizacao() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    const [locRes, usrRes] = await Promise.all([
      (supabase as any).from('localizacoes_usuarios').select('*').order('criado_em', { ascending: false }).limit(1000),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo').eq('ativo', true),
    ]);
    setLocations((locRes.data || []) as unknown as LocationRecord[]);
    setUsuarios(usrRes.data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []);

  const userGroups = useMemo(() => {
    const map: Record<string, LocationRecord[]> = {};
    locations.forEach(loc => {
      if (!map[loc.usuario_id]) map[loc.usuario_id] = [];
      map[loc.usuario_id].push(loc);
    });

    return Object.entries(map).map(([uid, locs], i) => {
      const user = usuarios.find(u => u.id === uid);
      const sortedLocations = locs.sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
      return {
        usuario_id: uid,
        nome: user?.nome || 'Desconhecido',
        tipo: user?.tipo || '—',
        locations: sortedLocations,
        lastLocation: sortedLocations[sortedLocations.length - 1],
        color: COLORS[i % COLORS.length],
      } as UserLocationGroup;
    }).sort((a, b) => new Date(b.lastLocation.criado_em).getTime() - new Date(a.lastLocation.criado_em).getTime());
  }, [locations, usuarios]);

  const displayGroups = useMemo(() => {
    const filtered = selectedUserId
      ? userGroups.filter(g => g.usuario_id === selectedUserId)
      : userGroups;

    return filtered.flatMap(g => {
      const normalizedLocations = g.locations
        .filter(l => Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)) && Math.abs(Number(l.latitude)) <= 90 && Math.abs(Number(l.longitude)) <= 180)
        .map(l => ({
          ...l,
          latitude: Number(l.latitude),
          longitude: Number(l.longitude),
        }));

      if (normalizedLocations.length === 0) return [];

      const sampledLocations = normalizedLocations.length <= 200
        ? normalizedLocations
        : normalizedLocations.filter((_, i) => {
            const step = Math.ceil(normalizedLocations.length / 200);
            return i === 0 || i === normalizedLocations.length - 1 || i % step === 0;
          });

      return [{
        ...g,
        locations: sampledLocations,
        lastLocation: normalizedLocations[normalizedLocations.length - 1],
      }];
    });
  }, [userGroups, selectedUserId]);

  const mapBounds = useMemo(() => {
    const pts = displayGroups.flatMap(g => g.locations
      .map(l => [Number(l.latitude), Number(l.longitude)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
    );
    if (pts.length === 0) return null;
    return L.latLngBounds(pts);
  }, [displayGroups]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}min atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const fonteIcon = (fonte: string | null) => {
    if (fonte === 'gps') return <Navigation size={10} className="text-primary" />;
    if (fonte === 'ip' || fonte === 'ip_background') return <Wifi size={10} className="text-muted-foreground" />;
    return <MapPin size={10} className="text-muted-foreground" />;
  };

  const fonteLabel = (fonte: string | null) => {
    if (fonte === 'gps') return 'GPS';
    if (fonte === 'ip') return 'IP';
    if (fonte === 'ip_background') return 'IP (bg)';
    return fonte || '—';
  };

  const openMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">📍 Rastreamento</h2>
          <p className="text-[10px] text-muted-foreground">{userGroups.length} usuários · {locations.length} pontos</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setView(view === 'map' ? 'list' : 'map')}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all">
            {view === 'map' ? <List size={16} className="text-foreground" /> : <Map size={16} className="text-foreground" />}
          </button>
          <button onClick={fetchData} disabled={refreshing}
            className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all">
            <RefreshCw size={16} className={`text-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* User filter chips */}
      {userGroups.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedUserId(null)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
              !selectedUserId ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}
          >
            Todos
          </button>
          {userGroups.map(g => (
            <button
              key={g.usuario_id}
              onClick={() => setSelectedUserId(selectedUserId === g.usuario_id ? null : g.usuario_id)}
              className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 flex items-center gap-1 ${
                selectedUserId === g.usuario_id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
              {g.nome.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {userGroups.length === 0 ? (
        <div className="section-card text-center py-8">
          <MapPin size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma localização registrada ainda</p>
        </div>
      ) : view === 'map' ? (
        /* MAP VIEW */
        <div className="rounded-2xl overflow-hidden border border-border" style={{ height: 400 }}>
          <MapContainer
            center={[-15.78, -47.93]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds bounds={mapBounds} />

            {displayGroups.map(group => {
              const validLocs = group.locations.filter(l =>
                Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)) &&
                Math.abs(Number(l.latitude)) <= 90 && Math.abs(Number(l.longitude)) <= 180
              );
              const path = validLocs.map(l => [Number(l.latitude), Number(l.longitude)] as [number, number]);
              if (validLocs.length === 0) return null;
              const last = validLocs[validLocs.length - 1];
              const first = validLocs[0];

              return (
                <React.Fragment key={group.usuario_id}>
                  {path.length > 1 && (
                    <Polyline
                      positions={path}
                      pathOptions={{
                        color: group.color,
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '8, 6',
                      }}
                    />
                  )}

                  {validLocs.slice(1, -1).map(loc => (
                    <Marker key={loc.id} position={[Number(loc.latitude), Number(loc.longitude)]} icon={createDotIcon(group.color)}>
                      <Popup>
                        <div className="text-xs">
                          <strong>{group.nome}</strong><br />
                          {new Date(loc.criado_em).toLocaleString('pt-BR')}<br />
                          Fonte: {fonteLabel(loc.fonte)}<br />
                          {loc.precisao && <>Precisão: ±{Math.round(loc.precisao)}m<br /></>}
                          {loc.bateria_nivel !== null && <>Bateria: {loc.bateria_nivel}%</>}
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {first && (
                    <Marker position={[Number(first.latitude), Number(first.longitude)]} icon={createDotIcon(group.color)}>
                      <Popup>
                        <div className="text-xs">
                          <strong>{group.nome}</strong> — Início<br />
                          {new Date(first.criado_em).toLocaleString('pt-BR')}
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  <Marker
                    position={[Number(last.latitude), Number(last.longitude)]}
                    icon={createUserIcon(group.nome.charAt(0).toUpperCase(), group.color)}
                  >
                    <Popup>
                      <div className="text-xs space-y-0.5">
                        <strong>{group.nome}</strong> <span style={{ color: '#999' }}>({group.tipo})</span><br />
                        📍 Última posição<br />
                        {new Date(last.criado_em).toLocaleString('pt-BR')}<br />
                        Fonte: {fonteLabel(last.fonte)}<br />
                        {last.precisao && <>Precisão: ±{Math.round(last.precisao)}m<br /></>}
                        {last.bateria_nivel !== null && <>🔋 {last.bateria_nivel}%<br /></>}
                        <a href={`https://www.google.com/maps?q=${last.latitude},${last.longitude}`} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                          Abrir no Google Maps
                        </a>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-2">
          {displayGroups.map(group => {
            const isExpanded = expandedUser === group.usuario_id;
            const last = group.lastLocation;
            const sortedDesc = [...group.locations].reverse();
            return (
              <div key={group.usuario_id} className="section-card !p-0 overflow-hidden">
                <button
                  onClick={() => setExpandedUser(isExpanded ? null : group.usuario_id)}
                  className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/50 transition-all"
                >
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
                      <span className="text-[10px] text-muted-foreground">{fonteLabel(last.fonte)}</span>
                      {last.bateria_nivel !== null && (
                        <>
                          <Battery size={10} className={last.bateria_nivel > 20 ? 'text-emerald-400' : 'text-red-400'} />
                          <span className="text-[10px] text-muted-foreground">{last.bateria_nivel}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedUserId(group.usuario_id); setView('map'); }}
                      className="p-1.5 rounded-lg active:scale-95" style={{ background: group.color + '15', color: group.color }}
                    >
                      <Route size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openMaps(last.latitude, last.longitude); }}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary active:scale-95"
                    >
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
                    {sortedDesc.slice(0, 50).map(loc => (
                      <div key={loc.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                        {fonteIcon(loc.fonte)}
                        <span className="text-[10px] text-muted-foreground w-12 shrink-0">{fonteLabel(loc.fonte)}</span>
                        <button
                          onClick={() => openMaps(loc.latitude, loc.longitude)}
                          className="text-[10px] text-primary underline truncate"
                        >
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
