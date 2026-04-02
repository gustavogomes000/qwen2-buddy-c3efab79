import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Search, Users, Target, Loader2 } from 'lucide-react';
import { maskCPF } from '@/lib/cpf';
import SkeletonLista from '@/components/SkeletonLista';

const PAGE_SIZE = 20;

type TipoAba = 'liderancas' | 'eleitores';
type Periodo = 'hoje' | '7dias' | '30dias' | 'todos';

interface RegistroBase {
  id: string;
  criado_em: string;
  pessoas: { nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null } | null;
  hierarquia_usuarios: { nome: string; tipo: string } | null;
  municipios: { nome: string } | null;
}

const abaConfig: { id: TipoAba; label: string; icon: typeof Users }[] = [
  { id: 'liderancas', label: 'Lideranças', icon: Users },
  { id: 'eleitores', label: 'Eleitores', icon: Target },
];

const periodoPills: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7dias', label: '7 dias' },
  { id: '30dias', label: '30 dias' },
  { id: 'todos', label: 'Todos' },
];

function getDataLimite(p: Periodo): string | null {
  if (p === 'todos') return null;
  const agora = new Date();
  if (p === 'hoje') { agora.setHours(0, 0, 0, 0); return agora.toISOString(); }
  if (p === '7dias') { agora.setDate(agora.getDate() - 7); return agora.toISOString(); }
  agora.setDate(agora.getDate() - 30);
  return agora.toISOString();
}

export default function CadastrosExternos() {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState<TipoAba>('liderancas');
  const [periodo, setPeriodo] = useState<Periodo>('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  const [dados, setDados] = useState<Record<TipoAba, RegistroBase[]>>({
    liderancas: [], eleitores: [],
  });
  const [contadores, setContadores] = useState<Record<TipoAba, number>>({
    liderancas: 0, eleitores: 0,
  });
  const [pagina, setPagina] = useState<Record<TipoAba, number>>({
    liderancas: 0, eleitores: 0,
  });
  const [temMais, setTemMais] = useState<Record<TipoAba, boolean>>({
    liderancas: true, eleitores: true,
  });

  const tabelaMap: Record<TipoAba, string> = {
    liderancas: 'liderancas',
    eleitores: 'possiveis_eleitores',
  };

  const fkCadastradoPor: Record<TipoAba, string> = {
    liderancas: 'liderancas_cadastrado_por_fkey',
    fiscais: 'fiscais_cadastrado_por_fkey',
    eleitores: 'possiveis_eleitores_cadastrado_por_fkey',
  };

  const carregarDados = useCallback(async (aba: TipoAba, pag: number, substituir = false) => {
    const tabela = tabelaMap[aba];
    const fk = fkCadastradoPor[aba];
    const from = pag * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const dataLimite = getDataLimite(periodo);

    let query = (supabase as any)
      .from(tabela)
      .select(
        `id, criado_em, municipios(nome), pessoas(nome, cpf, telefone, whatsapp), hierarquia_usuarios!${fk}(nome, tipo)`,
        { count: 'exact' }
      )
      .eq('origem_captacao', 'visita_comite')
      .order('criado_em', { ascending: false })
      .range(from, to);

    if (dataLimite) query = query.gte('criado_em', dataLimite);

    const { data, count, error } = await query;
    if (error) { console.error(error); return; }

    const registros = (data || []) as RegistroBase[];
    setDados(prev => ({
      ...prev,
      [aba]: substituir ? registros : [...prev[aba], ...registros],
    }));
    setContadores(prev => ({ ...prev, [aba]: count ?? 0 }));
    setTemMais(prev => ({ ...prev, [aba]: registros.length === PAGE_SIZE }));
  }, [periodo]);

  // Carregar contadores de todas as abas + dados da aba ativa
  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      setPagina({ liderancas: 0, fiscais: 0, eleitores: 0 });
      setDados({ liderancas: [], fiscais: [], eleitores: [] });

      const dataLimite = getDataLimite(periodo);

      // Contadores de todas as abas
      const contagemPromises = (['liderancas', 'fiscais', 'eleitores'] as TipoAba[]).map(async (aba) => {
        let q = (supabase as any)
          .from(tabelaMap[aba])
          .select('*', { count: 'exact', head: true })
          .eq('origem_captacao', 'visita_comite');
        if (dataLimite) q = q.gte('criado_em', dataLimite);
        const { count } = await q;
        return { aba, count: count ?? 0 };
      });

      const contagens = await Promise.all(contagemPromises);
      const novosContadores: Record<TipoAba, number> = { liderancas: 0, fiscais: 0, eleitores: 0 };
      contagens.forEach(c => { novosContadores[c.aba] = c.count; });
      setContadores(novosContadores);

      // Dados da aba ativa
      await carregarDados(abaAtiva, 0, true);
      setLoading(false);
    };
    carregar();
  }, [periodo]);

  // Carregar ao trocar aba (se vazia)
  useEffect(() => {
    if (dados[abaAtiva].length === 0 && contadores[abaAtiva] > 0) {
      carregarDados(abaAtiva, 0, true);
    }
  }, [abaAtiva]);

  const carregarMais = async () => {
    const novaPagina = pagina[abaAtiva] + 1;
    setPagina(prev => ({ ...prev, [abaAtiva]: novaPagina }));
    await carregarDados(abaAtiva, novaPagina);
  };

  const dadosFiltrados = useMemo(() => {
    const lista = dados[abaAtiva];
    if (!busca.trim()) return lista;
    const s = busca.toLowerCase().replace(/\D/g, '') || busca.toLowerCase();
    return lista.filter(item => {
      const nome = item.pessoas?.nome?.toLowerCase() || '';
      const cpf = item.pessoas?.cpf?.replace(/\D/g, '') || '';
      return nome.includes(busca.toLowerCase()) || cpf.includes(s);
    });
  }, [dados, abaAtiva, busca]);

  const isNovo = (criado_em: string) => {
    return Date.now() - new Date(criado_em).getTime() < 24 * 60 * 60 * 1000;
  };

  return (
    <div className="h-full bg-background overflow-y-auto overscroll-contain pb-8">
      <div className="h-[1.5px] gradient-header" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/admin')}
            className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Cadastros por Visita</h1>
            <p className="text-[10px] text-muted-foreground">Visitantes cadastrados na recepção do comitê</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Abas */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {abaConfig.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setAbaAtiva(id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                abaAtiva === id ? 'gradient-primary text-white shadow-sm' : 'bg-muted text-muted-foreground'
              }`}>
              <Icon size={14} />
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                abaAtiva === id ? 'bg-white/20 text-white' : 'bg-background text-foreground'
              }`}>
                {contadores[id]}
              </span>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Período */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {periodoPills.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                periodo === p.id ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <SkeletonLista linhas={6} />
        ) : dadosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dadosFiltrados.map(item => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-foreground">{item.pessoas?.nome || '—'}</p>
                  {isNovo(item.criado_em) && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                      NOVO
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">CPF: {maskCPF(item.pessoas?.cpf || '')}</p>
                {item.pessoas?.whatsapp && (
                  <a href={`https://wa.me/55${item.pessoas.whatsapp.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1">
                    📱 {item.pessoas.whatsapp} ↗
                  </a>
                )}
                <p className="text-xs text-muted-foreground">
                  👤 {item.hierarquia_usuarios?.nome ?? 'Sistema'} · {item.hierarquia_usuarios?.tipo ?? ''}
                </p>
                {item.municipios?.nome && (
                  <p className="text-xs text-muted-foreground">📍 {item.municipios.nome}</p>
                )}
                <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                  📋 Cadastrado por visita
                </span>
                <p className="text-[11px] text-muted-foreground">
                  🕐 {new Date(item.criado_em).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}

            {temMais[abaAtiva] && !busca && (
              <button onClick={carregarMais}
                className="w-full h-10 flex items-center justify-center gap-2 bg-muted border border-border rounded-xl text-sm font-medium text-foreground active:scale-[0.97] transition-all">
                Carregar mais
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
