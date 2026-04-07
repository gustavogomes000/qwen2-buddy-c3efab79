import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Users, Lock, Search, Loader2, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cachedInvoke } from '@/lib/cacheEdgeFunctions';
import { resolverMunicipioId } from '@/lib/resolverMunicipio';

interface SuplenteResult {
  id: string;
  nome: string;
  partido?: string | null;
  regiao_atuacao?: string | null;
}

interface UsuarioResult {
  id: string;
  nome: string;
  tipo: string;
  suplente_id?: string | null;
  municipio_id?: string | null;
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
  const [aba, setAba] = useState<'suplente' | 'usuario'>('suplente');
  const [buscaSuplente, setBuscaSuplente] = useState('');
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const [suplentes, setSuplentes] = useState<SuplenteResult[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResult[]>([]);
  const [loadingSup, setLoadingSup] = useState(false);
  const [loadingUsr, setLoadingUsr] = useState(false);
  const [supNomeSelecionado, setSupNomeSelecionado] = useState<string | null>(null);
  const [usrNomeSelecionado, setUsrNomeSelecionado] = useState<string | null>(null);
  const [usrIdSelecionado, setUsrIdSelecionado] = useState<string | null>(null);
  const debounceSupRef = useRef<NodeJS.Timeout | null>(null);
  const debounceUsrRef = useRef<NodeJS.Timeout | null>(null);

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

  // Buscar usuários do sistema (hierarquia_usuarios)
  const buscarUsuarios = useCallback(async (q: string) => {
    setLoadingUsr(true);
    try {
      let query = (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, suplente_id, municipio_id')
        .eq('ativo', true)
        .in('tipo', ['suplente', 'lideranca', 'coordenador'])
        .order('nome', { ascending: true })
        .limit(30);

      if (q) {
        query = query.ilike('nome', `%${q}%`);
      }

      if (cidadeAtivaId) {
        query = query.eq('municipio_id', cidadeAtivaId);
      }

      const { data } = await query;
      if (data) {
        setUsuarios(data as UsuarioResult[]);
      }
    } catch {}
    setLoadingUsr(false);
  }, [cidadeAtivaId]);

  // Trigger searches on mount
  useEffect(() => {
    if (!bloqueado) {
      buscarSuplentes('');
      buscarUsuarios('');
    }
  }, [bloqueado, buscarSuplentes, buscarUsuarios]);

  const handleBuscaSuplente = (val: string) => {
    setBuscaSuplente(val);
    if (debounceSupRef.current) clearTimeout(debounceSupRef.current);
    debounceSupRef.current = setTimeout(() => buscarSuplentes(val), 300);
  };

  const handleBuscaUsuario = (val: string) => {
    setBuscaUsuario(val);
    if (debounceUsrRef.current) clearTimeout(debounceUsrRef.current);
    debounceUsrRef.current = setTimeout(() => buscarUsuarios(val), 300);
  };

  const selecionarSuplente = async (sup: SuplenteResult) => {
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
    setUsrNomeSelecionado(null);
    setUsrIdSelecionado(null);
    onSuplenteChange(String(sup.id), sup.nome, munId);
    onLiderancaChange(null, null, null, null);
  };

  const selecionarUsuario = async (usr: UsuarioResult) => {
    const munId = usr.municipio_id || (usr.suplente_id ? await resolverMunicipioId(String(usr.suplente_id)) : null);
    setUsrNomeSelecionado(usr.nome);
    setUsrIdSelecionado(usr.id);
    setSupNomeSelecionado(null);

    // Link via suplente_id if available
    if (usr.suplente_id) {
      onSuplenteChange(usr.suplente_id, null, munId);
      onLiderancaChange(null, null, usr.suplente_id, munId);
    } else {
      onSuplenteChange(null, null, munId);
      onLiderancaChange(null, null, null, munId);
    }
  };

  const limpar = () => {
    setSupNomeSelecionado(null);
    setUsrNomeSelecionado(null);
    setUsrIdSelecionado(null);
    onSuplenteChange(null, null, null);
    onLiderancaChange(null, null, null, null);
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

  const temSelecao = !!suplenteIdSelecionado || !!liderancaIdSelecionada || !!supNomeSelecionado || !!usrNomeSelecionado;

  const tipoLabel: Record<string, string> = {
    suplente: 'Suplente',
    lideranca: 'Liderança',
    coordenador: 'Coordenador',
  };

  return (
    <div className="section-card">
      <h3 className="section-title">🔗 Ligação Política {obrigatorio && <span className="text-primary">*</span>}</h3>

      {/* Seleção atual */}
      {temSelecao && (
        <div className="flex items-center gap-2 p-2.5 mb-2 rounded-xl bg-primary/5 border border-primary/20">
          <Check size={14} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary truncate">
              {supNomeSelecionado || usrNomeSelecionado || 'Selecionado'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {supNomeSelecionado ? 'Suplente' : 'Usuário do sistema'}
            </p>
          </div>
          <button onClick={limpar} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs - 2 abas */}
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
          onClick={() => setAba('usuario')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
            aba === 'usuario' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Users size={11} /> Usuário
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

      {/* Tab: Usuário do Sistema */}
      {aba === 'usuario' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={buscaUsuario}
              onChange={e => handleBuscaUsuario(e.target.value)}
              placeholder="Buscar usuário do sistema..."
              className="w-full h-9 pl-8 pr-3 bg-card border border-border rounded-lg text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loadingUsr && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {usuarios.map(u => (
              <button
                key={u.id}
                onClick={() => selecionarUsuario(u)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                  usrIdSelecionado === u.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground flex-1 truncate">{u.nome}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
                    {tipoLabel[u.tipo] || u.tipo}
                  </span>
                </div>
              </button>
            ))}
            {!loadingUsr && usuarios.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">Nenhum usuário encontrado</p>
            )}
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <p className="text-xs text-destructive mt-1.5">{erro}</p>
      )}
    </div>
  );
}
