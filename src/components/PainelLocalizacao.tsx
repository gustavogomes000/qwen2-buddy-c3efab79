import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CAPTURE_INTERVALS,
  getCaptureIntervalMinutes,
  getLiveTrackingEventName,
  setCaptureIntervalMinutes,
  idbGetAll,
  reverseGeocode,
  type CaptureIntervalMinutes,
  type LiveTrackingPoint,
} from '@/services/locationTracker';
import {
  MapPin, Clock, Battery, Wifi, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Navigation, ExternalLink, AlertTriangle,
} from 'lucide-react';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

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
  endereco?: string | null;
}

interface UserLocationGroup {
  usuario_id: string;
  nome: string;
  tipo: string;
  suplente_id: string | null;
  locations: LocationRecord[];
  lastLocation: LocationRecord;
  color: string;
}

type DateFilter = '24h' | '48h' | '7d' | '30d' | 'all';

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '48h', label: '48h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'all', label: 'Tudo' },
];

function getDateFilterISO(filter: DateFilter): string | null {
  const now = Date.now();
  const ms: Record<string, number> = { '24h': 86400000, '48h': 172800000, '7d': 604800000, '30d': 2592000000 };
  return ms[filter] ? new Date(now - ms[filter]).toISOString() : null;
}

function isValid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function normalize(raw: any): LocationRecord | null {
  const lat = Number(raw?.latitude);
  const lng = Number(raw?.longitude);
  if (!isValid(lat, lng)) return null;
  const uid = raw?.usuario_id;
  if (!uid) return null;
  const criado = raw?.criado_em || new Date().toISOString();
  return {
    id: raw?.id || `loc-${uid}-${criado}`,
    usuario_id: uid,
    latitude: lat,
    longitude: lng,
    precisao: raw?.precisao != null ? Number(raw.precisao) : null,
    fonte: raw?.fonte ?? null,
    bateria_nivel: raw?.bateria_nivel != null ? Number(raw.bateria_nivel) : null,
    em_movimento: Boolean(raw?.em_movimento),
    criado_em: criado,
    endereco: raw?.endereco ?? null,
  };
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch { return iso; }
}

function formatRelative(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'Agora';
  if (diff < 60) return `${diff}min atrás`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getOnlineStatus(iso: string): { label: string; color: string; dotClass: string } {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 15) return { label: 'Online', color: 'text-emerald-600', dotClass: 'bg-emerald-500 animate-pulse' };
  if (diff < 60) return { label: 'Recente', color: 'text-amber-600', dotClass: 'bg-amber-500' };
  return { label: 'Offline', color: 'text-muted-foreground', dotClass: 'bg-muted-foreground/40' };
}

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function PainelLocalizacao() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [captureInterval, setCaptureIntervalState] = useState<CaptureIntervalMinutes>(() => getCaptureIntervalMinutes());
  const [dateFilter, setDateFilter] = useState<DateFilter>('24h');
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroSuplente, setFiltroSuplente] = useState<string>('todos');
  const hasFetched = useRef(false);

  // Fetch from Supabase + merge IndexedDB
  const fetchData = useCallback(async (filter?: DateFilter) => {
    setLoading(true);
    setError(null);
    try {
      const activeFilter = filter ?? dateFilter;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLocations([]); setUsuarios([]); return; }

      const { data: currentUser } = await supabase.from('hierarquia_usuarios')
        .select('id, tipo').eq('auth_user_id', user.id).neq('ativo', false).maybeSingle();
      if (!currentUser) { setLocations([]); setUsuarios([]); return; }

      const isAdmin = currentUser.tipo === 'super_admin' || currentUser.tipo === 'coordenador';

      let locQuery = supabase.from('localizacoes_usuarios')
        .select('id, usuario_id, latitude, longitude, precisao, fonte, bateria_nivel, em_movimento, criado_em')
        .order('criado_em', { ascending: false }).limit(300);

      const since = getDateFilterISO(activeFilter);
      if (since) locQuery = locQuery.gte('criado_em', since);
      if (!isAdmin) locQuery = locQuery.eq('usuario_id', currentUser.id);

      const userQuery = supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id').neq('ativo', false);
      if (!isAdmin) userQuery.eq('id', currentUser.id);

      const [locRes, usrRes] = await Promise.all([locQuery, userQuery]);

      if (locRes.error) throw locRes.error;
      if (usrRes.error) throw usrRes.error;

      // Also get local IndexedDB records
      let idbRecords: LocationRecord[] = [];
      try {
        const raw = await idbGetAll(200);
        idbRecords = raw.map(r => normalize(r)).filter((r): r is LocationRecord => r !== null);
      } catch {}

      // Merge: Supabase records + IDB records (dedup by timestamp proximity)
      const supaRecords = (locRes.data || []).map(normalize).filter((r): r is LocationRecord => r !== null);
      const merged = [...supaRecords];
      for (const idb of idbRecords) {
        const isDup = merged.some(m =>
          m.usuario_id === idb.usuario_id &&
          Math.abs(new Date(m.criado_em).getTime() - new Date(idb.criado_em).getTime()) < 30_000
        );
        if (!isDup) merged.push(idb);
      }

      merged.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
      setLocations(merged.slice(0, 300));
      setUsuarios(usrRes.data || []);
    } catch (e: any) {
      console.error('[Painel] fetch error', e);
      setError('Não foi possível carregar os dados.');
      // Fallback: show IndexedDB data only
      try {
        const raw = await idbGetAll(200);
        const records = raw.map(r => normalize(r)).filter((r): r is LocationRecord => r !== null);
        setLocations(records);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; fetchData(); }
  }, [fetchData]);

  // Live tracking updates
  useEffect(() => {
    const handler = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const rec = normalize(e.detail);
      if (!rec) return;
      setLocations(prev => {
        const filtered = prev.filter(p => !(p.usuario_id === rec.usuario_id && typeof p.id === 'string' && p.id.startsWith('loc-')));
        return [rec, ...filtered].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()).slice(0, 300);
      });
    };
    window.addEventListener(getLiveTrackingEventName(), handler as EventListener);
    return () => window.removeEventListener(getLiveTrackingEventName(), handler as EventListener);
  }, []);

  // Reverse geocode visible locations (lazy, max 5 at a time)
  useEffect(() => {
    const toGeocode = locations.filter(l => !addresses[`${l.latitude.toFixed(4)},${l.longitude.toFixed(4)}`]).slice(0, 5);
    if (!toGeocode.length) return;
    let cancelled = false;
    (async () => {
      const newAddrs: Record<string, string> = {};
      for (const loc of toGeocode) {
        if (cancelled) break;
        const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
        const addr = await reverseGeocode(loc.latitude, loc.longitude);
        if (addr) newAddrs[key] = addr;
        await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
      }
      if (!cancelled) setAddresses(prev => ({ ...prev, ...newAddrs }));
    })();
    return () => { cancelled = true; };
  }, [locations, addresses]);

  const handleDateFilter = (f: DateFilter) => { setDateFilter(f); fetchData(f); };
  const handleInterval = async (m: CaptureIntervalMinutes) => { setCaptureIntervalState(m); await setCaptureIntervalMinutes(m); };

  const userGroups = useMemo(() => {
    const map: Record<string, LocationRecord[]> = {};
    locations.forEach(l => { if (!map[l.usuario_id]) map[l.usuario_id] = []; map[l.usuario_id].push(l); });
    return Object.entries(map).map(([uid, locs], i) => {
      const user = usuarios.find(u => u.id === uid);
      const sorted = [...locs].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
      return {
        usuario_id: uid,
        nome: user?.nome || uid.slice(0, 8),
        tipo: user?.tipo || '—',
        suplente_id: user?.suplente_id || null,
        locations: sorted,
        lastLocation: sorted[0],
        color: COLORS[i % COLORS.length],
      } as UserLocationGroup;
    }).sort((a, b) => new Date(b.lastLocation.criado_em).getTime() - new Date(a.lastLocation.criado_em).getTime());
  }, [locations, usuarios]);

  // Suplentes list for filter
  const suplentesUnicos = useMemo(() => {
    const ids = new Set<string>();
    const result: { id: string; nome: string }[] = [];
    for (const u of usuarios) {
      if (u.suplente_id && !ids.has(u.suplente_id)) {
        ids.add(u.suplente_id);
        // Find the suplente user name
        const supUser = usuarios.find(x => x.suplente_id === u.suplente_id && x.tipo === 'suplente');
        result.push({ id: u.suplente_id, nome: supUser?.nome || u.suplente_id.slice(0, 8) });
      }
    }
    return result;
  }, [usuarios]);

  // Tipo counts
  const tipoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    userGroups.forEach(g => { counts[g.tipo] = (counts[g.tipo] || 0) + 1; });
    return counts;
  }, [userGroups]);

  // Apply filters
  const filteredGroups = useMemo(() => {
    let groups = userGroups;
    if (filtroTipo !== 'todos') groups = groups.filter(g => g.tipo === filtroTipo);
    if (filtroSuplente !== 'todos') groups = groups.filter(g => g.suplente_id === filtroSuplente);
    if (selectedUserId) groups = groups.filter(g => g.usuario_id === selectedUserId);
    return groups;
  }, [userGroups, filtroTipo, filtroSuplente, selectedUserId]);

  const displayGroups = filteredGroups;
  const fonteIcon = (f: string | null) => f === 'gps' ? <Navigation size={10} className="text-primary" /> : <Wifi size={10} className="text-muted-foreground" />;
  const fonteLabel = (f: string | null) => f === 'gps' ? 'GPS' : f === 'ip' ? 'IP' : f || '—';
  const getAddr = (lat: number, lng: number) => addresses[`${lat.toFixed(4)},${lng.toFixed(4)}`] || null;

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">📍 Rastreamento</h2>
          <p className="text-[10px] text-muted-foreground">
            {loading ? 'Carregando...' : `${displayGroups.length}/${userGroups.length} usuários · ${locations.length} pontos`}
          </p>
        </div>
        <button onClick={() => fetchData()} disabled={loading}
          className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all">
          <RefreshCw size={16} className={`text-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Capture interval */}
      <div className="section-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Intervalo de captura</p>
          <p className="text-[10px] text-muted-foreground">Frequência de gravação da posição.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CAPTURE_INTERVALS.map(m => (
            <button key={m} onClick={() => handleInterval(m)}
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
        {DATE_FILTERS.map(opt => (
          <button key={opt.id} onClick={() => handleDateFilter(opt.id)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all active:scale-95 ${
              dateFilter === opt.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por tipo</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => { setFiltroTipo('todos'); setSelectedUserId(null); }}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all active:scale-95 ${
              filtroTipo === 'todos' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}>
            Todos ({userGroups.length})
          </button>
          {Object.entries(tipoCounts).map(([tipo, count]) => (
            <button key={tipo} onClick={() => { setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo); setSelectedUserId(null); }}
              className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all active:scale-95 ${
                filtroTipo === tipo ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
              }`}>
              {tipo === 'super_admin' ? 'Admin' : tipo === 'coordenador' ? 'Coord.' : tipo === 'suplente' ? 'Suplente' : tipo === 'lideranca' ? 'Liderança' : tipo === 'fiscal' ? 'Fiscal' : tipo} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Suplente filter */}
      {suplentesUnicos.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por suplente</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => { setFiltroSuplente('todos'); setSelectedUserId(null); }}
              className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all active:scale-95 ${
                filtroSuplente === 'todos' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
              }`}>
              Todos
            </button>
            {suplentesUnicos.map(s => (
              <button key={s.id} onClick={() => { setFiltroSuplente(filtroSuplente === s.id ? 'todos' : s.id); setSelectedUserId(null); }}
                className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all active:scale-95 ${
                  filtroSuplente === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
                }`}>
                {s.nome.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User filter chips */}
      {filteredGroups.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setSelectedUserId(null)}
            className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
              !selectedUserId ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}>Todos</button>
          {filteredGroups.map(g => (
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

      {error && (
        <div className="section-card border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-destructive mt-0.5" />
            <p className="text-xs text-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading && locations.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : displayGroups.length === 0 && !loading ? (
        <div className="section-card text-center py-8">
          <MapPin size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma localização registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayGroups.map(group => {
            const isExpanded = expandedUser === group.usuario_id;
            const last = group.lastLocation;
            const lastAddr = getAddr(last.latitude, last.longitude);

            return (
              <div key={group.usuario_id} className="section-card !p-0 overflow-hidden">
                {/* User header */}
                {(() => {
                  const status = getOnlineStatus(last.criado_em);
                  return (
                    <button onClick={() => setExpandedUser(isExpanded ? null : group.usuario_id)}
                      className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/50 transition-all">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: group.color + '20' }}>
                          <span className="text-sm font-bold" style={{ color: group.color }}>{group.nome.charAt(0).toUpperCase()}</span>
                        </div>
                        {/* Online indicator dot */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${status.dotClass}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{group.nome}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{group.tipo}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold ${status.color}`}>{status.label}</span>
                          <span className="text-[10px] text-muted-foreground">· {formatRelative(last.criado_em)}</span>
                          {last.bateria_nivel !== null && (
                            <>
                              <Battery size={10} className={last.bateria_nivel > 20 ? 'text-emerald-400' : 'text-red-400'} />
                              <span className="text-[10px] text-muted-foreground">{last.bateria_nivel}%</span>
                            </>
                          )}
                        </div>
                        {lastAddr && (
                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">📍 {lastAddr}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a href={mapsLink(last.latitude, last.longitude)} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-primary/10 text-primary active:scale-95">
                          <MapPin size={14} />
                        </a>
                        {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </div>
                    </button>
                  );
                })()}

                {/* Expanded location list */}
                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-1 max-h-[400px] overflow-y-auto">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                      Histórico ({group.locations.length} pontos)
                    </p>
                    {group.locations.slice(0, 50).map(loc => {
                      const addr = getAddr(loc.latitude, loc.longitude);
                      return (
                        <div key={loc.id} className="py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            {fonteIcon(loc.fonte)}
                            <span className="text-[10px] text-muted-foreground font-medium">{fonteLabel(loc.fonte)}</span>
                            <span className="text-[10px] text-foreground font-mono">
                              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                            </span>
                            {loc.precisao && <span className="text-[9px] text-muted-foreground">±{Math.round(loc.precisao)}m</span>}
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatDateTime(loc.criado_em)}</span>
                          </div>
                          {addr && (
                            <p className="text-[9px] text-muted-foreground mt-0.5 pl-4 truncate">{addr}</p>
                          )}
                          <div className="mt-1 pl-4">
                            <a href={mapsLink(loc.latitude, loc.longitude)} target="_blank" rel="noreferrer"
                              className="text-[10px] text-primary inline-flex items-center gap-1 hover:underline">
                              <ExternalLink size={9} /> Abrir no Google Maps
                            </a>
                          </div>
                        </div>
                      );
                    })}
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
