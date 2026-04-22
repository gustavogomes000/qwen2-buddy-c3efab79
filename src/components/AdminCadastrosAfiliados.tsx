import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Trash2, Loader2, Phone, MapPin, User, Download, ClipboardList, Link2, Copy, Users, AtSign, Cake, Trophy } from 'lucide-react';

interface CadastroAfil {
  id: string;
  afiliado_id: string;
  nome: string;
  telefone: string;
  data_nascimento: string | null;
  cep: string | null;
  rede_social: string | null;
  origem: string;
  criado_em: string;
}

interface Afiliado {
  id: string;
  nome: string;
  link_token: string | null;
  ativo: boolean | null;
}

export default function AdminCadastrosAfiliados() {
  const [cadastros, setCadastros] = useState<CadastroAfil[]>([]);
  const [afiliados, setAfiliados] = useState<Afiliado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroAfiliado, setFiltroAfiliado] = useState<string>('todos');
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | 'ontem' | 'semana' | 'mes'>('todos');

  const carregar = useCallback(async () => {
    setLoading(true);
    const [cadRes, afRes] = await Promise.all([
      (supabase as any).from('cadastros_afiliados').select('*').order('criado_em', { ascending: false }),
      (supabase as any).from('hierarquia_usuarios').select('id, nome, link_token, ativo').eq('tipo', 'afiliado'),
    ]);
    if (cadRes.error) toast({ title: 'Erro', description: cadRes.error.message, variant: 'destructive' });
    else setCadastros((cadRes.data || []) as CadastroAfil[]);
    if (!afRes.error) setAfiliados((afRes.data || []) as Afiliado[]);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const channel = supabase
      .channel('admin_cadastros_afiliados')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_afiliados' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const afiliadoNome = (id: string) => afiliados.find(a => a.id === id)?.nome || '—';

  const filtrados = useMemo(() => {
    let base = cadastros;
    if (filtroAfiliado !== 'todos') base = base.filter(c => c.afiliado_id === filtroAfiliado);
    if (periodo !== 'todos') {
      const agora = new Date();
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      let from = inicio;
      let to: Date | null = null;
      if (periodo === 'ontem') { from = new Date(inicio); from.setDate(from.getDate() - 1); to = inicio; }
      else if (periodo === 'semana') { from = new Date(inicio); from.setDate(from.getDate() - 7); }
      else if (periodo === 'mes') { from = new Date(inicio); from.setDate(from.getDate() - 30); }
      base = base.filter(c => {
        const t = Date.parse(c.criado_em);
        if (t < from.getTime()) return false;
        if (to && t >= to.getTime()) return false;
        return true;
      });
    }
    const q = busca.toLowerCase().trim();
    if (!q) return base;
    return base.filter(c =>
      c.nome.toLowerCase().includes(q)
      || c.telefone.toLowerCase().includes(q)
      || (c.cep || '').toLowerCase().includes(q)
      || (c.rede_social || '').toLowerCase().includes(q)
      || afiliadoNome(c.afiliado_id).toLowerCase().includes(q)
    );
  }, [cadastros, busca, filtroAfiliado, periodo, afiliados]);

  const totaisPorAfiliado = useMemo(() => {
    const map: Record<string, number> = {};
    cadastros.forEach(c => { map[c.afiliado_id] = (map[c.afiliado_id] || 0) + 1; });
    return map;
  }, [cadastros]);

  // Ranking ordenado por quantidade de cadastros (desc), depois nome
  const ranking = useMemo(() => {
    return [...afiliados]
      .map(a => ({ ...a, total: totaisPorAfiliado[a.id] || 0 }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }, [afiliados, totaisPorAfiliado]);

  const handleExportar = () => {
    const headers = ['Afiliado', 'Nome', 'Telefone', 'Data nascimento', 'CEP', 'Rede social', 'Origem', 'Cadastrado em'];
    const rows = filtrados.map(c => [
      afiliadoNome(c.afiliado_id),
      c.nome, c.telefone,
      c.data_nascimento ?? '',
      c.cep ?? '',
      c.rede_social ?? '',
      c.origem === 'link_publico' ? 'Link público' : 'Manual',
      new Date(c.criado_em).toLocaleString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadastros-afiliados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este cadastro?')) return;
    const { error } = await (supabase as any).from('cadastros_afiliados').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Excluído' });
    carregar();
  };

  const copiarLink = async (token: string | null) => {
    if (!token) { toast({ title: 'Afiliado sem token', variant: 'destructive' }); return; }
    const url = `${window.location.origin}/cadastro/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: '✅ Link copiado', description: url });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="text-primary" size={20} />
        <h2 className="text-lg font-bold">Cadastros Afiliados</h2>
        <span className="ml-auto text-xs text-muted-foreground">{filtrados.length} registros</span>
      </div>

      {/* Lista de afiliados com totais */}
      <div className="section-card space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={14} className="text-primary" />
          <p className="text-xs font-semibold">Ranking de Afiliados ({afiliados.length})</p>
        </div>
        {afiliados.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhum afiliado cadastrado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {ranking.map((a, idx) => {
              const isTop = idx < 3 && a.total > 0;
              const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded-lg p-2 ${
                    isTop ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                  }`}
                >
                  <div className="w-7 h-7 shrink-0 rounded-full bg-card border border-border flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                    {medalha || `${idx + 1}º`}
                  </div>
                  <button
                    onClick={() => setFiltroAfiliado(a.id)}
                    className="flex-1 text-left min-w-0 flex items-center gap-2"
                  >
                    <span
                      className={`shrink-0 min-w-[28px] text-center px-1.5 h-6 rounded-md text-[11px] font-bold flex items-center justify-center ${
                        a.total > 0 ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {a.total}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{a.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.total === 1 ? 'cadastro captado' : 'cadastros captados'} · toque para ver
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => copiarLink(a.link_token)}
                    title="Copiar link público"
                    className="p-2 rounded-lg bg-card border border-border active:scale-95"
                  >
                    <Link2 size={13} className="text-primary" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text" placeholder="Buscar..."
            value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={filtroAfiliado}
          onChange={e => setFiltroAfiliado(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
        >
          <option value="todos">Todos os afiliados</option>
          {afiliados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <button
          onClick={handleExportar}
          disabled={filtrados.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium active:scale-95 disabled:opacity-50"
        >
          <Download size={16} /> Exportar
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {([
          { v: 'todos', l: 'Todos' },
          { v: 'hoje', l: 'Hoje' },
          { v: 'ontem', l: 'Ontem' },
          { v: 'semana', l: '7 dias' },
          { v: 'mes', l: '30 dias' },
        ] as const).map(opt => (
          <button
            key={opt.v}
            onClick={() => setPeriodo(opt.v)}
            className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
              periodo === opt.v ? 'gradient-primary text-white shadow-sm' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum cadastro encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <User size={14} className="text-primary shrink-0" />
                    <h4 className="font-semibold text-sm truncate">{c.nome}</h4>
                    {c.origem === 'link_publico' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">🔗 LINK</span>
                    )}
                  </div>
                  <p className="text-[11px] text-primary font-medium mb-1">por {afiliadoNome(c.afiliado_id)}</p>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Phone size={12} className="shrink-0" /><span>{c.telefone}</span></div>
                    {c.data_nascimento && (
                      <div className="flex items-center gap-1.5"><Cake size={12} className="shrink-0" /><span>{new Date(c.data_nascimento + 'T00:00').toLocaleDateString('pt-BR')}</span></div>
                    )}
                    {c.cep && (
                      <div className="flex items-center gap-1.5"><MapPin size={12} className="shrink-0" /><span>CEP {c.cep}</span></div>
                    )}
                    {c.rede_social && (
                      <div className="flex items-center gap-1.5"><AtSign size={12} className="shrink-0" /><span>{c.rede_social}</span></div>
                    )}
                    <div className="text-[10px] opacity-70 mt-1">
                      {new Date(c.criado_em).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleExcluir(c.id)}
                  className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-90"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}