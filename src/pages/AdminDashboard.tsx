import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Users, TrendingUp, Shield, Target, Filter, Search,
  ChevronDown, ChevronUp, UserCheck, Loader2, Download, Eye, Trophy,
  BarChart3, UserCog, Building2
} from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar
} from 'recharts';
import SeletorCidade from '@/components/SeletorCidade';

/* ── types ── */
interface Pessoa {
  nome: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  zona_eleitoral: string | null;
  secao_eleitoral: string | null;
}

interface LiderancaReg {
  id: string;
  criado_em: string;
  cadastrado_por: string | null;
  suplente_id: string | null;
  status: string | null;
  regiao_atuacao: string | null;
  tipo_lideranca: string | null;
  pessoas: Pessoa | null;
}

interface FiscalReg {
  id: string;
  criado_em: string;
  cadastrado_por: string | null;
  suplente_id: string | null;
  status: string | null;
  zona_fiscal: string | null;
  secao_fiscal: string | null;
  colegio_eleitoral: string | null;
  pessoas: Pessoa | null;
}

interface EleitorReg {
  id: string;
  criado_em: string;
  cadastrado_por: string | null;
  suplente_id: string | null;
  compromisso_voto: string | null;
  pessoas: Pessoa | null;
}

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  suplente_id: string | null;
  ativo: boolean | null;
}

/* ── helpers ── */
const TIPO_COLORS: Record<string, string> = {
  lideranca: 'hsl(217 91% 60%)',
  fiscal: 'hsl(142 71% 45%)',
  eleitor: 'hsl(280 70% 55%)',
};

type Periodo = 'hoje' | 'semana' | 'mes' | 'total';
type TipoFiltro = 'todos' | 'lideranca' | 'fiscal' | 'eleitor';
type VistaAtiva = 'resumo' | 'ranking' | 'usuarios' | 'registros' | 'cidades';

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const { municipios, isTodasCidades, cidadeAtiva, setCidadeAtiva } = useCidade();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('total');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [vistaAtiva, setVistaAtiva] = useState<VistaAtiva>('resumo');
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);

  const [liderancas, setLiderancas] = useState<LiderancaReg[]>([]);
  const [fiscais, setFiscais] = useState<FiscalReg[]>([]);
  const [eleitores, setEleitores] = useState<EleitorReg[]>([]);
  const [usuarios, setUsuarios] = useState<HierarquiaUsuario[]>([]);

  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [lRes, fRes, eRes, uRes] = await Promise.all([
      supabase.from('liderancas').select('id, criado_em, cadastrado_por, suplente_id, status, regiao_atuacao, tipo_lideranca, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral)'),
      supabase.from('fiscais').select('id, criado_em, cadastrado_por, suplente_id, status, zona_fiscal, secao_fiscal, colegio_eleitoral, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral)'),
      supabase.from('possiveis_eleitores').select('id, criado_em, cadastrado_por, suplente_id, compromisso_voto, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral)'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id, ativo').eq('ativo', true),
    ]);

    setLiderancas((lRes.data || []) as any);
    setFiscais((fRes.data || []) as any);
    setEleitores((eRes.data || []) as any);
    setUsuarios((uRes.data || []) as any);
    setLoading(false);
  };

  const handleExport = async (tipo?: 'lideranca' | 'fiscal' | 'eleitor') => {
    setExporting(true);
    try {
      const count = await exportAllCadastros(tipo);
      toast({ title: `✅ ${count} registros exportados!` });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  /* ── date boundaries ── */
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const inicioSemana = useMemo(() => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay()); return d; }, [hoje]);
  const inicioMes = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1), [hoje]);

  const getDateFilter = (p: Periodo) => {
    if (p === 'hoje') return hoje;
    if (p === 'semana') return inicioSemana;
    if (p === 'mes') return inicioMes;
    return null;
  };

  const dateFilter = (criado_em: string) => {
    const dateLimit = getDateFilter(periodo);
    if (!dateLimit) return true;
    return new Date(criado_em) >= dateLimit;
  };

  const filteredLiderancas = useMemo(() => liderancas.filter(r => dateFilter(r.criado_em)), [liderancas, periodo]);
  const filteredFiscais = useMemo(() => fiscais.filter(r => dateFilter(r.criado_em)), [fiscais, periodo]);
  const filteredEleitores = useMemo(() => eleitores.filter(r => dateFilter(r.criado_em)), [eleitores, periodo]);

  const totais = useMemo(() => ({
    liderancas: filteredLiderancas.length,
    fiscais: filteredFiscais.length,
    eleitores: filteredEleitores.length,
    total: filteredLiderancas.length + filteredFiscais.length + filteredEleitores.length,
  }), [filteredLiderancas, filteredFiscais, filteredEleitores]);

  /* ── Ranking por usuário ── */
  const rankingUsuarios = useMemo(() => {
    const map: Record<string, { l: number; f: number; e: number }> = {};
    
    filteredLiderancas.forEach(r => {
      if (!r.cadastrado_por) return;
      if (!map[r.cadastrado_por]) map[r.cadastrado_por] = { l: 0, f: 0, e: 0 };
      map[r.cadastrado_por].l++;
    });
    filteredFiscais.forEach(r => {
      if (!r.cadastrado_por) return;
      if (!map[r.cadastrado_por]) map[r.cadastrado_por] = { l: 0, f: 0, e: 0 };
      map[r.cadastrado_por].f++;
    });
    filteredEleitores.forEach(r => {
      if (!r.cadastrado_por) return;
      if (!map[r.cadastrado_por]) map[r.cadastrado_por] = { l: 0, f: 0, e: 0 };
      map[r.cadastrado_por].e++;
    });

    return Object.entries(map)
      .map(([id, stats]) => {
        const u = usuarios.find(u => u.id === id);
        return {
          id,
          nome: u?.nome || 'Desconhecido',
          tipo: u?.tipo || '—',
          total: stats.l + stats.f + stats.e,
          ...stats,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredLiderancas, filteredFiscais, filteredEleitores, usuarios]);

  /* ── Dados do usuário expandido ── */
  const usuarioExpandido = useMemo(() => {
    if (!expandedUser) return null;
    const uLiderancas = filteredLiderancas.filter(r => r.cadastrado_por === expandedUser);
    const uFiscais = filteredFiscais.filter(r => r.cadastrado_por === expandedUser);
    const uEleitores = filteredEleitores.filter(r => r.cadastrado_por === expandedUser);
    return { liderancas: uLiderancas, fiscais: uFiscais, eleitores: uEleitores };
  }, [expandedUser, filteredLiderancas, filteredFiscais, filteredEleitores]);

  /* ── All registros for the "registros" tab ── */
  const allRegistros = useMemo(() => {
    let result: { tipo: string; pessoa: Pessoa | null; criado_em: string; cadastrado_por: string | null; extra: string }[] = [];
    
    if (tipoFiltro === 'todos' || tipoFiltro === 'lideranca') {
      filteredLiderancas.forEach(r => result.push({
        tipo: 'lideranca', pessoa: r.pessoas, criado_em: r.criado_em,
        cadastrado_por: r.cadastrado_por, extra: r.status || ''
      }));
    }
    if (tipoFiltro === 'todos' || tipoFiltro === 'fiscal') {
      filteredFiscais.forEach(r => result.push({
        tipo: 'fiscal', pessoa: r.pessoas, criado_em: r.criado_em,
        cadastrado_por: r.cadastrado_por, extra: `Z${r.zona_fiscal || '?'} S${r.secao_fiscal || '?'}`
      }));
    }
    if (tipoFiltro === 'todos' || tipoFiltro === 'eleitor') {
      filteredEleitores.forEach(r => result.push({
        tipo: 'eleitor', pessoa: r.pessoas, criado_em: r.criado_em,
        cadastrado_por: r.cadastrado_por, extra: r.compromisso_voto || ''
      }));
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(r => r.pessoa?.nome?.toLowerCase().includes(s) || r.pessoa?.cpf?.includes(s));
    }

    return result.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }, [filteredLiderancas, filteredFiscais, filteredEleitores, tipoFiltro, searchTerm]);

  /* ── timeline data ── */
  const timelineData = useMemo(() => {
    const map: Record<string, { liderancas: number; fiscais: number; eleitores: number }> = {};
    const addToMap = (criado_em: string, tipo: string) => {
      const d = new Date(criado_em);
      const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!map[key]) map[key] = { liderancas: 0, fiscais: 0, eleitores: 0 };
      if (tipo === 'lideranca') map[key].liderancas++;
      if (tipo === 'fiscal') map[key].fiscais++;
      if (tipo === 'eleitor') map[key].eleitores++;
    };
    filteredLiderancas.forEach(r => addToMap(r.criado_em, 'lideranca'));
    filteredFiscais.forEach(r => addToMap(r.criado_em, 'fiscal'));
    filteredEleitores.forEach(r => addToMap(r.criado_em, 'eleitor'));

    return Object.entries(map)
      .sort(([a], [b]) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
      })
      .map(([dia, vals]) => ({ dia, ...vals, total: vals.liderancas + vals.fiscais + vals.eleitores }));
  }, [filteredLiderancas, filteredFiscais, filteredEleitores]);

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança', fiscal: 'Fiscal' };
    return labels[t] || t;
  };

  const getMedalEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
  const getUserName = (id: string | null) => {
    if (!id) return '—';
    return usuarios.find(u => u.id === id)?.nome || '—';
  };

  const periodoLabels: Record<Periodo, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total' };
  const tipoFiltroLabels: Record<TipoFiltro, string> = { todos: 'Todos', lideranca: 'Lideranças', fiscal: 'Fiscais', eleitor: 'Eleitores' };
  const vistaLabels: { id: VistaAtiva; icon: typeof BarChart3; label: string }[] = [
    { id: 'resumo', icon: BarChart3, label: 'Resumo' },
    { id: 'ranking', icon: Trophy, label: 'Ranking' },
    { id: 'usuarios', icon: UserCog, label: 'Por Usuário' },
    { id: 'registros', icon: Eye, label: 'Registros' },
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
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* ── Navegação de vistas ── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {vistaLabels.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setVistaAtiva(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                vistaAtiva === id ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Filtros ── */}
        <div className="section-card">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-primary" />
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Filtros</h2>
          </div>
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(periodoLabels) as Periodo[]).map(p => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    periodo === p ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>{periodoLabels[p]}</button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(tipoFiltroLabels) as TipoFiltro[]).map(t => (
                <button key={t} onClick={() => setTipoFiltro(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                    tipoFiltro === t ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>{tipoFiltroLabels[t]}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════ RESUMO ══════════ */}
        {vistaAtiva === 'resumo' && (
          <>
            {/* Cards de totais */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Users, label: 'Lideranças', value: totais.liderancas, color: TIPO_COLORS.lideranca },
                { icon: Shield, label: 'Fiscais', value: totais.fiscais, color: TIPO_COLORS.fiscal },
                { icon: Target, label: 'Eleitores', value: totais.eleitores, color: TIPO_COLORS.eleitor },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="section-card text-center">
                  <Icon size={18} className="mx-auto mb-1" style={{ color }} />
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            {timelineData.length > 0 && (
              <div className="section-card">
                <h2 className="section-title">📈 Cadastros por Dia</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="liderancas" name="Lideranças" stackId="a" fill={TIPO_COLORS.lideranca} />
                      <Bar dataKey="fiscais" name="Fiscais" stackId="a" fill={TIPO_COLORS.fiscal} />
                      <Bar dataKey="eleitores" name="Eleitores" stackId="a" fill={TIPO_COLORS.eleitor} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top 5 rápido */}
            <div className="section-card">
              <h2 className="section-title">🔥 Top 5 – Quem mais cadastrou</h2>
              <div className="space-y-1.5">
                {rankingUsuarios.slice(0, 5).map((u, i) => (
                  <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50">
                    <span className="text-base w-7 text-center shrink-0">{getMedalEmoji(i)}</span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{u.nome.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                      <span className="text-[9px] text-muted-foreground">{tipoLabel(u.tipo)}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {u.l > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(217, 91%, 60%, 0.1)', color: TIPO_COLORS.lideranca }}>{u.l}</span>}
                      {u.f > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(142, 71%, 45%, 0.1)', color: TIPO_COLORS.fiscal }}>{u.f}</span>}
                      {u.e > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>{u.e}</span>}
                    </div>
                    <p className="text-sm font-bold text-primary shrink-0">{u.total}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Exportar */}
            <button onClick={() => handleExport()} disabled={exporting}
              className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exportar Todos (CSV)
            </button>
          </>
        )}

        {/* ══════════ RANKING ══════════ */}
        {vistaAtiva === 'ranking' && (
          <div className="section-card">
            <h2 className="section-title">🏆 Ranking Completo – Quem mais cadastrou</h2>
            {rankingUsuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum cadastro no período</p>
            ) : (
              <div className="space-y-1.5">
                {rankingUsuarios.map((u, i) => (
                  <div key={u.id} className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                    i === 0 ? 'border-amber-400/40 bg-amber-500/5' :
                    i === 1 ? 'border-slate-400/30 bg-slate-500/5' :
                    i === 2 ? 'border-orange-400/30 bg-orange-500/5' :
                    'border-border bg-card'
                  }`}>
                    <span className="text-lg w-8 text-center shrink-0">{getMedalEmoji(i)}</span>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{u.nome.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                      <span className="text-[9px] text-muted-foreground">{tipoLabel(u.tipo)}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {u.l > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(217, 91%, 60%, 0.1)', color: TIPO_COLORS.lideranca }}>L{u.l}</span>}
                      {u.f > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(142, 71%, 45%, 0.1)', color: TIPO_COLORS.fiscal }}>F{u.f}</span>}
                      {u.e > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>E{u.e}</span>}
                    </div>
                    <p className="text-lg font-bold text-primary shrink-0">{u.total}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════ POR USUÁRIO ══════════ */}
        {vistaAtiva === 'usuarios' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {usuarios
              .filter(u => u.tipo !== 'super_admin')
              .filter(u => !searchTerm || u.nome.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(u => {
                const uL = filteredLiderancas.filter(r => r.cadastrado_por === u.id);
                const uF = filteredFiscais.filter(r => r.cadastrado_por === u.id);
                const uE = filteredEleitores.filter(r => r.cadastrado_por === u.id);
                const total = uL.length + uF.length + uE.length;
                const isExpanded = expandedUser === u.id;

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
                        <span className="text-[10px] text-muted-foreground">{tipoLabel(u.tipo)}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(217, 91%, 60%, 0.1)', color: TIPO_COLORS.lideranca }}>{uL.length}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(142, 71%, 45%, 0.1)', color: TIPO_COLORS.fiscal }}>{uF.length}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>{uE.length}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="text-lg font-bold text-primary">{total}</p>
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && usuarioExpandido && (
                      <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                        {/* Sub-tabs por tipo */}
                        <div className="flex gap-1.5">
                          {[
                            { key: 'lideranca', label: `Lideranças (${usuarioExpandido.liderancas.length})`, color: TIPO_COLORS.lideranca },
                            { key: 'fiscal', label: `Fiscais (${usuarioExpandido.fiscais.length})`, color: TIPO_COLORS.fiscal },
                            { key: 'eleitor', label: `Eleitores (${usuarioExpandido.eleitores.length})`, color: TIPO_COLORS.eleitor },
                          ].map(({ key, label, color }) => (
                            <button key={key}
                              onClick={() => setExpandedTipo(expandedTipo === key ? null : key)}
                              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all ${
                                expandedTipo === key ? 'text-white' : 'bg-muted text-muted-foreground'
                              }`}
                              style={expandedTipo === key ? { background: color } : undefined}
                            >{label}</button>
                          ))}
                        </div>

                        {/* Lideranças */}
                        {expandedTipo === 'lideranca' && (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {usuarioExpandido.liderancas.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma liderança cadastrada</p>
                            ) : usuarioExpandido.liderancas.map((r: any) => (
                              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="flex items-center gap-3 p-3">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsla(217, 91%, 60%, 0.1)' }}>
                                    <span className="text-xs font-bold" style={{ color: TIPO_COLORS.lideranca }}>{(r.pessoas?.nome || '?').charAt(0)}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{r.pessoas?.nome || '—'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {r.status && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">{r.status}</span>}
                                      {r.tipo_lideranca && <span className="text-[10px] text-muted-foreground">{r.tipo_lideranca}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                                  {r.pessoas?.cpf && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">CPF</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.cpf}</span></div>}
                                  {r.pessoas?.telefone && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Telefone</span><a href={`tel:${r.pessoas.telefone}`} className="text-[10px] font-medium text-primary">{r.pessoas.telefone}</a></div>}
                                  {r.pessoas?.whatsapp && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">WhatsApp</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.whatsapp}</span></div>}
                                  {r.regiao_atuacao && <div className="flex justify-between col-span-2"><span className="text-[10px] text-muted-foreground">Região</span><span className="text-[10px] font-medium text-foreground">{r.regiao_atuacao}</span></div>}
                                  {r.pessoas?.zona_eleitoral && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Zona</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.zona_eleitoral}</span></div>}
                                  {r.pessoas?.secao_eleitoral && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Seção</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.secao_eleitoral}</span></div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Fiscais */}
                        {expandedTipo === 'fiscal' && (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {usuarioExpandido.fiscais.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Nenhum fiscal cadastrado</p>
                            ) : usuarioExpandido.fiscais.map((r: any) => (
                              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="flex items-center gap-3 p-3">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsla(142, 71%, 45%, 0.1)' }}>
                                    <span className="text-xs font-bold" style={{ color: TIPO_COLORS.fiscal }}>{(r.pessoas?.nome || '?').charAt(0)}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{r.pessoas?.nome || '—'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {r.status && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">{r.status}</span>}
                                      {(r.zona_fiscal || r.secao_fiscal) && <span className="text-[10px] text-muted-foreground">Z{r.zona_fiscal || '—'} S{r.secao_fiscal || '—'}</span>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                                  {r.pessoas?.cpf && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">CPF</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.cpf}</span></div>}
                                  {r.pessoas?.telefone && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Telefone</span><a href={`tel:${r.pessoas.telefone}`} className="text-[10px] font-medium text-primary">{r.pessoas.telefone}</a></div>}
                                  {r.pessoas?.whatsapp && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">WhatsApp</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.whatsapp}</span></div>}
                                  {r.colegio_eleitoral && <div className="flex justify-between col-span-2"><span className="text-[10px] text-muted-foreground">Colégio</span><span className="text-[10px] font-medium text-foreground">{r.colegio_eleitoral}</span></div>}
                                  {r.pessoas?.zona_eleitoral && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Zona eleitoral</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.zona_eleitoral}</span></div>}
                                  {r.pessoas?.secao_eleitoral && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Seção eleitoral</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.secao_eleitoral}</span></div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Eleitores */}
                        {expandedTipo === 'eleitor' && (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {usuarioExpandido.eleitores.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Nenhum eleitor cadastrado</p>
                            ) : usuarioExpandido.eleitores.map((r: any) => {
                              const votoBg: Record<string, string> = {
                                'Confirmado': 'bg-emerald-500/10 text-emerald-600',
                                'Provável': 'bg-blue-500/10 text-blue-600',
                                'Indefinido': 'bg-amber-500/10 text-amber-600',
                                'Improvável': 'bg-red-500/10 text-red-600',
                              };
                              return (
                                <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                                  <div className="flex items-center gap-3 p-3">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsla(280, 70%, 55%, 0.1)' }}>
                                      <span className="text-xs font-bold" style={{ color: TIPO_COLORS.eleitor }}>{(r.pessoas?.nome || '?').charAt(0)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">{r.pessoas?.nome || '—'}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${votoBg[r.compromisso_voto || ''] || 'bg-muted text-muted-foreground'}`}>
                                          {r.compromisso_voto || 'Indefinido'}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                                  </div>
                                  <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                                    {r.pessoas?.cpf && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">CPF</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.cpf}</span></div>}
                                    {r.pessoas?.telefone && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Telefone</span><a href={`tel:${r.pessoas.telefone}`} className="text-[10px] font-medium text-primary">{r.pessoas.telefone}</a></div>}
                                    {r.pessoas?.whatsapp && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">WhatsApp</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.whatsapp}</span></div>}
                                    {r.pessoas?.zona_eleitoral && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Zona</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.zona_eleitoral}</span></div>}
                                    {r.pessoas?.secao_eleitoral && <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Seção</span><span className="text-[10px] font-medium text-foreground">{r.pessoas.secao_eleitoral}</span></div>}
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
              })}
          </div>
        )}

        {/* ══════════ REGISTROS ══════════ */}
        {vistaAtiva === 'registros' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <p className="text-xs text-muted-foreground">{allRegistros.length} registros encontrados</p>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {allRegistros.map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-card border border-border">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: TIPO_COLORS[r.tipo] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.pessoa?.nome || '—'}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>{r.pessoa?.cpf || 'Sem CPF'}</span>
                      <span>{r.pessoa?.telefone || 'Sem tel.'}</span>
                      <span>{r.extra}</span>
                    </div>
                    <p className="text-[9px] text-primary/70 mt-0.5">
                      Por: {getUserName(r.cadastrado_por)} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{
                    background: r.tipo === 'lideranca' ? 'hsla(217, 91%, 60%, 0.1)' : r.tipo === 'fiscal' ? 'hsla(142, 71%, 45%, 0.1)' : 'hsla(280, 70%, 55%, 0.1)',
                    color: TIPO_COLORS[r.tipo]
                  }}>
                    {r.tipo === 'lideranca' ? 'Liderança' : r.tipo === 'fiscal' ? 'Fiscal' : 'Eleitor'}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={() => handleExport(tipoFiltro === 'todos' ? undefined : tipoFiltro as any)} disabled={exporting}
              className="w-full h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Exportar {tipoFiltro === 'todos' ? 'Todos' : tipoFiltroLabels[tipoFiltro]} (CSV)
            </button>
          </div>
        )}

        {/* ══════════ CIDADES ══════════ */}
        {vistaAtiva === 'cidades' && (
          <div className="space-y-3">
            {municipios.map(m => (
              <div key={m.id} className="section-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground">{m.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{m.uf}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setCidadeAtiva({ id: m.id, nome: m.nome }); navigate('/'); }}
                    className="text-[10px] text-primary font-semibold px-2 py-1 rounded-lg bg-primary/5 active:scale-95"
                  >
                    Ver cidade →
                  </button>
                </div>
              </div>
            ))}
            {municipios.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhum município cadastrado</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
