import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Users, UserPlus, Lock, Search, Loader2, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cachedInvoke } from '@/lib/cacheEdgeFunctions';
import { resolverMunicipioId } from '@/lib/resolverMunicipio';
import { toast } from '@/hooks/use-toast';

interface SuplenteResult {
  id: string;
  nome: string;
  partido?: string | null;
  regiao_atuacao?: string | null;
}

interface LiderancaResult {
  id: string;
  nome: string;
  regiao_atuacao?: string | null;
  suplente_id?: string | null;
}

interface Props {
  bloqueado: boolean;
  nomeFixo?: string | null;
  subtituloFixo?: string | null;
  suplenteIdSelecionado?: string | null;
  liderancaIdSelecionada?: string | null;
  onSuplenteChange: (id: string | null, nome: string | null, municipioId: string | null) => void;
  onLiderancaChange: (id: string | null, nome: string | null, suplenteId: string | null, municipioId: string | null) => void;
  obrigatorio?: boolean;
  erro?: string | null;
  cidadeAtivaId?: string | null;
}

export default function CampoLigacaoPolitica({
  bloqueado,
  nomeFixo,
  subtituloFixo,
  suplenteIdSelecionado,
  liderancaIdSelecionada,
  onSuplenteChange,
  onLiderancaChange,
  obrigatorio = false,
  erro,
  cidadeAtivaId,
}: Props) {
  const [aba, setAba] = useState<'suplente' | 'lideranca' | 'nova'>('suplente');
  const [buscaSuplente, setBuscaSuplente] = useState('');
  const [buscaLideranca, setBuscaLideranca] = useState('');
  const [suplentes, setSuplentes] = useState<SuplenteResult[]>([]);
  const [liderancasLocal, setLiderancasLocal] = useState<LiderancaResult[]>([]);
  const [loadingSup, setLoadingSup] = useState(false);
  const [loadingLid, setLoadingLid] = useState(false);
  const [supNomeSelecionado, setSupNomeSelecionado] = useState<string | null>(null);
  const [lidNomeSelecionado, setLidNomeSelecionado] = useState<string | null>(null);
  const debounceSupRef = useRef<NodeJS.Timeout | null>(null);
  const debounceLidRef = useRef<NodeJS.Timeout | null>(null);

  // Nova Liderança inline form
  const [novaLidNome, setNovaLidNome] = useState('');
  const [novaLidTelefone, setNovaLidTelefone] = useState('');
  const [novaLidRegiao, setNovaLidRegiao] = useState('');
  const [salvandoNova, setSalvandoNova] = useState(false);

  // Buscar suplentes com debounce
  const buscarSuplentes = useCallback(async (q: string) => {
    setLoadingSup(true);
    try {
      const data = await cachedInvoke<any[]>('buscar-suplentes');
      if (Array.isArray(data)) {
        let filtered = data as SuplenteResult[];
        if (q) {
          const lower = q.toLowerCase();
          filtered = filtered.filter((s: any) => s.nome?.toLowerCase().includes(lower));
        }
        if (cidadeAtivaId) {
          const { data: supMun } = await (supabase as any)
            .from('suplente_municipio')
            .select('suplente_id')
            .eq('municipio_id', cidadeAtivaId);
          if (supMun) {
            const supIds = new Set(supMun.map((sm: any) => String(sm.suplente_id)));
            filtered = filtered.filter(s => supIds.has(String(s.id)));
          }
        }
        setSuplentes(filtered.slice(0, 20));
      }
    } catch {}
    setLoadingSup(false);
  }, [cidadeAtivaId]);

  const buscarLiderancas = useCallback(async (q: string) => {
    setLoadingLid(true);
    try {
      let query = (supabase as any)
        .from('liderancas')
        .select('id, regiao_atuacao, suplente_id, pessoas(nome)')
        .eq('status', 'Ativa')
        .order('criado_em', { ascending: false })
        .limit(20);

      if (cidadeAtivaId) {
        query = query.eq('municipio_id', cidadeAtivaId);
      }

      const { data } = await query;
      if (data) {
        let results = (data as any[]).map(l => ({
          id: l.id,
          nome: l.pessoas?.nome || '—',
          regiao_atuacao: l.regiao_atuacao,
          suplente_id: l.suplente_id,
        }));
        if (q) {
          const lower = q.toLowerCase();
          results = results.filter(l => l.nome.toLowerCase().includes(lower));
        }
        setLiderancasLocal(results);
      }
    } catch {}
    setLoadingLid(false);
  }, [cidadeAtivaId]);

  // Trigger searches on mount
  useEffect(() => {
    if (!bloqueado) {
      buscarSuplentes('');
      buscarLiderancas('');
    }
  }, [bloqueado, buscarSuplentes, buscarLiderancas]);

  const handleBuscaSuplente = (val: string) => {
    setBuscaSuplente(val);
    if (debounceSupRef.current) clearTimeout(debounceSupRef.current);
    debounceSupRef.current = setTimeout(() => buscarSuplentes(val), 300);
  };

  const handleBuscaLideranca = (val: string) => {
    setBuscaLideranca(val);
    if (debounceLidRef.current) clearTimeout(debounceLidRef.current);
    debounceLidRef.current = setTimeout(() => buscarLiderancas(val), 300);
  };

  const selecionarSuplente = async (sup: SuplenteResult) => {
    // Upsert suplente into local table to satisfy FK constraints
    try {
      await (supabase as any).from('suplentes').upsert({
        id: String(sup.id),
        nome: sup.nome,
        partido: sup.partido || null,
        regiao_atuacao: sup.regiao_atuacao || null,
      }, { onConflict: 'id' });
    } catch (e) {
      console.warn('Erro ao sincronizar suplente local:', e);
    }

    const munId = await resolverMunicipioId(String(sup.id));
    setSupNomeSelecionado(sup.nome);
    setLidNomeSelecionado(null);
    onSuplenteChange(String(sup.id), sup.nome, munId);
    onLiderancaChange(null, null, null, null);
  };

  const selecionarLideranca = async (lid: LiderancaResult) => {
    let munId: string | null = null;
    if (lid.suplente_id) {
      munId = await resolverMunicipioId(String(lid.suplente_id));
    }
    setLidNomeSelecionado(lid.nome);
    setSupNomeSelecionado(null);
    onLiderancaChange(lid.id, lid.nome, lid.suplente_id || null, munId);
    onSuplenteChange(null, null, null);
  };

  const limpar = () => {
    setSupNomeSelecionado(null);
    setLidNomeSelecionado(null);
    onSuplenteChange(null, null, null);
    onLiderancaChange(null, null, null, null);
  };

  // Salvar nova liderança inline
  const salvarNovaLideranca = async () => {
    if (!novaLidNome.trim()) {
      toast({ title: 'Informe o nome da liderança', variant: 'destructive' });
      return;
    }
    setSalvandoNova(true);
    try {
      // Criar pessoa
      const { data: novaPessoa, error: pessoaError } = await supabase.from('pessoas').insert({
        nome: novaLidNome.trim(),
        telefone: novaLidTelefone.trim() || null,
      }).select('id').single();
      if (pessoaError) throw pessoaError;

      // Criar liderança
      const { data: novaLid, error: lidError } = await (supabase as any).from('liderancas').insert({
        pessoa_id: novaPessoa.id,
        regiao_atuacao: novaLidRegiao.trim() || null,
        status: 'Ativa',
      }).select('id').single();
      if (lidError) throw lidError;

      // Selecionar a nova liderança
      setLidNomeSelecionado(novaLidNome.trim());
      setSupNomeSelecionado(null);
      onLiderancaChange(novaLid.id, novaLidNome.trim(), null, null);
      onSuplenteChange(null, null, null);

      // Limpar form
      setNovaLidNome('');
      setNovaLidTelefone('');
      setNovaLidRegiao('');
      setAba('suplente');

      toast({ title: '✅ Nova liderança criada e selecionada!' });

      // Refresh liderancas list
      buscarLiderancas('');
    } catch (err: any) {
      toast({ title: 'Erro ao criar liderança', description: err.message, variant: 'destructive' });
    } finally {
      setSalvandoNova(false);
    }
  };

  // Bloqueado → exibir campo fixo
  if (bloqueado) {
    return (
      <div className="section-card">
        <h3 className="section-title">🔗 Ligação Política</h3>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
          <Lock size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{nomeFixo || 'Vinculado'}</p>
            {subtituloFixo && <p className="text-[10px] text-muted-foreground">{subtituloFixo}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Editável com tabs
  const temSelecao = !!suplenteIdSelecionado || !!liderancaIdSelecionada || !!supNomeSelecionado || !!lidNomeSelecionado;

  const inputCls = "w-full h-9 px-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="section-card">
      <h3 className="section-title">🔗 Ligação Política {obrigatorio && <span className="text-primary">*</span>}</h3>

      {/* Seleção atual */}
      {temSelecao && (
        <div className="flex items-center gap-2 p-2.5 mb-2 rounded-xl bg-primary/5 border border-primary/20">
          <Check size={14} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary truncate">
              {supNomeSelecionado || lidNomeSelecionado || 'Selecionado'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {supNomeSelecionado ? 'Suplente' : 'Liderança'}
            </p>
          </div>
          <button onClick={limpar} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs - 3 abas */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setAba('suplente')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'suplente' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <User size={11} /> Suplente
        </button>
        <button
          onClick={() => setAba('lideranca')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'lideranca' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Users size={11} /> Liderança
        </button>
        <button
          onClick={() => setAba('nova')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'nova' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <UserPlus size={11} /> Nova
        </button>
      </div>

      {/* Tab: Suplente */}
      {aba === 'suplente' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={buscaSuplente}
              onChange={e => handleBuscaSuplente(e.target.value)}
              placeholder="Buscar suplente..."
              className="w-full h-9 pl-8 pr-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loadingSup && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {suplentes.map(s => (
              <button
                key={s.id}
                onClick={() => selecionarSuplente(s)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                  String(suplenteIdSelecionado) === String(s.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <p className="text-xs font-semibold text-foreground">{s.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[s.partido, s.regiao_atuacao].filter(Boolean).join(' · ') || '—'}
                </p>
              </button>
            ))}
            {!loadingSup && suplentes.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">Nenhum suplente encontrado</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Liderança Existente */}
      {aba === 'lideranca' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={buscaLideranca}
              onChange={e => handleBuscaLideranca(e.target.value)}
              placeholder="Buscar liderança existente..."
              className="w-full h-9 pl-8 pr-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loadingLid && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {liderancasLocal.map(l => (
              <button
                key={l.id}
                onClick={() => selecionarLideranca(l)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                  liderancaIdSelecionada === l.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <p className="text-xs font-semibold text-foreground">{l.nome}</p>
                {l.regiao_atuacao && <p className="text-[10px] text-muted-foreground">{l.regiao_atuacao}</p>}
              </button>
            ))}
            {!loadingLid && liderancasLocal.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">Nenhuma liderança encontrada</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Nova Liderança */}
      {aba === 'nova' && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">Crie uma nova liderança rapidamente e vincule ao cadastro.</p>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Nome <span className="text-primary">*</span></label>
            <input
              value={novaLidNome}
              onChange={e => setNovaLidNome(e.target.value)}
              placeholder="Nome da liderança"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Telefone</label>
            <input
              value={novaLidTelefone}
              onChange={e => setNovaLidTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Região de atuação</label>
            <input
              value={novaLidRegiao}
              onChange={e => setNovaLidRegiao(e.target.value)}
              placeholder="Bairro, comunidade..."
              className={inputCls}
            />
          </div>
          <button
            onClick={salvarNovaLideranca}
            disabled={salvandoNova || !novaLidNome.trim()}
            className="w-full h-9 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {salvandoNova ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
            Criar e Vincular
          </button>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <p className="text-xs text-destructive mt-1.5">{erro}</p>
      )}
    </div>
  );
}
