import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, TipoUsuario } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import {
  LogOut, Shield, User, UserPlus, Loader2, Crown, Users, Eye, Copy, X,
  Pencil, Trash2, Settings, Search, ArrowLeft, KeyRound, EyeOff, ChevronDown,
  MapPin, Building2, Plus, ClipboardList
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ModulosUsuario from '@/components/ModulosUsuario';

const tipoLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  coordenador: 'Coordenador',
  suplente: 'Suplente',
  lideranca: 'Liderança',
  fernanda: 'Fernanda',
};

const tipoIcons: Record<string, typeof Shield> = {
  super_admin: Crown,
  coordenador: Shield,
  suplente: User,
  lideranca: Users,
  fernanda: ClipboardList,
};

const tipoColors: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-600',
  coordenador: 'bg-orange-500/10 text-orange-600',
  suplente: 'bg-blue-500/10 text-blue-600',
  lideranca: 'bg-purple-500/10 text-purple-600',
  fernanda: 'bg-primary/10 text-primary',
};

const MODULOS_OPTIONS = [
  { id: 'master', label: '🔑 Master' },
  { id: 'cadastrar_liderancas', label: '👥 Lideranças (+ Fiscais + Eleitores)' },
  { id: 'cadastrar_eleitores', label: '🎯 Somente Eleitores' },
];

interface SuplenteOption {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  cargo_disputado?: string | null;
}

interface LiderancaOption {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  whatsapp: string | null;
}

interface UsuarioItem {
  id: string;
  nome: string;
  tipo: string;
  criado_em: string;
  suplente_id: string | null;
  auth_user_id: string | null;
  municipio_id: string | null;
}

type ViewMode = 'list' | 'create' | 'edit';

const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

function SelfPasswordChange() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  const handleAlterarSenha = async () => {
    if (!novaSenha.trim() || novaSenha.length < 6) {
      toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: { acao: 'alterar_propria_senha', nova_senha: novaSenha.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Senha alterada com sucesso!' });
      setNovaSenha('');
      setAberto(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) {
    return (
      <div className="section-card">
        <button
          onClick={() => setAberto(true)}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Alterar Senha</p>
            <p className="text-[11px] text-muted-foreground">Troque sua senha de acesso</p>
          </div>
          <ChevronDown size={16} className="text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="section-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Alterar Senha</h3>
        </div>
        <button onClick={() => setAberto(false)} className="text-muted-foreground p-1">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
        <div className="relative">
          <input
            type={showSenha ? 'text' : 'password'}
            value={novaSenha}
            onChange={e => setNovaSenha(e.target.value)}
            placeholder="Mínimo 4 caracteres"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShowSenha(!showSenha)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <button
        onClick={handleAlterarSenha}
        disabled={salvando || novaSenha.length < 6}
        className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-xl active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {salvando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
        {salvando ? 'Salvando...' : 'Alterar Senha'}
      </button>
    </div>
  );
}

export default function TabPerfil() {
  const { usuario, isAdmin, tipoUsuario, signOut } = useAuth();
  const { municipios } = useCidade();

  // Data
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [suplentes, setSuplentes] = useState<SuplenteOption[]>([]);
  const [liderancas, setLiderancas] = useState<LiderancaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // View mode
  const [view, setView] = useState<ViewMode>('list');

  // Create form
  const [createMode, setCreateMode] = useState<'suplente' | 'lideranca' | 'livre'>('suplente');
  const [selectedExternalId, setSelectedExternalId] = useState('');
  const [nomeLivre, setNomeLivre] = useState('');
  const [tipoNovo, setTipoNovo] = useState<string>('suplente');
  const [senhaNova, setSenhaNova] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [selectedModulos, setSelectedModulos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [externalSearch, setExternalSearch] = useState('');
  const [createCidade, setCreateCidade] = useState('');
  const [cargoTagPerfil, setCargoTagPerfil] = useState('');

  // Edit
  const [editUser, setEditUser] = useState<UsuarioItem | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [showEditSenha, setShowEditSenha] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editCidade, setEditCidade] = useState('');

  // Credentials modal after creation
  const [credenciais, setCredenciais] = useState<{ nome: string; senha: string; id: string; auth_user_id: string; tipo: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const usrRes = await supabase
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, criado_em, suplente_id, auth_user_id, municipio_id')
        .eq('ativo', true)
        .order('nome')
        .abortSignal(controller.signal);

      setUsuarios((usrRes.data || []) as UsuarioItem[]);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      setUsuarios([]);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }

    // Load external data in background (slow edge functions - don't block UI)
    supabase.functions.invoke('buscar-suplentes')
      .then(({ data }) => { if (data && Array.isArray(data)) setSuplentes(data); })
      .catch(() => {});
    supabase.functions.invoke('buscar-liderancas-externo')
      .then(({ data }) => { if (data && Array.isArray(data)) setLiderancas(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  // Suplentes já vinculados
  const suplentesJaVinculados = useMemo(() =>
    new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id)),
    [usuarios]
  );

  // Filtered externals for create form
  const filteredSuplentes = useMemo(() => {
    const available = suplentes.filter(s => !suplentesJaVinculados.has(s.id));
    if (!externalSearch) return available;
    const q = externalSearch.toLowerCase();
    return available.filter(s => s.nome.toLowerCase().includes(q));
  }, [suplentes, suplentesJaVinculados, externalSearch]);

  const filteredLiderancas = useMemo(() => {
    if (!externalSearch) return liderancas;
    const q = externalSearch.toLowerCase();
    return liderancas.filter(l => (l.nome || '').toLowerCase().includes(q));
  }, [liderancas, externalSearch]);

  // Filtered users list
  const filteredUsuarios = useMemo(() => {
    if (!search) return usuarios;
    const q = search.toLowerCase();
    return usuarios.filter(u => {
      if (u.nome.toLowerCase().includes(q)) return true;
      // Search by profession/tag from suplente
      const tag = u.suplente_id ? suplentes.find(s => s.id === u.suplente_id)?.cargo_disputado : null;
      if (tag && tag.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [usuarios, search, suplentes]);

  const getSuplenteNome = (sid: string | null) => {
    if (!sid) return null;
    return suplentes.find(s => s.id === sid)?.nome || null;
  };

  const getSuplenteTag = (sid: string | null) => {
    if (!sid) return null;
    const sup = suplentes.find(s => s.id === sid);
    return sup?.cargo_disputado || null;
  };

  const copiar = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: `${label} copiado!` });
  };

  // ─── CREATE ─────────────────────────────────────
  const openCreate = () => {
    setView('create');
    setCreateMode('suplente');
    setSelectedExternalId('');
    setNomeLivre('');
    setTipoNovo('suplente');
    setSenhaNova('');
    setShowSenha(false);
    setSelectedModulos(new Set());
    setExternalSearch('');
    setCreateCidade(municipios.length === 1 ? municipios[0].id : '');
    setCargoTagPerfil('');
  };

  const handleCreate = async () => {
    let nomeUsuario = '';
    if (createMode === 'livre') {
      if (!nomeLivre.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
      nomeUsuario = nomeLivre.trim();
    } else {
      if (!selectedExternalId) { toast({ title: `Selecione um ${createMode === 'suplente' ? 'suplente' : 'liderança'}`, variant: 'destructive' }); return; }
      if (createMode === 'suplente') {
        nomeUsuario = suplentes.find(s => s.id === selectedExternalId)?.nome || '';
      } else {
        nomeUsuario = liderancas.find(l => l.id === selectedExternalId)?.nome || '';
      }
    }
    if (!senhaNova.trim() || senhaNova.length < 6) {
      toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (!createCidade) {
      toast({ title: 'Selecione a cidade do usuário', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let suplenteIdParaVinculo: string | null = null;

      // For livre mode with suplente/lideranca, create a local suplente with the cargo tag
      if (createMode === 'livre' && (tipoNovo === 'suplente' || tipoNovo === 'lideranca')) {
        const cargoBase = cargoTagPerfil.trim() || (tipoNovo === 'lideranca' ? 'Liderança' : 'Suplente');
        const { data: novoSup, error: novoSupError } = await (supabase as any)
          .from('suplentes')
          .insert({ nome: nomeUsuario, cargo_disputado: cargoBase })
          .select('id')
          .single();
        if (novoSupError) throw new Error(novoSupError.message);
        suplenteIdParaVinculo = novoSup.id;
      }

      const body: any = {
        nome: nomeUsuario,
        senha: senhaNova.trim(),
        tipo: tipoNovo,
        superior_id: usuario?.id || null,
        municipio_id: createCidade,
      };
      if (createMode === 'suplente' && selectedExternalId) {
        body.suplente_id = selectedExternalId;
      }
      if (suplenteIdParaVinculo) {
        body.suplente_id = suplenteIdParaVinculo;
      }

      const { data, error } = await supabase.functions.invoke('criar-usuario', { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));

      // Save modules
      if (data?.hierarquia_id && selectedModulos.size > 0) {
        const modulosInsert = Array.from(selectedModulos).map(modulo => ({
          usuario_id: data.hierarquia_id,
          modulo,
        }));
        await supabase.from('usuario_modulos').insert(modulosInsert);
      }

      const senha = senhaNova.trim();
      setCredenciais({
        nome: nomeUsuario,
        senha,
        id: data.hierarquia_id,
        auth_user_id: data.auth_user_id,
        tipo: tipoNovo,
      });
      setView('list');
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── EDIT ───────────────────────────────────────
  const openEdit = (u: UsuarioItem) => {
    setEditUser(u);
    setEditNome(u.nome);
    setEditSenha('');
    setShowEditSenha(false);
    setConfirmDelete(false);
    setEditCidade(u.municipio_id || '');
    setView('edit');
  };

  const handleEdit = async () => {
    if (!editUser) return;
    if (!editNome.trim()) { toast({ title: 'Nome não pode ser vazio', variant: 'destructive' }); return; }
    if (editSenha && editSenha.length < 6) { toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' }); return; }

    setEditSaving(true);
    try {
      const body: any = { acao: 'atualizar', hierarquia_id: editUser.id, auth_user_id: editUser.auth_user_id };
      if (editNome.trim() !== editUser.nome) body.novo_nome = editNome.trim();
      if (editSenha.trim()) body.nova_senha = editSenha.trim();
      if (editCidade && editCidade !== (editUser.municipio_id || '')) body.novo_municipio_id = editCidade;
      if (!body.novo_nome && !body.nova_senha && !body.novo_municipio_id) { toast({ title: 'Nenhuma alteração' }); setEditSaving(false); return; }

      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário atualizado!' });
      setView('list');
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: { acao: 'deletar', hierarquia_id: editUser.id, auth_user_id: editUser.auth_user_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '🗑️ Usuário removido!' });
      setView('list');
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const toggleModulo = (id: string) => {
    setSelectedModulos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const IconComponent = tipoUsuario ? tipoIcons[tipoUsuario] : User;

  // ─── CREDENTIALS MODAL ─────────────────────────
  if (credenciais) {
    return (
      <div className="space-y-4 pb-24">
        <div className="section-card text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound size={28} className="text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground">✅ Usuário Criado!</h2>
          <p className="text-xs text-muted-foreground mt-1">Anote as credenciais abaixo. A senha não poderá ser visualizada novamente.</p>
        </div>

        <div className="section-card space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Nome de login</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-11 px-3 bg-muted/50 border border-border rounded-xl flex items-center text-sm font-medium text-foreground">{credenciais.nome}</div>
              <button onClick={() => copiar(credenciais.nome, 'Nome')} className="p-2 text-primary active:scale-90"><Copy size={16} /></button>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Senha</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-11 px-3 bg-muted/50 border border-border rounded-xl flex items-center text-sm font-mono font-medium text-foreground">{credenciais.senha}</div>
              <button onClick={() => copiar(credenciais.senha, 'Senha')} className="p-2 text-primary active:scale-90"><Copy size={16} /></button>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tipo</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${tipoColors[credenciais.tipo] || 'bg-muted text-muted-foreground'}`}>
              {tipoLabels[credenciais.tipo as TipoUsuario] || credenciais.tipo}
            </span>
          </div>
        </div>

        <button
          onClick={() => setCredenciais(null)}
          className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold rounded-xl active:scale-[0.97] transition-all"
        >
          Fechar
        </button>
      </div>
    );
  }

  // ─── CREATE VIEW ────────────────────────────────
  if (view === 'create' && isAdmin) {
    const selectedSuplente = createMode === 'suplente' ? suplentes.find(s => s.id === selectedExternalId) : null;
    const selectedLideranca = createMode === 'lideranca' ? liderancas.find(l => l.id === selectedExternalId) : null;

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

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

          <div className="space-y-4">
            {/* Modo: Suplente / Liderança / Livre */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Vincular a</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: 'suplente' as const, label: '🏛️ Suplente' },
                  { value: 'lideranca' as const, label: '👥 Liderança' },
                  { value: 'livre' as const, label: '✏️ Livre' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setCreateMode(opt.value); setSelectedExternalId(''); setExternalSearch(''); }}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      createMode === opt.value
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'bg-muted border border-border text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Busca externa ou nome livre */}
            {createMode === 'livre' ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nome do usuário</label>
                <input type="text" value={nomeLivre} onChange={e => setNomeLivre(e.target.value)} placeholder="Nome completo" className={inputCls} />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Buscar {createMode === 'suplente' ? 'suplente' : 'liderança'}
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={externalSearch}
                    onChange={e => setExternalSearch(e.target.value)}
                    placeholder={`Buscar ${createMode === 'suplente' ? 'suplente' : 'liderança'}...`}
                    className={`${inputCls} pl-9`}
                  />
                </div>

                {/* Selected preview */}
                {selectedExternalId && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(selectedSuplente?.nome || selectedLideranca?.nome || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary truncate">{selectedSuplente?.nome || selectedLideranca?.nome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {selectedSuplente?.regiao_atuacao || selectedLideranca?.regiao_atuacao || ''}
                      </p>
                    </div>
                    <button onClick={() => setSelectedExternalId('')} className="text-muted-foreground p-1"><X size={14} /></button>
                  </div>
                )}

                {/* List */}
                {!selectedExternalId && (
                  <div className="max-h-40 overflow-y-auto space-y-1 mt-1">
                    {createMode === 'suplente' && filteredSuplentes.slice(0, 20).map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedExternalId(s.id); setExternalSearch(''); }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all"
                      >
                        <p className="text-xs font-semibold text-foreground">{s.nome}</p>
                        {s.regiao_atuacao && <p className="text-[10px] text-muted-foreground">{s.regiao_atuacao}</p>}
                      </button>
                    ))}
                    {createMode === 'lideranca' && filteredLiderancas.slice(0, 20).map(l => (
                      <button
                        key={l.id}
                        onClick={() => { setSelectedExternalId(l.id); setExternalSearch(''); }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all"
                      >
                        <p className="text-xs font-semibold text-foreground">{l.nome || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {l.regiao_atuacao || ''}
                        </p>
                      </button>
                    ))}
                    {createMode === 'suplente' && filteredSuplentes.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum suplente disponível</p>
                    )}
                    {createMode === 'lideranca' && filteredLiderancas.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhuma liderança encontrada</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tipo do usuário */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de acesso</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'suplente', label: '🏛️ Suplente' },
                  { value: 'lideranca', label: '👥 Liderança' },
                  { value: 'coordenador', label: '📋 Coordenador' },
                  { value: 'fernanda', label: '🩷 Fernanda' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTipoNovo(opt.value)}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      tipoNovo === opt.value
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'bg-muted border border-border text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Profissão / Cargo (tag) — only for livre mode with suplente/lideranca */}
            {createMode === 'livre' && (tipoNovo === 'suplente' || tipoNovo === 'lideranca') && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Profissão / Cargo (tag)</label>
                <input
                  type="text"
                  value={cargoTagPerfil}
                  onChange={e => setCargoTagPerfil(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Assistente Social, Vereador, Empresário..."
                />
                <p className="text-[10px] text-muted-foreground">Essa tag aparece no perfil e nos filtros de cadastros</p>
              </div>
            )}

            {createMode === 'livre' && tipoNovo === 'fernanda' && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Acesso Fernanda</p>
                <p className="text-[10px] text-muted-foreground">Esse usuário entra direto na tela exclusiva de Cadastros Fernanda.</p>
              </div>
            )}

            {/* Senha */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <KeyRound size={12} /> Senha de acesso
              </label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senhaNova}
                  onChange={e => setSenhaNova(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className={inputCls}
                />
                <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Cidade */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin size={12} /> Cidade *
              </label>
              <select value={createCidade} onChange={e => setCreateCidade(e.target.value)} className={inputCls}>
                <option value="">Selecione a cidade...</option>
                {municipios.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} – {m.uf}</option>
                ))}
              </select>
            </div>

            {/* Módulos */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Módulos / Permissões</label>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULOS_OPTIONS.map(mod => {
                  const active = selectedModulos.has(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModulo(mod.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium active:scale-[0.97] ${
                        active
                          ? 'border-primary/30 bg-primary/5 text-foreground'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        active ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      }`}>
                        {active && <span className="text-white text-[8px] font-bold">✓</span>}
                      </div>
                      {mod.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Acesso'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDIT VIEW ──────────────────────────────────
  if (view === 'edit' && editUser && isAdmin) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Pencil size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{editUser.nome}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tipoColors[editUser.tipo] || 'bg-muted text-muted-foreground'}`}>
                {tipoLabels[editUser.tipo as TipoUsuario] || editUser.tipo}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <KeyRound size={12} /> Nova senha (vazio = manter atual)
              </label>
              <div className="relative">
                <input
                  type={showEditSenha ? 'text' : 'password'}
                  value={editSenha}
                  onChange={e => setEditSenha(e.target.value)}
                  placeholder="Nova senha (opcional)"
                  className={inputCls}
                />
                <button onClick={() => setShowEditSenha(!showEditSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showEditSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Cidade */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin size={12} /> Cidade
              </label>
              <select value={editCidade} onChange={e => setEditCidade(e.target.value)} className={inputCls}>
                <option value="">Sem cidade</option>
                {municipios.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} – {m.uf}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleEdit}
              disabled={editSaving}
              className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {editSaving ? <Loader2 size={18} className="animate-spin" /> : <Pencil size={18} />}
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Módulos */}
        <div className="section-card">
          <ModulosUsuario usuarioId={editUser.id} />
        </div>

        {/* Danger zone */}
        <div className="section-card border-destructive/30">
          <h3 className="text-sm font-semibold text-destructive mb-2">Zona de perigo</h3>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full h-10 border border-destructive/30 text-destructive text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]"
            >
              <Trash2 size={16} /> Remover Acesso
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tem certeza? O usuário perderá acesso permanentemente.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl">Cancelar</button>
                <button
                  onClick={handleDelete}
                  disabled={editSaving}
                  className="flex-1 h-10 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Profile card */}
      <div className="section-card flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <IconComponent size={28} className="text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground mt-3">{usuario?.nome || '—'}</h2>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mt-1 ${tipoColors[tipoUsuario || ''] || 'bg-secondary text-secondary-foreground'}`}>
          {tipoUsuario ? tipoLabels[tipoUsuario] : '—'}
        </span>
      </div>

      {/* Self password change */}
      <SelfPasswordChange />

      {/* User management - Admin only */}
      {isAdmin && (
        <div className="section-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">🔑 Usuários do Sistema</h2>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
            >
              <UserPlus size={14} /> Novo
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
              <Loader2 size={18} className="animate-spin text-primary" />
              Carregando usuários...
            </div>
          ) : (
            <>
              {/* Search */}
              {usuarios.length > 5 && (
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar usuário..."
                    className={`${inputCls} pl-9 h-9 text-xs`}
                  />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-foreground">{usuarios.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="bg-blue-500/5 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{usuarios.filter(u => u.tipo === 'suplente').length}</p>
                  <p className="text-[10px] text-muted-foreground">Suplentes</p>
                </div>
                <div className="bg-purple-500/5 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-purple-600">{usuarios.filter(u => u.tipo === 'lideranca').length}</p>
                  <p className="text-[10px] text-muted-foreground">Lideranças</p>
                </div>
                <div className="bg-primary/5 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-primary">{usuarios.filter(u => u.tipo === 'fernanda').length}</p>
                  <p className="text-[10px] text-muted-foreground">Fernanda</p>
                </div>
              </div>

              {/* User list */}
              <div className="space-y-1.5">
                {filteredUsuarios.map(u => (
                  <button
                    key={u.id}
                    onClick={() => openEdit(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{u.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                        {(u.tipo === 'super_admin' || u.tipo === 'coordenador') && <Crown size={12} className="text-primary shrink-0" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {tipoLabels[u.tipo as TipoUsuario] || u.tipo}
                        {getSuplenteNome(u.suplente_id) ? ` · ${getSuplenteNome(u.suplente_id)}` : ''}
                        {u.municipio_id && (() => { const m = municipios.find(m => m.id === u.municipio_id); return m ? ` · ${m.nome}` : ''; })()}
                      </p>
                      {getSuplenteTag(u.suplente_id) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/50 text-[9px] font-medium text-accent-foreground mt-0.5">
                          {getSuplenteTag(u.suplente_id)}
                        </span>
                      )}
                    </div>
                    <Pencil size={14} className="text-muted-foreground shrink-0" />
                  </button>
                ))}
                {filteredUsuarios.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* City Management - Admin only */}
      {isAdmin && (
        <div className="section-card">
          <h2 className="section-title flex items-center gap-2">🏙️ Gerenciar Cidades</h2>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <input type="text" placeholder="Nome da nova cidade..." id="perfil-nova-cidade"
              className="flex-1 h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
            <button
              onClick={async () => {
                const input = document.getElementById('perfil-nova-cidade') as HTMLInputElement;
                const nome = input?.value?.trim();
                if (!nome) return;
                const { error } = await (supabase as any).from('municipios').insert({ nome, uf: 'GO' });
                if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
                toast({ title: `✅ ${nome} adicionada!` });
                input.value = '';
                window.location.reload();
              }}
              className="h-10 px-4 gradient-primary text-white rounded-xl text-sm font-semibold flex items-center gap-1 active:scale-95">
              <Plus size={14} /> Adicionar
            </button>
          </div>
          <div className="space-y-1.5">
            {municipios.map(m => (
              <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/50">
                <Building2 size={14} className="text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1">{m.nome}</span>
                <span className="text-[10px] text-muted-foreground">{m.uf}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full h-12 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
      >
        <LogOut size={18} /> Sair
      </button>
      <p className="text-center text-[10px] text-muted-foreground">v2.1 · Rede Política – Dra. Fernanda Sarelli</p>
    </div>
  );
}
