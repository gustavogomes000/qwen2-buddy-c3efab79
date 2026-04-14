import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, UserPlus, Users, User, CheckCircle2, Search, Eye, EyeOff, Shield, Plus
} from 'lucide-react';

interface SuplenteExterno {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
}

interface LiderancaExterna {
  id: string;
  pessoa_id: string;
  status: string | null;
  tipo_lideranca: string | null;
  regiao_atuacao: string | null;
  suplente_id: string | null;
  pessoas: { id: string; nome: string; telefone: string | null; whatsapp: string | null } | null;
}

interface HierarchyUser {
  id: string;
  nome: string;
  tipo: string;
  suplente_id: string | null;
}

type VinculoTab = 'suplente' | 'lideranca';
type TipoAcesso = 'suplente' | 'lideranca';

export default function TabCriarUsuarios() {
  const { isAdmin } = useAuth();
  const { municipios } = useCidade();

  const [suplentes, setSuplentes] = useState<SuplenteExterno[]>([]);
  const [liderancas, setLiderancas] = useState<LiderancaExterna[]>([]);
  const [usuarios, setUsuarios] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Flow state
  const [vinculoTab, setVinculoTab] = useState<VinculoTab>('suplente');
  const [search, setSearch] = useState('');
  const [selecionado, setSelecionado] = useState<{ tipo: VinculoTab; id: string; nome: string } | null>(null);

  // "Criar novo" (local suplente) mode
  const [criarNovoMode, setCriarNovoMode] = useState(false);
  const [novoProfissao, setNovoProfissao] = useState('');

  // Form state
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso>('suplente');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [superiorId, setSuperiorId] = useState('');
  const [cidadeSelecionada, setCidadeSelecionada] = useState('');
  const [cidadeErro, setCidadeErro] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [supRes, lidRes, usrRes] = await Promise.all([
      supabase.functions.invoke('buscar-suplentes'),
      supabase.functions.invoke('buscar-liderancas-externo'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id').eq('ativo', true).order('nome'),
    ]);
    if (!supRes.error && supRes.data) setSuplentes(supRes.data);
    if (!lidRes.error && lidRes.data) setLiderancas(lidRes.data);
    setUsuarios((usrRes.data || []) as HierarchyUser[]);
    setLoading(false);
  };

  const suplentesComUsuario = useMemo(() => {
    return new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
  }, [usuarios]);

  const liderancaComUsuario = (lid: LiderancaExterna) => {
    const n = lid.pessoas?.nome?.toLowerCase();
    if (!n) return false;
    return usuarios.some(u => u.tipo === 'lideranca' && u.nome.toLowerCase() === n);
  };

  const supFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return suplentes.filter(s => !q || s.nome.toLowerCase().includes(q));
  }, [suplentes, search]);

  const lidFiltradas = useMemo(() => {
    const q = search.toLowerCase();
    return liderancas.filter(l => !q || (l.pessoas?.nome || '').toLowerCase().includes(q));
  }, [liderancas, search]);

  const possiveisSuperior = useMemo(() => {
    return usuarios.filter(u => ['super_admin', 'coordenador', 'suplente'].includes(u.tipo));
  }, [usuarios]);

  const handleSelect = (tipo: VinculoTab, id: string, nome: string) => {
    setSelecionado({ tipo, id, nome });
    setNome(nome);
    setTipoAcesso(tipo);
    setSenha('');
    setSuperiorId('');
    setShowSenha(false);
    setCidadeSelecionada('');
    setCidadeErro('');
    setCriarNovoMode(false);
  };

  const handleStartCriarNovo = () => {
    setCriarNovoMode(true);
    setSelecionado(null);
    setNome('');
    setNovoProfissao('Suplente');
    setSenha('');
    setSuperiorId('');
    setShowSenha(false);
    setCidadeSelecionada('');
    setCidadeErro('');
    setTipoAcesso('suplente');
  };

  const handleCreate = async () => {
    if (!nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!senha.trim() || senha.length < 6) { toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' }); return; }
    if (!cidadeSelecionada) { setCidadeErro('Selecione a cidade do usuário'); return; }

    // For "criar novo" mode, we need to create the suplente first
    if (criarNovoMode && !selecionado) {
      setSaving(true);
      try {
        // 1. Create local suplente
        const { data: newSup, error: supError } = await (supabase as any).from('suplentes').insert({
          nome: nome.trim(),
          cargo_disputado: novoProfissao.trim() || null,
        }).select('id').single();

        if (supError) throw new Error(supError.message);

        // 2. Create user linked to this new suplente
        const payload: any = {
          nome: nome.trim(),
          senha: senha.trim(),
          tipo: 'suplente',
          superior_id: superiorId || null,
          municipio_id: cidadeSelecionada,
          suplente_id: newSup.id,
        };

        const { data, error } = await supabase.functions.invoke('criar-usuario', { body: payload });
        if (error) throw new Error(error.message || 'Erro ao criar usuário');
        if (data?.error) throw new Error(data.error);

        toast({ title: '✅ Usuário criado!', description: `${nome} pode acessar o sistema` });
        setCriarNovoMode(false);
        setSelecionado(null);
        fetchAll();
      } catch (err: any) {
        toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      } finally { setSaving(false); }
      return;
    }

    if (!selecionado) return;

    setSaving(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        senha: senha.trim(),
        tipo: tipoAcesso,
        superior_id: superiorId || null,
        municipio_id: cidadeSelecionada,
      };
      if (selecionado.tipo === 'suplente') payload.suplente_id = selecionado.id;

      const { data, error } = await supabase.functions.invoke('criar-usuario', { body: payload });
      if (error) throw new Error(error.message || 'Erro ao criar usuário');
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário criado!', description: `${nome} pode acessar o sistema` });
      setSelecionado(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  if (!isAdmin) {
    return (
      <div className="section-card text-center py-8">
        <Shield size={32} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Show form for "criar novo" mode
  const showForm = selecionado || criarNovoMode;

  return (
    <div className="space-y-4 pb-24">
      <div className="section-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Criar Usuário</h2>
            <p className="text-xs text-muted-foreground">Defina acesso ao sistema</p>
          </div>
        </div>

        {/* ── Vincular a ── */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-medium text-muted-foreground">Vincular a</label>
          <div className="flex gap-2">
            {([
              { key: 'suplente' as VinculoTab, label: 'Suplente', icon: User },
              { key: 'lideranca' as VinculoTab, label: 'Liderança', icon: Users },
            ]).map(({ key, label, icon: Icon }) => (
              <button key={key}
                onClick={() => { setVinculoTab(key); setSearch(''); setSelecionado(null); setCriarNovoMode(false); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  vinculoTab === key ? 'gradient-primary text-white shadow-lg' : 'bg-card border border-border text-muted-foreground'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Search + Criar Novo button (only for suplente tab) ── */}
        {!showForm && (
          <>
            <div className="space-y-2 mb-3">
              <label className="text-xs font-medium text-muted-foreground">
                Buscar {vinculoTab === 'suplente' ? 'suplente' : 'liderança'}
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search} onChange={e => { setSearch(e.target.value); setSelecionado(null); }}
                  placeholder={`Buscar ${vinculoTab === 'suplente' ? 'suplente' : 'liderança'}...`}
                  className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Criar Novo button */}
            {vinculoTab === 'suplente' && (
              <button
                onClick={handleStartCriarNovo}
                className="w-full mb-3 h-11 flex items-center justify-center gap-2 bg-primary/10 text-primary text-sm font-semibold rounded-xl border border-primary/20 active:scale-[0.97] transition-all"
              >
                <Plus size={16} /> Criar novo (sem vínculo externo)
              </button>
            )}

            {/* ── Results list ── */}
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {vinculoTab === 'suplente' ? (
                supFiltrados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum suplente encontrado</p>
                ) : (
                  supFiltrados.map(s => {
                    const tem = suplentesComUsuario.has(s.id);
                    return (
                      <button key={s.id}
                        onClick={() => !tem && handleSelect('suplente', s.id, s.nome)}
                        disabled={tem}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          tem ? 'border-border bg-muted/30 opacity-60' : 'border-border bg-card hover:border-primary/30 active:scale-[0.98]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{s.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{s.regiao_atuacao || s.partido || '—'}</p>
                          </div>
                          {tem && <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Ativo</span>}
                        </div>
                      </button>
                    );
                  })
                )
              ) : (
                lidFiltradas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma liderança encontrada</p>
                ) : (
                  lidFiltradas.map(l => {
                    const n = l.pessoas?.nome || '—';
                    const tem = liderancaComUsuario(l);
                    return (
                      <button key={l.id}
                        onClick={() => !tem && handleSelect('lideranca', l.id, n)}
                        disabled={tem}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          tem ? 'border-border bg-muted/30 opacity-60' : 'border-border bg-card hover:border-primary/30 active:scale-[0.98]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{n}</p>
                            <p className="text-[10px] text-muted-foreground">{l.regiao_atuacao || l.tipo_lideranca || '—'}</p>
                          </div>
                          {tem && <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Ativo</span>}
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </>
        )}

        {/* ── Selected + Form (existing suplente/lideranca) ── */}
        {selecionado && !criarNovoMode && (
          <div className="space-y-3 mt-2 pt-3 border-t border-border">
            {/* Selected indicator */}
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
              <div>
                <p className="text-xs text-muted-foreground">Selecionado:</p>
                <p className="text-sm font-bold text-foreground">{selecionado.nome}</p>
                <p className="text-[10px] text-primary font-medium">{selecionado.tipo === 'suplente' ? 'Suplente' : 'Liderança'}</p>
              </div>
              <button onClick={() => setSelecionado(null)} className="text-xs text-muted-foreground underline">Trocar</button>
            </div>

            {/* Tipo de acesso */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de acesso</label>
              <div className="flex gap-2">
                {([
                  { key: 'suplente' as TipoAcesso, label: 'Suplente', icon: User },
                  { key: 'lideranca' as TipoAcesso, label: 'Liderança', icon: Users },
                ]).map(({ key, label, icon: Icon }) => (
                  <button key={key}
                    onClick={() => setTipoAcesso(key)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      tipoAcesso === key ? 'gradient-primary text-white shadow-lg' : 'bg-card border border-border text-muted-foreground'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha} onChange={e => setSenha(e.target.value)}
                  className={inputCls} placeholder="Mínimo 6 caracteres"
                />
                <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Superior */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Superior hierárquico</label>
              <select value={superiorId} onChange={e => setSuperiorId(e.target.value)} className={inputCls}>
                <option value="">Nenhum (raiz)</option>
                {possiveisSuperior.map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>
                ))}
              </select>
            </div>

            {/* Cidade */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cidade *</label>
              <select
                value={cidadeSelecionada}
                onChange={e => { setCidadeSelecionada(e.target.value); setCidadeErro(''); }}
                className={`${inputCls} ${cidadeErro ? 'border-destructive ring-1 ring-destructive/30' : ''}`}
              >
                <option value="">Selecione a cidade...</option>
                {municipios.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} – {m.uf}</option>
                ))}
              </select>
              {cidadeErro && <p className="text-xs text-destructive mt-1">{cidadeErro}</p>}
            </div>

            {/* Submit */}
            <button
              onClick={handleCreate} disabled={saving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        )}

        {/* ── Criar Novo (local suplente) Form ── */}
        {criarNovoMode && (
          <div className="space-y-3 mt-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
              <div>
                <p className="text-xs text-muted-foreground">Modo:</p>
                <p className="text-sm font-bold text-foreground">Novo usuário livre</p>
                <p className="text-[10px] text-primary font-medium">Sem vínculo com sistema externo</p>
              </div>
              <button onClick={() => setCriarNovoMode(false)} className="text-xs text-muted-foreground underline">Voltar</button>
            </div>

            {/* Nome */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>

            {/* Profissão / Cargo */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Profissão / Cargo</label>
              <input type="text" value={novoProfissao} onChange={e => setNovoProfissao(e.target.value)} className={inputCls} placeholder="Ex: Suplente, Assistente Social, Vereador..." />
              <p className="text-[10px] text-muted-foreground">Vem como "Suplente" por padrão — edite para outra profissão se precisar</p>
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Senha *</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha} onChange={e => setSenha(e.target.value)}
                  className={inputCls} placeholder="Mínimo 6 caracteres"
                />
                <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Superior */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Superior hierárquico</label>
              <select value={superiorId} onChange={e => setSuperiorId(e.target.value)} className={inputCls}>
                <option value="">Nenhum (raiz)</option>
                {possiveisSuperior.map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>
                ))}
              </select>
            </div>

            {/* Cidade */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cidade *</label>
              <select
                value={cidadeSelecionada}
                onChange={e => { setCidadeSelecionada(e.target.value); setCidadeErro(''); }}
                className={`${inputCls} ${cidadeErro ? 'border-destructive ring-1 ring-destructive/30' : ''}`}
              >
                <option value="">Selecione a cidade...</option>
                {municipios.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} – {m.uf}</option>
                ))}
              </select>
              {cidadeErro && <p className="text-xs text-destructive mt-1">{cidadeErro}</p>}
            </div>

            {/* Submit */}
            <button
              onClick={handleCreate} disabled={saving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
