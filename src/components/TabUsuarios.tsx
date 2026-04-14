import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { toast } from '@/hooks/use-toast';
import ModulosUsuario from '@/components/ModulosUsuario';
import {
  Loader2, UserPlus, Users, User, CheckCircle2, Search, Eye, EyeOff,
  ChevronRight, ArrowLeft, Shield, Pencil, Trash2, KeyRound, Save, Link2, MapPin,
  Navigation, Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface SuplenteExterno {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
  cargo_disputado: string | null;
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
  auth_user_id: string | null;
  ativo: boolean;
  municipio_id: string | null;
}

type SubTab = 'suplentes' | 'avulso' | 'gerenciar';

const MODULOS_INLINE = [
  { id: 'cadastrar_liderancas', label: '👥 Lideranças (+ Fiscais + Eleitores)' },
  { id: 'cadastrar_eleitores', label: '🎯 Somente Eleitores' },
  { id: 'ver_rede', label: '🌐 Ver Rede Completa' },
];

export default function TabUsuarios() {
  const { isAdmin } = useAuth();
  const { municipios } = useCidade();
  const [subTab, setSubTab] = useState<SubTab>('gerenciar');
  const [suplentes, setSuplentes] = useState<SuplenteExterno[]>([]);
  const [liderancas, setLiderancas] = useState<LiderancaExterna[]>([]);
  const [usuarios, setUsuarios] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create user form state
  const [creating, setCreating] = useState<{ tipo: 'suplente' | 'avulso'; suplenteId?: string; nomeDefault: string } | null>(null);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [tipoUsuario, setTipoUsuario] = useState<string>('suplente');
  const [superiorId, setSuperiorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string>('');
  const [cidadeErro, setCidadeErro] = useState('');

  // Avulso: link to suplente/liderança
  const [linkedSuplenteId, setLinkedSuplenteId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [selectedModulos, setSelectedModulos] = useState<Set<string>>(new Set());

  // Edit user state
  const [editing, setEditing] = useState<HierarchyUser | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [showEditSenha, setShowEditSenha] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editCidade, setEditCidade] = useState<string>('');

  // Modules view
  const [viewingModules, setViewingModules] = useState<HierarchyUser | null>(null);

  // Location history
  const [locHistory, setLocHistory] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(false);

  const [cargoMap, setCargoMap] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [supRes, lidRes, usrRes, localSupRes] = await Promise.all([
      supabase.functions.invoke('buscar-suplentes'),
      supabase.functions.invoke('buscar-liderancas-externo'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id, auth_user_id, ativo, municipio_id').eq('ativo', true).order('nome'),
      (supabase as any).from('suplentes').select('id, cargo_disputado').not('cargo_disputado', 'is', null),
    ]);
    if (!supRes.error && supRes.data) setSuplentes(supRes.data);
    if (!lidRes.error && lidRes.data) setLiderancas(lidRes.data);
    setUsuarios((usrRes.data || []) as HierarchyUser[]);

    // Build cargo map from both external and local suplentes
    const map: Record<string, string> = {};
    if (Array.isArray(supRes.data)) {
      supRes.data.forEach((s: any) => { if (s.cargo_disputado) map[s.id] = s.cargo_disputado; });
    }
    if (Array.isArray(localSupRes?.data)) {
      localSupRes.data.forEach((s: any) => { if (s.cargo_disputado) map[s.id] = s.cargo_disputado; });
    }
    setCargoMap(map);

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const suplentesComUsuario = useMemo(() => {
    return new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
  }, [usuarios]);

  const possiveisSuperior = useMemo(() => {
    return usuarios.filter(u => ['super_admin', 'coordenador', 'suplente'].includes(u.tipo));
  }, [usuarios]);

  const filteredSuplentes = useMemo(() => {
    if (!search) return suplentes;
    const q = search.toLowerCase();
    return suplentes.filter(s => s.nome.toLowerCase().includes(q));
  }, [suplentes, search]);

  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  const filteredUsuarios = useMemo(() => {
    let list = usuarios;
    if (filtroTipo !== 'todos') list = list.filter(u => u.tipo === filtroTipo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.nome.toLowerCase().includes(q));
    }
    return list;
  }, [usuarios, search, filtroTipo]);

  // Search results for linking suplente/liderança in avulso form
  const linkSuplentesFiltered = useMemo(() => {
    if (!linkSearch) return [];
    const q = linkSearch.toLowerCase();
    return suplentes.filter(s => s.nome.toLowerCase().includes(q)).slice(0, 5);
  }, [suplentes, linkSearch]);

  const linkLiderancasFiltered = useMemo(() => {
    if (!linkSearch) return [];
    const q = linkSearch.toLowerCase();
    return liderancas.filter(l => (l.pessoas?.nome || '').toLowerCase().includes(q)).slice(0, 5);
  }, [liderancas, linkSearch]);

  const openCreateSuplente = (sup: SuplenteExterno) => {
    setCreating({ tipo: 'suplente', suplenteId: sup.id, nomeDefault: sup.nome });
    setNome(sup.nome);
    setSenha('');
    setTipoUsuario('suplente');
    setSuperiorId('');
    setShowSenha(false);
    setLinkedSuplenteId(sup.id);
    setLinkSearch('');
    setSelectedModulos(new Set());
    setCidadeSelecionada('');
    setCidadeErro('');
  };

  const openCreateAvulso = () => {
    setCreating({ tipo: 'avulso', nomeDefault: '' });
    setNome('');
    setSenha('');
    setTipoUsuario('suplente');
    setSuperiorId('');
    setShowSenha(false);
    setLinkedSuplenteId(null);
    setLinkSearch('');
    setSelectedModulos(new Set());
    setCidadeSelecionada('');
    setCidadeErro('');
  };

  const handleCreate = async () => {
    if (!nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!senha.trim() || senha.length < 6) { toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' }); return; }
    if (!cidadeSelecionada) { setCidadeErro('Selecione a cidade do usuário'); return; }
    if (!creating) return;

    setSaving(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        senha: senha.trim(),
        tipo: tipoUsuario,
        superior_id: superiorId || null,
        municipio_id: cidadeSelecionada,
      };
      if (creating.tipo === 'suplente' && creating.suplenteId) {
        payload.suplente_id = creating.suplenteId;
      } else if (linkedSuplenteId && tipoUsuario === 'suplente') {
        payload.suplente_id = linkedSuplenteId;
      }

      const { data, error } = await supabase.functions.invoke('criar-usuario', { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Save selected modules
      if (data?.hierarquia_id && selectedModulos.size > 0) {
        const modulosInsert = Array.from(selectedModulos).map(modulo => ({
          usuario_id: data.hierarquia_id,
          modulo,
        }));
        await (supabase as any).from('usuario_modulos').insert(modulosInsert);
      }

      toast({ title: '✅ Usuário criado!', description: `${nome} pode acessar o sistema` });
      setCreating(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openEdit = (user: HierarchyUser) => {
    setEditing(user);
    setEditNome(user.nome);
    setEditSenha('');
    setShowEditSenha(false);
    setConfirmDelete(false);
    setEditCidade(user.municipio_id || '');
    // Fetch location history
    setLocHistory([]);
    setLocLoading(true);
    supabase.from('localizacoes_usuarios')
      .select('*')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(234)
      .then(({ data }) => {
        setLocHistory(data || []);
        setLocLoading(false);
      });
  };

  const handleEdit = async () => {
    if (!editing) return;
    if (!editNome.trim()) { toast({ title: 'Nome não pode ser vazio', variant: 'destructive' }); return; }
    if (editSenha && editSenha.length < 6) { toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' }); return; }

    setEditSaving(true);
    try {
      const payload: any = { acao: 'atualizar', hierarquia_id: editing.id, auth_user_id: editing.auth_user_id };
      if (editNome.trim() !== editing.nome) payload.novo_nome = editNome.trim();
      if (editSenha.trim()) payload.nova_senha = editSenha.trim();
      if (editCidade && editCidade !== (editing.municipio_id || '')) payload.novo_municipio_id = editCidade;
      if (!payload.novo_nome && !payload.nova_senha && !payload.novo_municipio_id) { toast({ title: 'Nenhuma alteração' }); setEditSaving(false); return; }

      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', { body: payload });
      if (error) {
        let errorMessage = error.message;
        const context = (error as any).context;

        if (context && typeof context.json === 'function') {
          try {
            const details = await context.json();
            errorMessage = details?.error || errorMessage;
          } catch {
            if (context && typeof context.text === 'function') {
              try {
                const rawText = await context.text();
                if (rawText) errorMessage = rawText;
              } catch {
                // ignore parse fallback error
              }
            }
          }
        }

        throw new Error(errorMessage);
      }
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário atualizado!' });
      setEditing(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: { acao: 'deletar', hierarquia_id: editing.id, auth_user_id: editing.auth_user_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário removido!' });
      setEditing(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setEditSaving(false); }
  };

  const toggleModuloInline = (modulo: string) => {
    setSelectedModulos(prev => {
      const next = new Set(prev);
      if (next.has(modulo)) next.delete(modulo);
      else next.add(modulo);
      return next;
    });
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  const tipoLabel = (t: string) => {
    const labels: Record<string, string> = { super_admin: 'Admin', coordenador: 'Coord.', suplente: 'Suplente', lideranca: 'Liderança' };
    return labels[t] || t;
  };

  const tipoColor = (t: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-500/10 text-red-600',
      coordenador: 'bg-orange-500/10 text-orange-600',
      suplente: 'bg-blue-500/10 text-blue-600',
      lideranca: 'bg-purple-500/10 text-purple-600',
    };
    return colors[t] || 'bg-muted text-muted-foreground';
  };

  if (!isAdmin) {
    return (
      <div className="section-card text-center py-8">
        <Shield size={32} className="mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  // MODULES VIEW
  if (viewingModules) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setViewingModules(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{viewingModules.nome}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoColor(viewingModules.tipo)}`}>{tipoLabel(viewingModules.tipo)}</span>
            </div>
          </div>
          <ModulosUsuario usuarioId={viewingModules.id} />
        </div>
      </div>
    );
  }

  // EDIT VIEW
  if (editing) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Pencil size={24} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Editar Usuário</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoColor(editing.tipo)}`}>{tipoLabel(editing.tipo)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><KeyRound size={12} /> Nova senha (deixe vazio para manter)</label>
              <div className="relative">
                <input type={showEditSenha ? 'text' : 'password'} value={editSenha} onChange={e => setEditSenha(e.target.value)} className={inputCls} placeholder="Nova senha (opcional)" />
                <button onClick={() => setShowEditSenha(!showEditSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showEditSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin size={12} /> Cidade</label>
              <select value={editCidade} onChange={e => setEditCidade(e.target.value)} className={inputCls}>
                <option value="">Sem cidade</option>
                {municipios.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} – {m.uf}</option>
                ))}
              </select>
            </div>
            <button onClick={handleEdit} disabled={editSaving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {editSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Modules */}
        <div className="section-card">
          <ModulosUsuario usuarioId={editing.id} />
        </div>

        {/* Location History */}
        <div className="section-card">
          <div className="flex items-center gap-2 mb-3">
            <Navigation size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Histórico de Localização</h3>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">
              {locHistory.length} registros
            </span>
          </div>
          {locLoading ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-primary" /></div>
          ) : locHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro de localização</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {locHistory.map((loc, i) => (
                <div key={loc.id || i} className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/30 border border-border">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={13} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-foreground">
                        {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
                      </p>
                      {loc.precisao && (
                        <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">±{loc.precisao}m</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock size={10} className="text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(loc.criado_em), 'dd/MM/yyyy HH:mm')}
                      </p>
                      {loc.fonte && (
                        <span className="text-[9px] text-muted-foreground">• {loc.fonte}</span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-primary underline flex-shrink-0"
                  >
                    Mapa
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>


        <div className="section-card border-destructive/30">
          <h3 className="text-sm font-semibold text-destructive mb-2">Zona de perigo</h3>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full h-10 border border-destructive/30 text-destructive text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]">
              <Trash2 size={16} /> Remover Acesso
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tem certeza? O usuário perderá acesso ao sistema.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl">Cancelar</button>
                <button onClick={handleDelete} disabled={editSaving}
                  className="flex-1 h-10 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE VIEW
  if (creating) {
    const selectedSuplente = linkedSuplenteId ? suplentes.find(s => s.id === linkedSuplenteId) : null;
    const showLinkSection = creating.tipo === 'avulso' && (tipoUsuario === 'suplente' || tipoUsuario === 'lideranca');

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setCreating(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {creating.tipo === 'suplente' ? 'Criar Acesso (Suplente)' : 'Novo Usuário'}
              </h2>
              {creating.nomeDefault && <p className="text-xs text-muted-foreground">{creating.nomeDefault}</p>}
            </div>
          </div>
          <div className="space-y-3">
            {/* Tipo de usuário */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de usuário</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'suplente', label: 'Suplente', icon: '🏛️' },
                  { value: 'lideranca', label: 'Liderança', icon: '👥' },
                  { value: 'coordenador', label: 'Coordenador', icon: '📋' },
                ].map(opt => (
                  <button key={opt.value}
                    onClick={() => { setTipoUsuario(opt.value); setLinkedSuplenteId(null); setLinkSearch(''); }}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      tipoUsuario === opt.value
                        ? 'gradient-primary text-white shadow-lg'
                        : 'bg-muted border border-border text-muted-foreground'
                    }`}
                    disabled={creating.tipo === 'suplente'}
                  >
                    {opt.icon} {opt.label}
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
                <input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} className={inputCls} placeholder="Mínimo 4 caracteres" />
                <button onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Link to suplente (when type is suplente and avulso) */}
            {showLinkSection && tipoUsuario === 'suplente' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Link2 size={12} /> Vincular a suplente (opcional)
                </label>
                {selectedSuplente ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{selectedSuplente.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedSuplente.partido || '—'} · {selectedSuplente.regiao_atuacao || '—'}</p>
                    </div>
                    <button onClick={() => { setLinkedSuplenteId(null); setLinkSearch(''); }}
                      className="text-[10px] text-destructive font-medium shrink-0">Remover</button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                        placeholder="Buscar suplente para vincular..."
                        className="w-full h-10 pl-8 pr-3 bg-muted border border-border rounded-xl text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    {linkSuplentesFiltered.length > 0 && (
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {linkSuplentesFiltered.map(s => (
                          <button key={s.id} onClick={() => { setLinkedSuplenteId(s.id); setLinkSearch(''); }}
                            className="w-full flex items-center gap-2 p-2 rounded-lg bg-card border border-border text-left active:scale-[0.98]">
                            <User size={14} className="text-blue-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{s.nome}</p>
                              <p className="text-[9px] text-muted-foreground">{s.partido || '—'} · {s.regiao_atuacao || '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Superior */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Superior hierárquico</label>
              <select value={superiorId} onChange={e => setSuperiorId(e.target.value)} className={inputCls}>
                <option value="">Nenhum (raiz)</option>
                {possiveisSuperior.map(u => (<option key={u.id} value={u.id}>{u.nome} ({tipoLabel(u.tipo)})</option>))}
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

            {/* Módulos / Permissões inline */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Permissões de acesso</label>
              <div className="grid grid-cols-1 gap-1.5">
                {MODULOS_INLINE.map(mod => {
                  const active = selectedModulos.has(mod.id);
                  return (
                    <button key={mod.id} onClick={() => toggleModuloInline(mod.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all active:scale-[0.98] ${
                        active ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                      }`}>
                      <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        active ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      }`}>
                        {active && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-xs font-medium text-foreground">{mod.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={handleCreate} disabled={saving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN LIST VIEW
  const comAcesso = suplentes.filter(s => suplentesComUsuario.has(s.id)).length;
  const semAcesso = suplentes.length - comAcesso;

  return (
    <div className="space-y-3 pb-24">
      {/* Sub tabs */}
      <div className="flex gap-1.5">
        {([
          { id: 'gerenciar' as SubTab, label: `Usuários (${usuarios.length})` },
          { id: 'suplentes' as SubTab, label: `Suplentes (${suplentes.length})` },
          { id: 'avulso' as SubTab, label: '+ Novo' },
        ]).map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setSearch(''); if (t.id === 'avulso') openCreateAvulso(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              subTab === t.id ? 'gradient-primary text-white shadow-lg' : 'bg-card border border-border text-muted-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SUPLENTES - Create from external DB */}
      {subTab === 'suplentes' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{suplentes.length}</p>
              <p className="text-[9px] text-muted-foreground">Total</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-500">{comAcesso}</p>
              <p className="text-[9px] text-muted-foreground">Com acesso</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className="text-lg font-bold text-amber-500">{semAcesso}</p>
              <p className="text-[9px] text-muted-foreground">Sem acesso</p>
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar suplente..."
              className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="space-y-2">
            {filteredSuplentes.map(s => {
              const temAcesso = suplentesComUsuario.has(s.id);
              const user = temAcesso ? usuarios.find(u => u.suplente_id === s.id) : null;
              return (
                <div key={s.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${temAcesso ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    {temAcesso ? <CheckCircle2 size={18} className="text-emerald-500" /> : <User size={18} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.nome}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground truncate">{s.partido || '—'} · {s.regiao_atuacao || '—'}</span>
                      {s.cargo_disputado && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600">
                          {s.cargo_disputado}
                        </span>
                      )}
                    </div>
                  </div>
                  {temAcesso && user ? (
                    <button onClick={() => openEdit(user)}
                      className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold rounded-lg active:scale-95 shrink-0">
                      <Pencil size={12} /> Editar
                    </button>
                  ) : (
                    <button onClick={() => openCreateSuplente(s)}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg active:scale-95 shrink-0">
                      Criar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GERENCIAR - All existing users */}
      {subTab === 'gerenciar' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..."
              className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Filter by type */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                filtroTipo === 'todos' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              Todos ({usuarios.length})
            </button>
            {['super_admin', 'coordenador', 'suplente', 'lideranca'].map(tipo => {
              const count = usuarios.filter(u => u.tipo === tipo).length;
              if (count === 0) return null;
              return (
                <button key={tipo}
                  onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all active:scale-95 ${
                    filtroTipo === tipo ? 'bg-primary text-primary-foreground' : tipoColor(tipo)
                  }`}
                >
                  {tipoLabel(tipo)} ({count})
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">{filteredUsuarios.length} usuário{filteredUsuarios.length !== 1 ? 's' : ''}</p>

          <div className="space-y-2">
            {filteredUsuarios.map(u => (
              <div key={u.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoColor(u.tipo)}`}>{tipoLabel(u.tipo)}</span>
                    {u.suplente_id && cargoMap[u.suplente_id] && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600">
                        {cargoMap[u.suplente_id]}
                      </span>
                    )}
                    {u.municipio_id && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin size={8} />{municipios.find(m => m.id === u.municipio_id)?.nome || ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setViewingModules(u)}
                    className="p-2 bg-primary/10 text-primary rounded-lg active:scale-95" title="Permissões">
                    <Shield size={14} />
                  </button>
                  <button onClick={() => openEdit(u)}
                    className="p-2 bg-muted text-muted-foreground rounded-lg active:scale-95" title="Editar">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
