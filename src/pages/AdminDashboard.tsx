import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLiderancas, useEleitores, useUsuarios, useFiscaisAdmin } from '@/hooks/useDataCache';
import {
  ArrowLeft, Users, Target, Search, X, Shield,
  ChevronDown, ChevronUp, Loader2, Download, Trophy,
  BarChart3, UserCog, Eye, Building2, Plus, MapPin, Calendar
} from 'lucide-react';
import { exportAllCadastros, exportCadastrosFiltered } from '@/lib/exportXlsx';
import SeletorCidade from '@/components/SeletorCidade';
import SeletorEvento from '@/components/SeletorEvento';
import GerenciarEventos from '@/components/GerenciarEventos';
import { lazy, Suspense } from 'react';

const TabLocalizacoes = lazy(() => import('@/components/TabLocalizacoes'));


/* ── types ── */
interface Pessoa {
  nome: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  titulo_eleitor: string | null;
  zona_eleitoral: string | null;
  secao_eleitoral: string | null;
  municipio_eleitoral: string | null;
  uf_eleitoral: string | null;
  colegio_eleitoral: string | null;
  endereco_colegio: string | null;
}

interface LiderancaReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; status: string | null; regiao_atuacao: string | null;
  tipo_lideranca: string | null; municipio_id: string | null; origem_captacao: string | null;
  apoiadores_estimados: number | null; meta_votos: number | null; nivel_comprometimento: string | null;
  observacoes: string | null;
  pessoas: Pessoa | null;
}

interface EleitorReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; compromisso_voto: string | null;
  municipio_id: string | null; origem_captacao: string | null;
  observacoes: string | null;
  pessoas: Pessoa | null;
}

interface FiscalReg {
  id: string; criado_em: string; cadastrado_por: string | null;
  suplente_id: string | null; status: string | null;
  municipio_id: string | null; origem_captacao: string | null;
  zona_fiscal: string | null; secao_fiscal: string | null;
  colegio_eleitoral: string | null; observacoes: string | null;
  pessoas: Pessoa | null;
}

interface HierarquiaUsuario {
  id: string; nome: string; tipo: string;
  suplente_id: string | null; municipio_id: string | null; ativo: boolean | null;
}

/* ── constants ── */
type Periodo = 'hoje' | 'semana' | 'mes' | 'total';
type TipoFiltro = 'todos' | 'lideranca' | 'eleitor' | 'fiscal';
type VistaAtiva = 'usuarios' | 'ranking' | 'registros' | 'cidades' | 'localizacao' | 'eventos';
type TipoUsuarioFiltro = 'todos' | 'suplente' | 'lideranca' | 'coordenador';

const periodoLabels: Record<Periodo, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total' };
const tipoFiltroLabels: Record<TipoFiltro, string> = { todos: 'Todos', lideranca: 'Lideranças', eleitor: 'Eleitores', fiscal: 'Fiscais' };
const tipoUsuarioLabels: Record<TipoUsuarioFiltro, string> = { todos: 'Todos', suplente: 'Suplentes', lideranca: 'Lideranças', coordenador: 'Coordenadores' };

const tipoLabel = (t: string) => {
  const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança' };
  return labels[t] || t;
};

export default function AdminDashboard() {
  const { isAdmin, tipoUsuario } = useAuth();
  const { municipios, isTodasCidades, cidadeAtiva, setCidadeAtiva, nomeMunicipioPorId } = useCidade();
  const navigate = useNavigate();

  const [_loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('total');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [vistaAtiva, setVistaAtiva] = useState<VistaAtiva>('ranking');
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [tipoUsuarioFiltro, setTipoUsuarioFiltro] = useState<TipoUsuarioFiltro>('todos');
  const [rankingTipoUsuario, setRankingTipoUsuario] = useState<TipoUsuarioFiltro>('todos');
  const [rankingSearch, setRankingSearch] = useState('');

  const { data: liderancasData, isLoading: lLoading } = useLiderancas('all');
  const { data: eleitoresData, isLoading: eLoading } = useEleitores('all');
  const { data: fiscaisData, isLoading: fLoading } = useFiscaisAdmin();
  const { data: usuariosData, isLoading: uLoading } = useUsuarios();

  const liderancas = (liderancasData || []) as LiderancaReg[];
  const eleitores = (eleitoresData || []) as EleitorReg[];
  const fiscais = (fiscaisData || []) as FiscalReg[];
  const usuarios = (usuariosData || []) as unknown as HierarquiaUsuario[];
  const loading = lLoading || eLoading || fLoading || uLoading;

  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);
  const [popupUser, setPopupUser] = useState<string | null>(null);

  const filtroMunicipioId = useMemo(() =>
    isTodasCidades ? null : cidadeAtiva?.id || null
  , [isTodasCidades, cidadeAtiva]);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
  }, [isAdmin]);

  /* ── date filters ── */
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const inicioSemana = useMemo(() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); return d; }, [hoje]);
  const inicioMes = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1), [hoje]);

  const dateFilter = useCallback((criado_em: string) => {
    if (periodo === 'total') return true;
    const dateLimit = periodo === 'hoje' ? hoje : periodo === 'semana' ? inicioSemana : inicioMes;
    return new Date(criado_em) >= dateLimit;
  }, [periodo, hoje, inicioSemana, inicioMes]);

  const filteredL = useMemo(() => liderancas.filter(r => dateFilter(r.criado_em)), [liderancas, dateFilter]);
  const filteredE = useMemo(() => eleitores.filter(r => dateFilter(r.criado_em)), [eleitores, dateFilter]);
  const filteredF = useMemo(() => fiscais.filter(r => r.criado_em && dateFilter(r.criado_em)), [fiscais, dateFilter]);

  const totais = useMemo(() => ({
    l: filteredL.length, e: filteredE.length, f: filteredF.length,
    total: filteredL.length + filteredE.length + filteredF.length,
  }), [filteredL, filteredE, filteredF]);

  /* ── Ranking (inclui TODOS os usuários, mesmo com 0 cadastros) ── */
  const rankingUsuarios = useMemo(() => {
    const map: Record<string, { l: number; e: number; f: number }> = {};
    // Inicializar todos os usuários (exceto super_admin)
    usuarios.filter(u => u.tipo !== 'super_admin').forEach(u => {
      map[u.id] = { l: 0, e: 0, f: 0 };
    });
    filteredL.forEach(r => { if (!r.cadastrado_por) return; if (!map[r.cadastrado_por]) map[r.cadastrado_por] = { l: 0, e: 0, f: 0 }; map[r.cadastrado_por].l++; });
    filteredE.forEach(r => { if (!r.cadastrado_por) return; if (!map[r.cadastrado_por]) map[r.cadastrado_por] = { l: 0, e: 0, f: 0 }; map[r.cadastrado_por].e++; });
    filteredF.forEach(r => { if (!r.cadastrado_por) return; if (!map[r.cadastrado_por]) map[r.cadastrado_por] = { l: 0, e: 0, f: 0 }; map[r.cadastrado_por].f++; });
    return Object.entries(map)
      .map(([id, stats]) => {
        const u = usuarios.find(u => u.id === id);
        return { id, nome: u?.nome || 'Desconhecido', tipo: u?.tipo || '—', municipio_id: u?.municipio_id || null, total: stats.l + stats.e + stats.f, ...stats };
      })
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [filteredL, filteredE, filteredF, usuarios]);

  /* ── Users list ── */
  const filteredUsers = useMemo(() => {
    let list = usuarios.filter(u => u.tipo !== 'super_admin');
    if (tipoUsuarioFiltro !== 'todos') list = list.filter(u => u.tipo === tipoUsuarioFiltro);
    // Don't filter by city here — show all users and let the UI indicate city
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.nome.toLowerCase().includes(s));
    }
    // Sort: users with matching city first, then others
    if (filtroMunicipioId) {
      list = list.sort((a, b) => {
        const aMatch = a.municipio_id === filtroMunicipioId ? 0 : 1;
        const bMatch = b.municipio_id === filtroMunicipioId ? 0 : 1;
        return aMatch - bMatch || a.nome.localeCompare(b.nome);
      });
    }
    return list;
  }, [usuarios, tipoUsuarioFiltro, filtroMunicipioId, searchTerm]);

  /* ── Registros list ── */
  const allRegistros = useMemo(() => {
    let result: { tipo: string; pessoa: Pessoa | null; criado_em: string; cadastrado_por: string | null; extra: string }[] = [];
    if (tipoFiltro === 'todos' || tipoFiltro === 'lideranca')
      filteredL.forEach(r => result.push({ tipo: 'lideranca', pessoa: r.pessoas, criado_em: r.criado_em, cadastrado_por: r.cadastrado_por, extra: r.status || '' }));
    if (tipoFiltro === 'todos' || tipoFiltro === 'eleitor')
      filteredE.forEach(r => result.push({ tipo: 'eleitor', pessoa: r.pessoas, criado_em: r.criado_em, cadastrado_por: r.cadastrado_por, extra: r.compromisso_voto || '' }));
    if (tipoFiltro === 'todos' || tipoFiltro === 'fiscal')
      filteredF.forEach(r => result.push({ tipo: 'fiscal', pessoa: r.pessoas, criado_em: r.criado_em || '', cadastrado_por: r.cadastrado_por, extra: r.status || '' }));
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(r => r.pessoa?.nome?.toLowerCase().includes(s) || r.pessoa?.cpf?.includes(s));
    }
    return result.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }, [filteredL, filteredE, filteredF, tipoFiltro, searchTerm]);

  const getUserName = (id: string | null) => id ? (usuarios.find(u => u.id === id)?.nome || '—') : '—';
  const getMedalEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;

  const handleExport = async (tipo?: 'lideranca' | 'eleitor' | 'fiscal', cadastradoPorId?: string, cadastradoPorNome?: string) => {
    setExporting(true);
    try {
      const count = await exportCadastrosFiltered({ tipo, cadastradoPorId, cadastradoPorNome });
      toast({ title: `✅ ${count} registros exportados!` });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  /* ── User expanded data ── */
  const userCadastros = useMemo(() => {
    if (!expandedUser) return null;
    return {
      liderancas: filteredL.filter(r => r.cadastrado_por === expandedUser),
      eleitores: filteredE.filter(r => r.cadastrado_por === expandedUser),
      fiscais: filteredF.filter(r => r.cadastrado_por === expandedUser),
    };
  }, [expandedUser, filteredL, filteredE, filteredF]);

  /* ── Popup user data ── */
  const popupUserData = useMemo(() => {
    if (!popupUser) return null;
    const u = usuarios.find(u => u.id === popupUser);
    return {
      usuario: u,
      liderancas: filteredL.filter(r => r.cadastrado_por === popupUser),
      eleitores: filteredE.filter(r => r.cadastrado_por === popupUser),
      fiscais: filteredF.filter(r => r.cadastrado_por === popupUser),
    };
  }, [popupUser, filteredL, filteredE, filteredF, usuarios]);

  const vistaLabels: { id: VistaAtiva; icon: typeof BarChart3; label: string }[] = [
    { id: 'ranking', icon: Trophy, label: 'Ranking' },
    { id: 'usuarios', icon: UserCog, label: 'Usuários' },
    { id: 'localizacao', icon: MapPin, label: 'Localização' },
    { id: 'registros', icon: Eye, label: 'Registros' },
    { id: 'eventos', icon: Calendar, label: 'Eventos' },
    ...(municipios.length > 1 ? [{ id: 'cidades' as VistaAtiva, icon: Building2, label: 'Cidades' }] : []),
  ];

  if (loading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-y-auto overscroll-contain pb-8">
      <div className="h-[1.5px] gradient-header" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Painel Admin</h1>
            <p className="text-[10px] text-muted-foreground">Visão completa da rede</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{totais.total}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">cadastros</p>
          </div>
        </div>
        {municipios.length > 1 && (
          <div className="max-w-3xl mx-auto px-4 pb-2">
            <SeletorCidade />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-4 pb-2">
          <SeletorEvento />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">


        {/* ── Period filter ── */}
        <div className="flex gap-1.5">
          {(Object.keys(periodoLabels) as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`flex-1 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                periodo === p ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>{periodoLabels[p]}</button>
          ))}
        </div>

        {/* ── Tab navigation ── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {vistaLabels.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setVistaAtiva(id); setSearchTerm(''); setRankingSearch(''); setExpandedUser(null); setTipoFiltro('todos'); setRankingTipoUsuario('todos'); }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                vistaAtiva === id ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ══════════ USUÁRIOS ══════════ */}
        {vistaAtiva === 'usuarios' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar usuário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>

            {/* Type filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(tipoUsuarioLabels) as TipoUsuarioFiltro[]).map(t => (
                <button key={t} onClick={() => setTipoUsuarioFiltro(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    tipoUsuarioFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>{tipoUsuarioLabels[t]}</button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}</p>

            {filteredUsers.map(u => {
              const uL = filteredL.filter(r => r.cadastrado_por === u.id);
              const uE = filteredE.filter(r => r.cadastrado_por === u.id);
              const uF = filteredF.filter(r => r.cadastrado_por === u.id);
              const total = uL.length + uE.length + uF.length;
              const isExpanded = expandedUser === u.id;
              const cityName = nomeMunicipioPorId(u.municipio_id);

              return (
                <div key={u.id} className="section-card !p-0 overflow-hidden">
                  <button
                    onClick={() => { setExpandedUser(isExpanded ? null : u.id); setExpandedTipo(null); }}
                    className="w-full text-left p-3 flex items-center gap-3 active:bg-muted/50 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">{tipoLabel(u.tipo)}</span>
                        {cityName && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin size={8} />{cityName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary">{total}</p>
                      <p className="text-[8px] text-muted-foreground">cadastros</p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && userCadastros && (
                    <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                      {/* Counts */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'lideranca', label: 'Lideranças', count: userCadastros.liderancas.length, icon: Users },
                          { key: 'eleitor', label: 'Eleitores', count: userCadastros.eleitores.length, icon: Target },
                          { key: 'fiscal', label: 'Fiscais', count: userCadastros.fiscais.length, icon: Shield },
                        ].map(({ key, label, count, icon: Icon }) => (
                          <button key={key}
                            onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                              expandedTipo === key ? 'border-primary bg-primary/5' : 'border-border bg-card'
                            }`}
                          >
                            <Icon size={14} className={expandedTipo === key ? 'text-primary' : 'text-muted-foreground'} />
                            <span className="text-lg font-bold text-foreground">{count}</span>
                            <span className="text-[9px] text-muted-foreground">{label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Expanded records */}
                      {expandedTipo && (
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                          {(() => {
                            const records = expandedTipo === 'lideranca' ? userCadastros.liderancas
                              : expandedTipo === 'fiscal' ? userCadastros.fiscais
                              : userCadastros.eleitores;
                            if (records.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>;
                            return records.map((r: any) => {
                              const p = r.pessoas || {};
                              const Field = ({ label, value }: { label: string; value: any }) => (
                                <div className="text-[10px] bg-background rounded px-2 py-1">
                                  <span className="text-muted-foreground">{label}:</span>{' '}
                                  <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
                                </div>
                              );
                              return (
                              <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                                <div className="flex items-start justify-between">
                                   <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                                   </div>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                </div>

                                {/* Contato */}
                                <div className="grid grid-cols-2 gap-1">
                                  <Field label="CPF" value={p.cpf} />
                                  <Field label="WhatsApp" value={p.whatsapp} />
                                  <Field label="E-mail" value={p.email} />
                                  <Field label="Rede social" value={p.instagram || p.facebook} />
                                </div>

                                {/* Dados Eleitorais */}
                                <div className="grid grid-cols-2 gap-1">
                                  <Field label="Título" value={p.titulo_eleitor} />
                                  <Field label="Zona / Seção" value={`${p.zona_eleitoral || '—'} / ${p.secao_eleitoral || '—'}`} />
                                  <Field label="Município / UF" value={`${p.municipio_eleitoral || '—'} / ${p.uf_eleitoral || '—'}`} />
                                  <Field label="Colégio" value={p.colegio_eleitoral} />
                                  <Field label="End. Colégio" value={p.endereco_colegio} />
                                </div>

                                {/* Dados específicos */}
                                {expandedTipo === 'lideranca' && (
                                  <div className="grid grid-cols-2 gap-1">
                                    <Field label="Região" value={r.regiao_atuacao} />
                                    <Field label="Comprometimento" value={r.nivel_comprometimento} />
                                    <Field label="Apoiadores" value={r.apoiadores_estimados} />
                                    <Field label="Meta votos" value={r.meta_votos} />
                                  </div>
                                )}
                                {expandedTipo === 'eleitor' && (
                                  <div className="grid grid-cols-2 gap-1">
                                    <Field label="Compromisso" value={r.compromisso_voto} />
                                  </div>
                                )}

                                {/* Observações */}
                                {r.observacoes && <Field label="Observações" value={r.observacoes} />}
                              </div>
                            );});
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button onClick={() => handleExport()} disabled={exporting}
              className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exportar Todos (Excel)
            </button>
          </div>
        )}

        {/* ══════════ RANKING ══════════ */}
        {vistaAtiva === 'ranking' && (() => {
          let filtered = rankingUsuarios;

          // Filtro por tipo de usuário
          if (rankingTipoUsuario !== 'todos') filtered = filtered.filter(u => u.tipo === rankingTipoUsuario);

          // Filtro por tipo de cadastro
          if (tipoFiltro === 'lideranca') filtered = filtered.filter(u => u.l > 0);
          else if (tipoFiltro === 'eleitor') filtered = filtered.filter(u => u.e > 0);
          else if (tipoFiltro === 'fiscal') filtered = filtered.filter(u => u.f > 0);

          // Busca por nome
          if (rankingSearch) {
            const s = rankingSearch.toLowerCase();
            filtered = filtered.filter(u => u.nome.toLowerCase().includes(s));
          }

          const maxTotal = filtered.length > 0 ? Math.max(...filtered.map(u => u.total), 1) : 1;

          return (
          <div className="space-y-3">
            {/* Busca */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar usuário..." value={rankingSearch} onChange={e => setRankingSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>

            {/* Filtro por tipo de usuário */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(tipoUsuarioLabels) as TipoUsuarioFiltro[]).map(t => (
                <button key={t} onClick={() => setRankingTipoUsuario(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    rankingTipoUsuario === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>{tipoUsuarioLabels[t]}</button>
              ))}
            </div>

            {/* Filtro por tipo de cadastro */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
                <button key={t} onClick={() => setTipoFiltro(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    tipoFiltro === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}>{tipoFiltroLabels[t]}</button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</p>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado</p>
            ) : (
              <div className="space-y-2">
                {/* Top 3 destaque (só quando sem busca e filtro "todos") */}
                {!rankingSearch && rankingTipoUsuario === 'todos' && tipoFiltro === 'todos' && filtered.length >= 3 && (
                  <div className="space-y-2 mb-3">
                    {filtered.slice(0, 3).map((u, i) => {
                      const styles = [
                        { gradient: 'from-yellow-500/20 via-amber-400/10 to-transparent', border: 'border-yellow-400/40', medal: '🥇', numColor: 'text-yellow-600' },
                        { gradient: 'from-slate-400/15 via-gray-300/10 to-transparent', border: 'border-slate-300/40', medal: '🥈', numColor: 'text-slate-500' },
                        { gradient: 'from-amber-700/15 via-orange-400/10 to-transparent', border: 'border-amber-600/30', medal: '🥉', numColor: 'text-amber-700' },
                      ];
                      const s = styles[i];
                      return (
                        <div key={u.id} onClick={() => setPopupUser(u.id)}
                          className={`relative flex items-center gap-3 p-3 rounded-xl border ${s.border} bg-gradient-to-r ${s.gradient} cursor-pointer hover:shadow-md transition-all active:scale-[0.98]`}
                        >
                          <span className="text-lg shrink-0">{s.medal}</span>
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{u.nome}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{tipoLabel(u.tipo)}</span>
                              <div className="flex gap-1">
                                {u.l > 0 && <span className="text-[8px] font-semibold text-primary/70">Lid. {u.l}</span>}
                                {u.e > 0 && <span className="text-[8px] font-semibold text-muted-foreground">Eleit. {u.e}</span>}
                                {u.f > 0 && <span className="text-[8px] font-semibold text-amber-600/70">Fisc. {u.f}</span>}
                              </div>
                            </div>
                          </div>
                          <p className={`text-2xl font-black ${s.numColor} shrink-0`}>{u.total}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Lista do ranking com expandir */}
                {filtered.slice((!rankingSearch && rankingTipoUsuario === 'todos' && tipoFiltro === 'todos' && filtered.length >= 3) ? 3 : 0).map((u, i) => {
                  const pos = (!rankingSearch && rankingTipoUsuario === 'todos' && tipoFiltro === 'todos' && filtered.length >= 3) ? i + 3 : i;
                  const pct = maxTotal > 0 ? Math.round((u.total / maxTotal) * 100) : 0;
                  const isExpanded = expandedUser === u.id;
                  const uLiderancas = filteredL.filter(r => r.cadastrado_por === u.id);
                  const uEleitores = filteredE.filter(r => r.cadastrado_por === u.id);
                  const uFiscais = filteredF.filter(r => r.cadastrado_por === u.id);

                  return (
                    <div key={u.id} className="section-card !p-0 overflow-hidden">
                      <button
                        onClick={() => { setExpandedUser(isExpanded ? null : u.id); setExpandedTipo(null); }}
                        className="w-full text-left relative overflow-hidden"
                      >
                        {/* Barra de progresso de fundo */}
                        <div
                          className="absolute inset-y-0 left-0 bg-primary/[0.06] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative p-3 flex items-center gap-2.5">
                          <span className="text-sm font-bold text-muted-foreground w-7 text-center shrink-0">{pos + 1}º</span>
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{tipoLabel(u.tipo)}</span>
                              {u.municipio_id && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><MapPin size={8} />{nomeMunicipioPorId(u.municipio_id)}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-primary">{u.total}</p>
                            <p className="text-[8px] text-muted-foreground">cadastros</p>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                          {/* Counts */}
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { key: 'lideranca', label: 'Lideranças', count: uLiderancas.length, icon: Users },
                              { key: 'eleitor', label: 'Eleitores', count: uEleitores.length, icon: Target },
                              { key: 'fiscal', label: 'Fiscais', count: uFiscais.length, icon: Shield },
                            ].map(({ key, label, count, icon: Icon }) => (
                              <button key={key}
                                onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                                  expandedTipo === key ? 'border-primary bg-primary/5' : 'border-border bg-card'
                                }`}
                              >
                                <Icon size={14} className={expandedTipo === key ? 'text-primary' : 'text-muted-foreground'} />
                                <span className="text-lg font-bold text-foreground">{count}</span>
                                <span className="text-[9px] text-muted-foreground">{label}</span>
                              </button>
                            ))}
                          </div>

                          {/* Expanded records */}
                          {expandedTipo && (
                            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                              {(() => {
                                const records = expandedTipo === 'lideranca' ? uLiderancas
                                  : expandedTipo === 'fiscal' ? uFiscais
                                  : uEleitores;
                                if (records.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro</p>;
                                const Field = ({ label, value }: { label: string; value: any }) => (
                                  <div className="text-[10px] bg-background rounded px-2 py-1">
                                    <span className="text-muted-foreground">{label}:</span>{' '}
                                    <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
                                  </div>
                                );
                                return records.map((r: any) => {
                                  const p = r.pessoas || {};
                                  return (
                                    <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                      </div>

                                      {/* Contato */}
                                      <div className="grid grid-cols-2 gap-1">
                                        <Field label="CPF" value={p.cpf} />
                                        <Field label="WhatsApp" value={p.whatsapp} />
                                        <Field label="E-mail" value={p.email} />
                                        <Field label="Rede social" value={p.instagram || p.facebook} />
                                      </div>

                                      {/* Dados Eleitorais */}
                                      <div className="grid grid-cols-2 gap-1">
                                        <Field label="Título" value={p.titulo_eleitor} />
                                        <Field label="Zona / Seção" value={`${p.zona_eleitoral || '—'} / ${p.secao_eleitoral || '—'}`} />
                                        <Field label="Município / UF" value={`${p.municipio_eleitoral || '—'} / ${p.uf_eleitoral || '—'}`} />
                                        <Field label="Colégio" value={p.colegio_eleitoral} />
                                        <Field label="End. Colégio" value={p.endereco_colegio} />
                                      </div>

                                      {/* Dados específicos */}
                                      {expandedTipo === 'lideranca' && (
                                        <div className="grid grid-cols-2 gap-1">
                                          <Field label="Região" value={r.regiao_atuacao} />
                                          <Field label="Comprometimento" value={r.nivel_comprometimento} />
                                          <Field label="Apoiadores" value={r.apoiadores_estimados} />
                                          <Field label="Meta votos" value={r.meta_votos} />
                                        </div>
                                      )}
                                      {expandedTipo === 'eleitor' && (
                                        <div className="grid grid-cols-2 gap-1">
                                          <Field label="Compromisso" value={r.compromisso_voto} />
                                        </div>
                                      )}
                                      {expandedTipo === 'fiscal' && (
                                        <div className="grid grid-cols-2 gap-1">
                                          <Field label="Zona fiscal" value={r.zona_fiscal} />
                                          <Field label="Seção fiscal" value={r.secao_fiscal} />
                                          <Field label="Colégio" value={r.colegio_eleitoral} />
                                        </div>
                                      )}

                                      {/* Observações */}
                                      {r.observacoes && <Field label="Observações" value={r.observacoes} />}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          )}

                          {/* Export & detail buttons */}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setPopupUser(u.id)}
                              className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold active:scale-95 transition-all">
                              <Eye size={12} /> Ver detalhes
                            </button>
                            <button onClick={() => handleExport(undefined, u.id, u.nome)} disabled={exporting}
                              className="flex-1 h-9 flex items-center justify-center gap-1.5 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-95 transition-all disabled:opacity-50">
                              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              Exportar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
              className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exportar Todos (Excel)
            </button>
          </div>
          );
        })()}

        {/* ══════════ REGISTROS ══════════ */}
        {vistaAtiva === 'registros' && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
                <button key={t} onClick={() => setTipoFiltro(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    tipoFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>{tipoFiltroLabels[t]}</button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{allRegistros.length} registros</p>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {allRegistros.map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-card border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{r.pessoa?.nome || '—'}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>{r.pessoa?.cpf || 'Sem CPF'}</span>
                      <span>{r.pessoa?.telefone || 'Sem tel.'}</span>
                      <span>{r.extra}</span>
                    </div>
                    <p className="text-[9px] text-primary/70 mt-0.5">
                      Por: {getUserName(r.cadastrado_por)} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    r.tipo === 'lideranca' ? 'bg-primary/10 text-primary'
                    : r.tipo === 'fiscal' ? 'bg-amber-500/15 text-amber-600'
                    : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {r.tipo === 'lideranca' ? 'Liderança' : r.tipo === 'fiscal' ? 'Fiscal' : 'Eleitor'}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
              className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exportar {tipoFiltro === 'todos' ? 'Todos' : tipoFiltroLabels[tipoFiltro]} (Excel)
            </button>
          </div>
        )}

        {/* ══════════ EVENTOS ══════════ */}
        {vistaAtiva === 'eventos' && (
          <GerenciarEventos />
        )}

        {/* ══════════ CIDADES ══════════ */}
        {vistaAtiva === 'cidades' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" placeholder="Nome da nova cidade..." id="nova-cidade-input"
                className="flex-1 h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              <button
                onClick={async () => {
                  const input = document.getElementById('nova-cidade-input') as HTMLInputElement;
                  const nome = input?.value?.trim();
                  if (!nome) return;
                  const { error } = await (supabase as any).from('municipios').insert({ nome, uf: 'GO' });
                  if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
                  toast({ title: `✅ ${nome} adicionada!` });
                  input.value = '';
                  // Data will refresh automatically via React Query
                }}
                className="h-10 px-4 gradient-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1 active:scale-95">
                <Plus size={14} /> Adicionar
              </button>
            </div>

            {municipios.map(m => {
              const userCount = usuarios.filter(u => u.municipio_id === m.id).length;
              const lidCount = liderancas.filter(l => l.municipio_id === m.id).length;
              const eleCount = eleitores.filter(e => e.municipio_id === m.id).length;
              const fisCount = fiscais.filter(f => f.municipio_id === m.id).length;

              return (
                <div key={m.id} className="section-card">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 size={18} className="text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{m.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{m.uf} · {userCount} usuários</p>
                      </div>
                    </div>
                    <button onClick={() => { setCidadeAtiva({ id: m.id, nome: m.nome }); setVistaAtiva('usuarios'); }}
                      className="text-[10px] text-primary font-semibold px-2 py-1 rounded-lg bg-primary/5 active:scale-95">
                      Ver →
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Users size={10} /> {lidCount}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Target size={10} /> {eleCount}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Shield size={10} /> {fisCount}</span>
                    <span className="ml-auto text-xs font-bold text-primary">{lidCount + eleCount + fisCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════ LOCALIZAÇÃO ══════════ */}
        {vistaAtiva === 'localizacao' && (
          <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>}>
            <TabLocalizacoes />
          </Suspense>
        )}


      </div>

      {/* ══════════ POPUP CADASTROS DO USUÁRIO ══════════ */}
      {popupUser && popupUserData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPopupUser(null)} />
          <div className="relative w-full max-w-lg max-h-[85vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">{popupUserData.usuario?.nome?.charAt(0) || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground truncate">{popupUserData.usuario?.nome || 'Desconhecido'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">{tipoLabel(popupUserData.usuario?.tipo || '')}</span>
                  {popupUserData.usuario?.municipio_id && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin size={9} />{nomeMunicipioPorId(popupUserData.usuario.municipio_id)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right mr-2">
                <p className="text-2xl font-black text-primary">{popupUserData.liderancas.length + popupUserData.eleitores.length + popupUserData.fiscais.length}</p>
                <p className="text-[9px] text-muted-foreground">cadastros</p>
              </div>
              <button onClick={() => setPopupUser(null)} className="p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border shrink-0">
              {popupUserData.liderancas.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/15 text-primary">
                  <Users size={12} className="inline mr-1" />Lideranças: {popupUserData.liderancas.length}
                </span>
              )}
              {popupUserData.eleitores.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground">
                  <Target size={12} className="inline mr-1" />Eleitores: {popupUserData.eleitores.length}
                </span>
              )}
              {popupUserData.fiscais.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600">
                  <Shield size={12} className="inline mr-1" />Fiscais: {popupUserData.fiscais.length}
                </span>
              )}
            </div>

            {/* Records list */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2">
              {[...popupUserData.liderancas.map(r => ({ ...r, _tipo: 'lideranca' as const })),
                ...popupUserData.eleitores.map(r => ({ ...r, _tipo: 'eleitor' as const })),
                ...popupUserData.fiscais.map(r => ({ ...r, _tipo: 'fiscal' as const }))]
                .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
                .map((r: any) => {
                  const p = r.pessoas || {};
                  const Field = ({ label, value }: { label: string; value: any }) => (
                    <div className="text-[10px] bg-background rounded px-2 py-1">
                      <span className="text-muted-foreground">{label}:</span>{' '}
                      <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
                    </div>
                  );
                  return (
                    <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                            r._tipo === 'lideranca' ? 'bg-primary/15 text-primary' : r._tipo === 'fiscal' ? 'bg-amber-500/15 text-amber-600' : 'bg-secondary text-secondary-foreground'
                          }`}>{r._tipo === 'lideranca' ? 'Liderança' : r._tipo === 'fiscal' ? 'Fiscal' : 'Eleitor'}</span>
                          <p className="text-sm font-semibold text-foreground">{p.nome || '—'}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {/* Contato */}
                      <div className="grid grid-cols-2 gap-1">
                        <Field label="CPF" value={p.cpf} />
                        <Field label="WhatsApp" value={p.whatsapp} />
                        <Field label="Telefone" value={p.telefone} />
                        <Field label="E-mail" value={p.email} />
                        <Field label="Rede social" value={p.instagram || p.facebook} />
                      </div>

                      {/* Dados Eleitorais */}
                      <div className="grid grid-cols-2 gap-1">
                        <Field label="Título" value={p.titulo_eleitor} />
                        <Field label="Zona / Seção" value={`${p.zona_eleitoral || '—'} / ${p.secao_eleitoral || '—'}`} />
                        <Field label="Município / UF" value={`${p.municipio_eleitoral || '—'} / ${p.uf_eleitoral || '—'}`} />
                        <Field label="Colégio" value={p.colegio_eleitoral} />
                        <Field label="End. Colégio" value={p.endereco_colegio} />
                      </div>

                      {/* Dados específicos */}
                      {r._tipo === 'lideranca' && (
                        <div className="grid grid-cols-2 gap-1">
                          <Field label="Região" value={r.regiao_atuacao} />
                          <Field label="Comprometimento" value={r.nivel_comprometimento} />
                          <Field label="Apoiadores" value={r.apoiadores_estimados} />
                          <Field label="Meta votos" value={r.meta_votos} />
                        </div>
                      )}
                      {r._tipo === 'eleitor' && (
                        <div className="grid grid-cols-2 gap-1">
                          <Field label="Compromisso" value={r.compromisso_voto} />
                        </div>
                      )}
                      {r._tipo === 'fiscal' && (
                        <div className="grid grid-cols-2 gap-1">
                          <Field label="Zona fiscal" value={r.zona_fiscal} />
                          <Field label="Seção fiscal" value={r.secao_fiscal} />
                          <Field label="Colégio" value={r.colegio_eleitoral} />
                        </div>
                      )}

                      {/* Observações */}
                      {r.observacoes && <Field label="Observações" value={r.observacoes} />}
                    </div>
                  );
                })}
              {popupUserData.liderancas.length === 0 && popupUserData.eleitores.length === 0 && popupUserData.fiscais.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro no período selecionado</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
