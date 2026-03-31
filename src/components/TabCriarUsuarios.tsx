import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, UserPlus, Users, User, CheckCircle2, Search, Eye, EyeOff,
  ChevronDown, ChevronUp, Shield
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

type TabType = 'suplentes' | 'liderancas';

export default function TabCriarUsuarios() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabType>('suplentes');
  const [suplentes, setSuplentes] = useState<SuplenteExterno[]>([]);
  const [liderancas, setLiderancas] = useState<LiderancaExterna[]>([]);
  const [usuarios, setUsuarios] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create user form state
  const [creatingFor, setCreatingFor] = useState<{ tipo: TabType; id: string; nome: string } | null>(null);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [superiorId, setSuperiorId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

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

  // Check which suplentes already have users
  const suplentesComUsuario = useMemo(() => {
    const ids = new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
    return ids;
  }, [usuarios]);

  const suplentesFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return suplentes.filter(s => !q || s.nome.toLowerCase().includes(q));
  }, [suplentes, search]);

  const liderancasFiltradas = useMemo(() => {
    const q = search.toLowerCase();
    return liderancas.filter(l => {
      const nome = l.pessoas?.nome || '';
      return !q || nome.toLowerCase().includes(q);
    });
  }, [liderancas, search]);

  // Check if liderança already has user by matching name (approximate)
  const liderancaComUsuario = (lid: LiderancaExterna) => {
    const nome = lid.pessoas?.nome?.toLowerCase();
    if (!nome) return false;
    return usuarios.some(u => u.tipo === 'lideranca' && u.nome.toLowerCase() === nome);
  };

  const openCreateForm = (tipo: TabType, id: string, nomeDefault: string) => {
    setCreatingFor({ tipo, id, nome: nomeDefault });
    setNome(nomeDefault);
    setSenha('');
    setSuperiorId('');
    setShowSenha(false);
  };

  const handleCreate = async () => {
    if (!nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!senha.trim() || senha.length < 4) { toast({ title: 'Senha deve ter pelo menos 4 caracteres', variant: 'destructive' }); return; }
    if (!creatingFor) return;

    setSaving(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        senha: senha.trim(),
        tipo: creatingFor.tipo === 'suplentes' ? 'suplente' : 'lideranca',
        superior_id: superiorId || null,
      };

      if (creatingFor.tipo === 'suplentes') {
        payload.suplente_id = creatingFor.id;
      }

      const { data, error } = await supabase.functions.invoke('criar-usuario', {
        body: payload,
      });

      if (error) throw new Error(error.message || 'Erro ao criar usuário');
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário criado!', description: `${nome} pode acessar o sistema` });
      setCreatingFor(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const possiveisSuperior = useMemo(() => {
    return usuarios.filter(u => ['super_admin', 'coordenador', 'suplente'].includes(u.tipo));
  }, [usuarios]);

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

  // Create user modal/form
  if (creatingFor) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setCreatingFor(null)} className="text-sm text-muted-foreground">
          ← Voltar
        </button>

        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Criar Usuário</h2>
              <p className="text-xs text-muted-foreground">
                {creatingFor.tipo === 'suplentes' ? 'Suplente' : 'Liderança'}: {creatingFor.nome}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className={inputCls}
                  placeholder="Mínimo 4 caracteres"
                />
                <button onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Superior hierárquico</label>
              <select value={superiorId} onChange={e => setSuperiorId(e.target.value)} className={inputCls}>
                <option value="">Nenhum (raiz)</option>
                {possiveisSuperior.map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.tipo})</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalSup = suplentes.length;
  const comUsuarioSup = suplentes.filter(s => suplentesComUsuario.has(s.id)).length;
  const semUsuarioSup = totalSup - comUsuarioSup;

  return (
    <div className="space-y-3 pb-24">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTab('suplentes'); setSearch(''); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'suplentes' ? 'gradient-primary text-white shadow-lg' : 'bg-card border border-border text-muted-foreground'
          }`}
        >
          <User size={14} className="inline mr-1" />
          Suplentes ({totalSup})
        </button>
        <button
          onClick={() => { setTab('liderancas'); setSearch(''); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            tab === 'liderancas' ? 'gradient-primary text-white shadow-lg' : 'bg-card border border-border text-muted-foreground'
          }`}
        >
          <Users size={14} className="inline mr-1" />
          Lideranças ({liderancas.length})
        </button>
      </div>

      {/* Stats */}
      {tab === 'suplentes' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl border border-border p-2.5 text-center">
            <p className="text-lg font-bold text-foreground">{totalSup}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-500">{comUsuarioSup}</p>
            <p className="text-[9px] text-muted-foreground">Com acesso</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-2.5 text-center">
            <p className="text-lg font-bold text-amber-500">{semUsuarioSup}</p>
            <p className="text-[9px] text-muted-foreground">Sem acesso</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'suplentes' ? 'Buscar suplente...' : 'Buscar liderança...'}
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {tab === 'suplentes' ? (
          suplentesFiltrados.length === 0 ? (
            <div className="section-card text-center py-6">
              <p className="text-sm text-muted-foreground">Nenhum suplente encontrado</p>
            </div>
          ) : (
            suplentesFiltrados.map(s => {
              const temUsuario = suplentesComUsuario.has(s.id);
              return (
                <div key={s.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    temUsuario ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  }`}>
                    {temUsuario ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <User size={18} className="text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.partido || '—'} · {s.regiao_atuacao || '—'}
                    </p>
                  </div>
                  {temUsuario ? (
                    <span className="text-[10px] text-emerald-500 font-medium shrink-0">Ativo</span>
                  ) : (
                    <button
                      onClick={() => openCreateForm('suplentes', s.id, s.nome)}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg active:scale-95 shrink-0"
                    >
                      Criar
                    </button>
                  )}
                </div>
              );
            })
          )
        ) : (
          liderancasFiltradas.length === 0 ? (
            <div className="section-card text-center py-6">
              <p className="text-sm text-muted-foreground">Nenhuma liderança encontrada</p>
            </div>
          ) : (
            liderancasFiltradas.map(l => {
              const nome = l.pessoas?.nome || '—';
              const temUsuario = liderancaComUsuario(l);
              return (
                <div key={l.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    temUsuario ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                  }`}>
                    {temUsuario ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <Users size={18} className="text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {l.tipo_lideranca || '—'} · {l.regiao_atuacao || '—'} · {l.status || '—'}
                    </p>
                  </div>
                  {temUsuario ? (
                    <span className="text-[10px] text-emerald-500 font-medium shrink-0">Ativo</span>
                  ) : (
                    <button
                      onClick={() => openCreateForm('liderancas', l.id, nome)}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg active:scale-95 shrink-0"
                    >
                      Criar
                    </button>
                  )}
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
