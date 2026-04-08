import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, User, ChevronDown, ChevronUp, Loader2, RefreshCw, Navigation, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ── Fix default Leaflet marker icons ── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ── Custom marker icons ── */
function createColorIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
    "><div style="width:8px;height:8px;border-radius:50%;background:white;"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

const iconOnline = createColorIcon('#22c55e');
const iconOffline = createColorIcon('#94a3b8');
const iconSelected = createColorIcon('#ec4899');

interface Localizacao {
  id: string;
  usuario_id: string;
  latitude: number;
  longitude: number;
  precisao: number | null;
  criado_em: string;
}

interface UsuarioInfo {
  id: string;
  nome: string;
  tipo: string;
}

/* ── Auto-fit map bounds ── */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [positions, map]);
  return null;
}

/* ── Auto-open popup on a marker ── */
function AutoOpenPopup() {
  const map = useMap();
  useEffect(() => {
    // Small delay to ensure marker is rendered
    const timer = setTimeout(() => {
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker && layer.getPopup()) {
          layer.openPopup();
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function TabLocalizacoes() {
  const [localizacoes, setLocalizacoes] = useState<Localizacao[]>([]);
  const [allLocalizacoes, setAllLocalizacoes] = useState<Localizacao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [rastro, setRastro] = useState<Localizacao[]>([]);
  const [loadingRastro] = useState(false);
  const [expandedList, setExpandedList] = useState(true);
  const [expandedUserInList, setExpandedUserInList] = useState<string | null>(null);
  const [enderecos, setEnderecos] = useState<Map<string, string>>(new Map());
  const mapRef = useRef<any>(null);

  /* ── Fetch latest location per user ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const [{ data: locs }, { data: users }] = await Promise.all([
        supabase
          .from('localizacoes_usuarios')
          .select('id, usuario_id, latitude, longitude, precisao, criado_em')
          .gte('criado_em', twentyFourHoursAgo)
          .order('criado_em', { ascending: false })
          .limit(1000),
        supabase
          .from('hierarquia_usuarios')
          .select('id, nome, tipo')
          .neq('tipo', 'super_admin'),
      ]);

      setUsuarios(users || []);
      setAllLocalizacoes(locs || []);

      // Get latest per user
      const latestMap = new Map<string, Localizacao>();
      (locs || []).forEach(loc => {
        if (!latestMap.has(loc.usuario_id)) {
          latestMap.set(loc.usuario_id, loc);
        }
      });
      setLocalizacoes(Array.from(latestMap.values()));
    } catch (err) {
      console.error('[Localização] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Reverse geocode addresses ── */
  useEffect(() => {
    if (localizacoes.length === 0) return;
    localizacoes.forEach(async (loc) => {
      if (enderecos.has(loc.usuario_id)) return;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json&addressdetails=1&accept-language=pt-BR`);
        const data = await res.json();
        if (data?.display_name) {
          setEnderecos(prev => {
            const next = new Map(prev);
            next.set(loc.usuario_id, data.display_name);
            return next;
          });
        }
      } catch { /* silenciar */ }
    });
  }, [localizacoes]);

  const handleSelectUser = useCallback((userId: string) => {
    if (selectedUser === userId) {
      setSelectedUser(null);
      setRastro([]);
    } else {
      setSelectedUser(userId);
      // Use already-loaded 24h data, sorted ascending for polyline
      const userLocs = (allLocalizacoes || [])
        .filter(l => l.usuario_id === userId)
        .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
      setRastro(userLocs);
    }
  }, [selectedUser, allLocalizacoes]);

  /* ── Build map data ── */
  const userNameMap = useMemo(() => {
    const m = new Map<string, UsuarioInfo>();
    usuarios.forEach(u => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const usersWithLocation = useMemo(() => {
    return localizacoes.map(loc => ({
      ...loc,
      usuario: userNameMap.get(loc.usuario_id),
    })).filter(l => l.usuario);
  }, [localizacoes, userNameMap]);

  /* ── Get all 24h locations grouped by user ── */
  const locationsByUser = useMemo(() => {
    const map = new Map<string, Localizacao[]>();
    allLocalizacoes.forEach(loc => {
      const existing = map.get(loc.usuario_id) || [];
      existing.push(loc);
      map.set(loc.usuario_id, existing);
    });
    return map;
  }, [allLocalizacoes]);

  const mapPositions = useMemo((): [number, number][] => {
    if (selectedUser && rastro.length > 0) {
      return rastro.map(r => [r.latitude, r.longitude]);
    }
    return usersWithLocation.map(l => [l.latitude, l.longitude]);
  }, [selectedUser, rastro, usersWithLocation]);

  const rastroLine = useMemo((): [number, number][] => {
    if (!selectedUser || rastro.length < 2) return [];
    return rastro.map(r => [r.latitude, r.longitude]);
  }, [selectedUser, rastro]);

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Admin', coordenador: 'Coord.',
      suplente: 'Suplente', lideranca: 'Liderança', fiscal: 'Fiscal',
    };
    return labels[t] || t;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  const isRecent = (dateStr: string) => {
    return Date.now() - new Date(dateStr).getTime() < 30 * 60 * 1000; // 30min
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {usersWithLocation.length} usuário{usersWithLocation.length !== 1 ? 's' : ''} com localização
          </span>
        </div>
        <button
          onClick={() => { fetchData(); setSelectedUser(null); setRastro([]); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/80 active:scale-95 transition-all"
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 360 }}>
        {mapPositions.length > 0 ? (
          <MapContainer
            ref={mapRef}
            center={mapPositions[0] || [-15.7942, -49.8637]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds positions={mapPositions} />

            {/* Trail line */}
            {rastroLine.length > 1 && (
              <Polyline
                positions={rastroLine}
                pathOptions={{ color: '#ec4899', weight: 3, opacity: 0.7, dashArray: '8,6' }}
              />
            )}

            {/* Trail points */}
            {selectedUser && rastro.map((r, i) => (
              <Marker
                key={r.id}
                position={[r.latitude, r.longitude]}
                icon={i === rastro.length - 1 ? iconSelected : createColorIcon('#f9a8d4')}
              >
                <Popup>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold">{userNameMap.get(r.usuario_id)?.nome}</p>
                    <p>Ponto {i + 1} de {rastro.length}</p>
                    <p className="text-muted-foreground">{format(new Date(r.criado_em), 'dd/MM/yyyy, HH:mm:ss')}</p>
                    {r.precisao && <p>Precisão: ~{Math.round(r.precisao)}m</p>}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* User markers (when no user selected) — open popup on click */}
            {!selectedUser && usersWithLocation.map(loc => (
              <Marker
                key={loc.id}
                position={[loc.latitude, loc.longitude]}
                icon={isRecent(loc.criado_em) ? iconOnline : iconOffline}
                eventHandlers={{
                  click: () => {
                    // Don't navigate to trail — just let popup open naturally
                  },
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1 min-w-[160px]">
                    <p className="font-bold text-sm">{loc.usuario?.nome}</p>
                    <p>Ponto {(() => {
                      const userLocs = locationsByUser.get(loc.usuario_id) || [];
                      return `${userLocs.length} de ${userLocs.length}`;
                    })()}</p>
                    <p className="text-muted-foreground">{format(new Date(loc.criado_em), 'dd/MM/yyyy, HH:mm:ss')}</p>
                    {loc.precisao && <p>Precisão: ~{Math.round(loc.precisao)}m</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-muted/30">
            <div className="text-center space-y-2">
              <MapPin size={32} className="text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma localização registrada ainda</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected user info */}
      {selectedUser && (
        <div className="section-card !p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {userNameMap.get(selectedUser)?.nome?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {userNameMap.get(selectedUser)?.nome || 'Desconhecido'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {loadingRastro ? 'Carregando rastro...' : `${rastro.length} ponto${rastro.length !== 1 ? 's' : ''} registrado${rastro.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedUser(null); setRastro([]); }}
              className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/80 active:scale-95 transition-all"
            >
              Voltar
            </button>
          </div>
          {loadingRastro && (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      {/* User list — shows all users with 24h locations */}
      {!selectedUser && (
        <div className="section-card !p-0 overflow-hidden">
          <button
            onClick={() => setExpandedList(!expandedList)}
            className="w-full flex items-center justify-between p-3 text-left active:bg-muted/50 transition-all"
          >
            <div className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Usuários rastreados</span>
            </div>
            {expandedList ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          {expandedList && (
            <div className="border-t border-border divide-y divide-border">
              {usersWithLocation.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário com localização</p>
              )}
              {usersWithLocation.map(loc => {
                const userAllLocs = locationsByUser.get(loc.usuario_id) || [];
                const isUserExpanded = expandedUserInList === loc.usuario_id;
                // userAllLocs is already sorted desc (latest first)
                const latestLoc = userAllLocs[0];
                const olderLocs = userAllLocs.slice(1);

                return (
                  <div key={loc.id} className="p-3 hover:bg-muted/30 transition-all">
                    {/* Main row — latest location always visible */}
                    <button
                      onClick={() => handleSelectUser(loc.usuario_id)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{loc.usuario?.nome?.charAt(0)}</span>
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
                          style={{ background: isRecent(loc.criado_em) ? '#22c55e' : '#94a3b8' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{loc.usuario?.nome}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                          {tipoLabel(loc.usuario?.tipo || '')}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock size={10} />
                          {timeAgo(loc.criado_em)}
                        </div>
                      </div>
                    </button>

                    {/* Latest location details — always shown */}
                    <div className="mt-2 ml-12 space-y-1">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Clock size={11} className="shrink-0" />
                        {format(new Date(latestLoc?.criado_em || loc.criado_em), 'dd/MM/yyyy – HH:mm:ss')}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <MapPin size={11} className="shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {enderecos.get(loc.usuario_id) || `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`}
                        </span>
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink size={11} /> Abrir no Google Maps
                      </a>

                      {/* Toggle to show older locations */}
                      {olderLocs.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedUserInList(isUserExpanded ? null : loc.usuario_id);
                          }}
                          className="flex items-center gap-1 text-[11px] text-primary font-medium mt-1 hover:underline"
                        >
                          {isUserExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {isUserExpanded ? 'Ocultar' : `Ver mais ${olderLocs.length} localização${olderLocs.length > 1 ? 'ões' : ''}`}
                        </button>
                      )}

                      {/* Older locations — expandable */}
                      {isUserExpanded && olderLocs.map((olderLoc, idx) => (
                        <div key={olderLoc.id} className="pt-2 border-t border-border/50 space-y-1">
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Clock size={11} className="shrink-0" />
                            {format(new Date(olderLoc.criado_em), 'dd/MM/yyyy – HH:mm:ss')}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                            <MapPin size={11} className="shrink-0 mt-0.5" />
                            <span>{Number(olderLoc.latitude).toFixed(5)}, {Number(olderLoc.longitude).toFixed(5)}</span>
                          </p>
                          <a
                            href={`https://www.google.com/maps?q=${olderLoc.latitude},${olderLoc.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={11} /> Abrir no Google Maps
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
