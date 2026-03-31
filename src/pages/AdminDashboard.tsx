import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Users, TrendingUp, Shield, Target, Filter,
  ChevronDown, ChevronUp, UserCheck, Loader2, Download, List, ArrowRight
} from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar
} from 'recharts';

/* ── types ── */
interface Cadastro {
  id: string;
  criado_em: string;
  cadastrado_por: string | null;
  suplente_id: string | null;
  tipo: 'lideranca' | 'fiscal' | 'eleitor';
}

interface HierarquiaUsuario {
  id: string;
  nome: string;
  tipo: string;
  suplente_id: string | null;
}

interface Suplente {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  partido: string | null;
}

/* ── helpers ── */
const TIPO_COLORS: Record<string, string> = {
  lideranca: 'hsl(217 91% 60%)',
  fiscal: 'hsl(142 71% 45%)',
  eleitor: 'hsl(280 70% 55%)',
};

type Periodo = 'hoje' | 'semana' | 'mes' | 'total';
type TipoFiltro = 'todos' | 'lideranca' | 'fiscal' | 'eleitor';

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [usuarios, setUsuarios] = useState<HierarquiaUsuario[]>([]);
  const [suplentes, setSuplentes] = useState<Suplente[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('total');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [expandedSuplente, setExpandedSuplente] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showRecords, setShowRecords] = useState<'lideranca' | 'fiscal' | 'eleitor' | null>(null);
  const [recordsData, setRecordsData] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const handleExport = async (tipo?: 'lideranca' | 'fiscal' | 'eleitor') => {
    setExporting(true);
    try {
      const count = await exportAllCadastros(tipo);
      toast({ title: `✅ ${count} registros exportados!` });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  const handleShowRecords = async (tipo: 'lideranca' | 'fiscal' | 'eleitor') => {
    if (showRecords === tipo) { setShowRecords(null); return; }
    setShowRecords(tipo);
    setLoadingRecords(true);
    try {
      if (tipo === 'lideranca') {
        const { data } = await supabase.from('liderancas').select('id, status, criado_em, cadastrado_por, pessoas(nome, cpf, telefone), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)').order('criado_em', { ascending: false });
        setRecordsData(data || []);
      } else if (tipo === 'fiscal') {
        const { data } = await supabase.from('fiscais').select('id, status, criado_em, cadastrado_por, zona_fiscal, secao_fiscal, pessoas(nome, cpf, telefone), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome)').order('criado_em', { ascending: false });
        setRecordsData(data || []);
      } else {
        const { data } = await supabase.from('possiveis_eleitores').select('id, compromisso_voto, criado_em, cadastrado_por, pessoas(nome, cpf, telefone), hierarquia_usuarios!possiveis_eleitores_cadastrado_por_fkey(nome)').order('criado_em', { ascending: false });
        setRecordsData(data || []);
      }
    } catch { setRecordsData([]); }
    finally { setLoadingRecords(false); }
  };

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    const [lRes, fRes, eRes, uRes, supRes] = await Promise.all([
      supabase.from('liderancas').select('id, criado_em, cadastrado_por, suplente_id'),
      supabase.from('fiscais').select('id, criado_em, cadastrado_por, suplente_id'),
      supabase.from('possiveis_eleitores').select('id, criado_em, cadastrado_por, suplente_id'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id').eq('ativo', true),
      supabase.functions.invoke('buscar-suplentes'),
    ]);

    const allCadastros: Cadastro[] = [
      ...(lRes.data || []).map(r => ({ ...r, tipo: 'lideranca' as const })),
      ...(fRes.data || []).map(r => ({ ...r, tipo: 'fiscal' as const })),
      ...(eRes.data || []).map(r => ({ ...r, tipo: 'eleitor' as const })),
    ];

    setCadastros(allCadastros);
    setUsuarios(uRes.data || []);
    setSuplentes(supRes.data || []);
    setLoading(false);
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

  const filteredCadastros = useMemo(() => {
    let data = cadastros;
    if (tipoFiltro !== 'todos') data = data.filter(c => c.tipo === tipoFiltro);
    const dateLimit = getDateFilter(periodo);
    if (dateLimit) data = data.filter(c => new Date(c.criado_em) >= dateLimit);
    return data;
  }, [cadastros, tipoFiltro, periodo, hoje, inicioSemana, inicioMes]);

  const totais = useMemo(() => {
    return {
      liderancas: filteredCadastros.filter(c => c.tipo === 'lideranca').length,
      fiscais: filteredCadastros.filter(c => c.tipo === 'fiscal').length,
      eleitores: filteredCadastros.filter(c => c.tipo === 'eleitor').length,
      total: filteredCadastros.length,
    };
  }, [filteredCadastros]);

  /* ── agent -> suplente map ── */
  const agentToSuplente = useMemo(() => {
    const map: Record<string, string> = {};
    usuarios.forEach(u => { if (u.suplente_id) map[u.id] = u.suplente_id; });
    return map;
  }, [usuarios]);

  /* ── ranking por suplente ── */
  const rankingSuplentes = useMemo(() => {
    const map: Record<string, { total: number; liderancas: number; fiscais: number; eleitores: number; agentes: Set<string> }> = {};

    // Start with ALL suplentes so they always appear
    suplentes.forEach(s => {
      map[s.id] = { total: 0, liderancas: 0, fiscais: 0, eleitores: 0, agentes: new Set() };
    });

    filteredCadastros.forEach(c => {
      const supId = c.suplente_id || (c.cadastrado_por ? agentToSuplente[c.cadastrado_por] : null);
      if (!supId) return; // skip non-suplente registrations here
      if (!map[supId]) map[supId] = { total: 0, liderancas: 0, fiscais: 0, eleitores: 0, agentes: new Set() };
      map[supId].total++;
      if (c.cadastrado_por) map[supId].agentes.add(c.cadastrado_por);
      if (c.tipo === 'lideranca') map[supId].liderancas++;
      if (c.tipo === 'fiscal') map[supId].fiscais++;
      if (c.tipo === 'eleitor') map[supId].eleitores++;
    });

    return Object.entries(map)
      .map(([id, { agentes: ag, ...stats }]) => {
        const sup = suplentes.find(s => s.id === id);
        return {
          id,
          nome: sup?.nome || 'Desconhecido',
          regiao: sup?.regiao_atuacao || '',
          partido: sup?.partido || '',
          qtdAgentes: ag.size,
          ...stats,
        };
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [filteredCadastros, agentToSuplente, suplentes]);

  /* ── ranking de usuários sem suplente (livres) ── */
  const rankingLivres = useMemo(() => {
    // Find users without suplente_id who are not super_admin
    const livreUserIds = new Set(
      usuarios.filter(u => !u.suplente_id && u.tipo !== 'super_admin').map(u => u.id)
    );
    
    const map: Record<string, { total: number; liderancas: number; fiscais: number; eleitores: number }> = {};

    filteredCadastros.forEach(c => {
      if (!c.cadastrado_por) return;
      // Only count if registrant is a "livre" user AND registration has no suplente
      const supId = c.suplente_id || agentToSuplente[c.cadastrado_por];
      if (supId) return; // belongs to a suplente, skip
      if (!livreUserIds.has(c.cadastrado_por)) return;
      
      if (!map[c.cadastrado_por]) map[c.cadastrado_por] = { total: 0, liderancas: 0, fiscais: 0, eleitores: 0 };
      map[c.cadastrado_por].total++;
      if (c.tipo === 'lideranca') map[c.cadastrado_por].liderancas++;
      if (c.tipo === 'fiscal') map[c.cadastrado_por].fiscais++;
      if (c.tipo === 'eleitor') map[c.cadastrado_por].eleitores++;
    });

    return Object.entries(map)
      .map(([id, stats]) => {
        const u = usuarios.find(u => u.id === id);
        return { id, nome: u?.nome || 'Desconhecido', tipo: u?.tipo || '—', ...stats };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredCadastros, usuarios, agentToSuplente]);

  /* ── agentes de um suplente expandido ── */
  const agentesDoSuplente = useMemo(() => {
    if (!expandedSuplente) return [];
    const agentMap: Record<string, { total: number; liderancas: number; fiscais: number; eleitores: number }> = {};
    
    filteredCadastros.forEach(c => {
      if (!c.cadastrado_por) return;
      const supId = c.suplente_id || agentToSuplente[c.cadastrado_por] || 'sem-suplente';
      if (supId !== expandedSuplente) return;
      if (!agentMap[c.cadastrado_por]) agentMap[c.cadastrado_por] = { total: 0, liderancas: 0, fiscais: 0, eleitores: 0 };
      agentMap[c.cadastrado_por].total++;
      if (c.tipo === 'lideranca') agentMap[c.cadastrado_por].liderancas++;
      if (c.tipo === 'fiscal') agentMap[c.cadastrado_por].fiscais++;
      if (c.tipo === 'eleitor') agentMap[c.cadastrado_por].eleitores++;
    });

    return Object.entries(agentMap)
      .map(([id, stats]) => {
        const agent = usuarios.find(u => u.id === id);
        return { id, nome: agent?.nome || 'Desconhecido', tipo: agent?.tipo || '—', ...stats };
      })
      .sort((a, b) => b.total - a.total);
  }, [expandedSuplente, filteredCadastros, usuarios, agentToSuplente]);

  /* ── timeline data ── */
  const timelineData = useMemo(() => {
    const map: Record<string, { liderancas: number; fiscais: number; eleitores: number }> = {};
    filteredCadastros.forEach(c => {
      const d = new Date(c.criado_em);
      const key = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!map[key]) map[key] = { liderancas: 0, fiscais: 0, eleitores: 0 };
      if (c.tipo === 'lideranca') map[key].liderancas++;
      if (c.tipo === 'fiscal') map[key].fiscais++;
      if (c.tipo === 'eleitor') map[key].eleitores++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
      })
      .map(([dia, vals]) => ({ dia, ...vals, total: vals.liderancas + vals.fiscais + vals.eleitores }));
  }, [filteredCadastros]);

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança', fiscal: 'Fiscal' };
    return labels[t] || t;
  };

  const getMedalEmoji = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;

  const periodoLabels: Record<Periodo, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total' };
  const tipoFiltroLabels: Record<TipoFiltro, string> = { todos: 'Todos', lideranca: 'Lideranças', fiscal: 'Fiscais', eleitor: 'Eleitores' };

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
            <h1 className="text-lg font-bold text-foreground">Painel de Produção</h1>
            <p className="text-[10px] text-muted-foreground">Controle da rede de suplentes</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{totais.total}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">cadastros</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

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

        {/* ── Resumo por tipo ── */}
        <div className="grid grid-cols-3 gap-3">
          {([
            { icon: Users, label: 'Lideranças', value: totais.liderancas, color: TIPO_COLORS.lideranca, tipo: 'lideranca' as const },
            { icon: Shield, label: 'Fiscais', value: totais.fiscais, color: TIPO_COLORS.fiscal, tipo: 'fiscal' as const },
            { icon: Target, label: 'Eleitores', value: totais.eleitores, color: TIPO_COLORS.eleitor, tipo: 'eleitor' as const },
          ]).map(({ icon: Icon, label, value, color, tipo: t }) => (
            <button key={label} onClick={() => handleShowRecords(t)} className="section-card text-center active:scale-[0.97] transition-all">
              <Icon size={18} className="mx-auto mb-1" style={{ color }} />
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-[8px] text-primary mt-1">Ver registros →</p>
            </button>
          ))}
        </div>

        {/* ── Exportar ── */}
        <div className="flex gap-2">
          <button onClick={() => handleExport()} disabled={exporting}
            className="flex-1 h-10 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exportar Todos (CSV)
          </button>
          {tipoFiltro !== 'todos' && (
            <button onClick={() => handleExport(tipoFiltro as any)} disabled={exporting}
              className="h-10 px-4 flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 rounded-xl text-sm font-medium text-primary active:scale-[0.97] transition-all disabled:opacity-50">
              <Download size={14} /> Só {tipoFiltroLabels[tipoFiltro]}
            </button>
          )}
        </div>

        {/* ── Lista de registros ── */}
        {showRecords && (
          <div className="section-card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="section-title !mb-0">
                {showRecords === 'lideranca' ? '👥 Lideranças' : showRecords === 'fiscal' ? '🛡️ Fiscais' : '🎯 Eleitores'}
              </h2>
              <button onClick={() => setShowRecords(null)} className="text-xs text-muted-foreground">Fechar ✕</button>
            </div>
            {loadingRecords ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : recordsData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro encontrado</p>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {recordsData.map((r: any) => {
                  const p = r.pessoas || {};
                  const agente = r.hierarquia_usuarios?.nome || '—';
                  return (
                    <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{p.nome || '—'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{p.cpf || 'Sem CPF'}</span>
                          <span>·</span>
                          <span>{p.telefone || 'Sem tel.'}</span>
                        </div>
                        <p className="text-[9px] text-primary/70 mt-0.5">
                          Por: {agente} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {r.status || r.compromisso_voto || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => handleExport(showRecords)} disabled={exporting}
              className="w-full mt-3 h-9 flex items-center justify-center gap-2 bg-primary/10 border border-primary/20 rounded-xl text-xs font-medium text-primary active:scale-[0.97] transition-all disabled:opacity-50">
              <Download size={12} /> Exportar {showRecords === 'lideranca' ? 'Lideranças' : showRecords === 'fiscal' ? 'Fiscais' : 'Eleitores'} (CSV)
            </button>
          </div>
        )}

        {/* ── Timeline ── */}
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

        {/* ── Ranking por Suplente ── */}
        <div className="section-card">
          <h2 className="section-title">🏆 Produção por Suplente</h2>

          {rankingSuplentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum cadastro no período</p>
          ) : (
            <div className="space-y-2">
              {rankingSuplentes.map((r, i) => (
                <div key={r.id}>
                  <button
                    onClick={() => setExpandedSuplente(expandedSuplente === r.id ? null : r.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      i === 0 ? 'border-amber-400/40 bg-amber-500/5' :
                      i === 1 ? 'border-slate-400/30 bg-slate-500/5' :
                      i === 2 ? 'border-orange-400/30 bg-orange-500/5' :
                      'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center shrink-0">{getMedalEmoji(i)}</span>
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserCheck size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.nome}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {r.partido && <span>{r.partido}</span>}
                          {r.regiao && <span>· {r.regiao}</span>}
                          <span>· {r.qtdAgentes} agente{r.qtdAgentes !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <p className="text-xl font-bold text-primary">{r.total}</p>
                          <p className="text-[9px] text-muted-foreground">total</p>
                        </div>
                        {expandedSuplente === r.id ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 ml-11">
                      {r.liderancas > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsla(217, 91%, 60%, 0.1)', color: TIPO_COLORS.lideranca }}>
                          <Users size={10} /> {r.liderancas}
                        </span>
                      )}
                      {r.fiscais > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsla(142, 71%, 45%, 0.1)', color: TIPO_COLORS.fiscal }}>
                          <Shield size={10} /> {r.fiscais}
                        </span>
                      )}
                      {r.eleitores > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>
                          <Target size={10} /> {r.eleitores}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Agentes expandidos */}
                  {expandedSuplente === r.id && agentesDoSuplente.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1 border-l-2 border-primary/20 pl-3">
                      {agentesDoSuplente.map((a, ai) => (
                        <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <span className="text-xs text-muted-foreground w-5 text-right">{ai + 1}.</span>
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-primary">{a.nome.charAt(0)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{a.nome}</p>
                            <span className="text-[9px] text-muted-foreground">{tipoLabel(a.tipo)}</span>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            {a.liderancas > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(217, 91%, 60%, 0.1)', color: TIPO_COLORS.lideranca }}>{a.liderancas}</span>}
                            {a.fiscais > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(142, 71%, 45%, 0.1)', color: TIPO_COLORS.fiscal }}>{a.fiscais}</span>}
                            {a.eleitores > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>{a.eleitores}</span>}
                          </div>
                          <p className="text-sm font-bold text-primary shrink-0">{a.total}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedSuplente === r.id && agentesDoSuplente.length === 0 && (
                    <div className="ml-6 mt-1 pl-3 py-2">
                      <p className="text-[10px] text-muted-foreground">Nenhum agente identificado</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Agentes de Campo ── */}
        {rankingLivres.length > 0 && (
          <div className="section-card">
            <h2 className="section-title">📋 Agentes de Campo</h2>
            <p className="text-[10px] text-muted-foreground -mt-2 mb-1">Eleitores cadastrados por agentes sem vínculo a suplente</p>
            <div className="bg-card rounded-xl border border-border p-2 text-center mb-3">
              <p className="text-xl font-bold" style={{ color: TIPO_COLORS.eleitor }}>{rankingLivres.reduce((s, u) => s + u.eleitores, 0)}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">eleitores por agentes</p>
            </div>
            <div className="space-y-1.5">
              {rankingLivres.map((u, i) => (
                <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-card border border-border">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{u.nome.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                    <span className="text-[9px] text-muted-foreground">Agente de campo</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsla(280, 70%, 55%, 0.1)', color: TIPO_COLORS.eleitor }}>{u.eleitores} eleitores</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
