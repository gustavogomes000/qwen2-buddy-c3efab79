import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronRight, ArrowLeft, Phone, MessageCircle, Loader2, Users, ChevronDown, UserPlus, Eye, EyeOff, CheckCircle2, Pencil, Trash2, KeyRound, Save, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SuplenteRow {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
  situacao: string | null;
  base_politica: string | null;
  expectativa_votos: number | null;
  total_votos: number | null;
}

interface HierarchyUser {
  id: string;
  nome: string;
  tipo: string;
  suplente_id: string | null;
  auth_user_id: string | null;
}

interface TreeNode {
  tipo: 'lideranca' | 'eleitor';
  id: string;
  nome: string;
  status: string | null;
  telefone: string | null;
  whatsapp: string | null;
  detalhes: string;
  children: TreeNode[];
}

interface Props {
  refreshKey: number;
}

export default function TabSuplentes({ refreshKey }: Props) {
  const { isAdmin } = useAuth();
  const [suplentes, setSuplentes] = useState<SuplenteRow[]>([]);
  const [usuarios, setUsuarios] = useState<HierarchyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SuplenteRow | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ liderancas: 0, eleitores: 0 });

  // Create access state
  const [creatingAccess, setCreatingAccess] = useState<SuplenteRow | null>(null);
  const [accessNome, setAccessNome] = useState('');
  const [accessSenha, setAccessSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [superiorId, setSuperiorId] = useState('');
  const [saving, setSaving] = useState(false);

  // Create new suplente state
  const [creatingNewSuplente, setCreatingNewSuplente] = useState(false);
  const [newSupNome, setNewSupNome] = useState('');
  const [newSupPartido, setNewSupPartido] = useState('');
  const [newSupRegiao, setNewSupRegiao] = useState('');
  const [newSupTelefone, setNewSupTelefone] = useState('');
  const [savingNewSup, setSavingNewSup] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<{ hierarquiaUser: HierarchyUser; suplente: SuplenteRow } | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [showEditSenha, setShowEditSenha] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [supRes, usrRes] = await Promise.all([
      supabase.functions.invoke('buscar-suplentes'),
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id, auth_user_id').eq('ativo', true).order('nome'),
    ]);
    if (!supRes.error && supRes.data) setSuplentes(supRes.data);
    setUsuarios((usrRes.data || []) as HierarchyUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll, refreshKey]);

  const suplentesComUsuario = useMemo(() => {
    return new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
  }, [usuarios]);

  const getUserForSuplente = (suplenteId: string) => {
    return usuarios.find(u => u.suplente_id === suplenteId);
  };

  const possiveisSuperior = useMemo(() => {
    return usuarios.filter(u => ['super_admin', 'coordenador', 'suplente'].includes(u.tipo));
  }, [usuarios]);

  const filtered = useMemo(() => {
    if (!search) return suplentes;
    const q = search.toLowerCase();
    return suplentes.filter(s => s.nome.toLowerCase().includes(q));
  }, [suplentes, search]);

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openDetail = async (sup: SuplenteRow) => {
    setSelected(sup);
    setLoadingTree(true);
    setExpandedIds(new Set());

    const [lRes, eRes] = await Promise.all([
      supabase.from('liderancas').select('id, status, tipo_lideranca, pessoas(nome, telefone, whatsapp)').eq('suplente_id', sup.id).order('criado_em', { ascending: false }),
      supabase.from('possiveis_eleitores').select('id, compromisso_voto, lideranca_id, pessoas(nome, telefone, whatsapp)').eq('suplente_id', sup.id).order('criado_em', { ascending: false }),
    ]);

    const liderancas = (lRes.data || []) as any[];
    const eleitores = (eRes.data || []) as any[];

    setStats({ liderancas: liderancas.length, eleitores: eleitores.length });

    const treeNodes: TreeNode[] = [];

    for (const lid of liderancas) {
      const lidNode: TreeNode = {
        tipo: 'lideranca', id: lid.id, nome: lid.pessoas?.nome || '—',
        status: lid.status, telefone: lid.pessoas?.telefone, whatsapp: lid.pessoas?.whatsapp,
        detalhes: lid.tipo_lideranca || '—', children: [],
      };

      const lidEleitores = eleitores.filter((e: any) => e.lideranca_id === lid.id);
      for (const el of lidEleitores) {
        lidNode.children.push({
          tipo: 'eleitor', id: el.id, nome: el.pessoas?.nome || '—',
          status: el.compromisso_voto, telefone: el.pessoas?.telefone, whatsapp: el.pessoas?.whatsapp,
          detalhes: el.compromisso_voto || 'Indefinido', children: [],
        });
      }
      treeNodes.push(lidNode);
    }

    const orphanEleitores = eleitores.filter((e: any) => !e.lideranca_id);
    for (const el of orphanEleitores) {
      treeNodes.push({
        tipo: 'eleitor', id: el.id, nome: el.pessoas?.nome || '—',
        status: el.compromisso_voto, telefone: el.pessoas?.telefone, whatsapp: el.pessoas?.whatsapp,
        detalhes: el.compromisso_voto || 'Indefinido', children: [],
      });
    }

    setTree(treeNodes);
    setLoadingTree(false);
  };

  const openCreateAccess = (sup: SuplenteRow) => {
    setCreatingAccess(sup);
    setAccessNome(sup.nome);
    setAccessSenha('');
    setSuperiorId('');
    setShowSenha(false);
  };

  const handleCreateAccess = async () => {
    if (!accessNome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!accessSenha.trim() || accessSenha.length < 6) { toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' }); return; }
    if (!creatingAccess) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('criar-usuario', {
        body: {
          nome: accessNome.trim(),
          senha: accessSenha.trim(),
          tipo: 'suplente',
          superior_id: superiorId || null,
          suplente_id: creatingAccess.id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Acesso criado!', description: `${accessNome} pode acessar o sistema` });
      setCreatingAccess(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Edit user functions
  const openEditUser = (sup: SuplenteRow) => {
    const user = getUserForSuplente(sup.id);
    if (!user) return;
    setEditingUser({ hierarquiaUser: user, suplente: sup });
    setEditNome(user.nome);
    setEditSenha('');
    setShowEditSenha(false);
    setConfirmDelete(false);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    const { hierarquiaUser } = editingUser;
    if (!editNome.trim()) { toast({ title: 'Nome não pode ser vazio', variant: 'destructive' }); return; }
    if (editSenha && editSenha.length < 6) { toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' }); return; }

    setEditSaving(true);
    try {
      const payload: any = {
        acao: 'atualizar',
        hierarquia_id: hierarquiaUser.id,
        auth_user_id: hierarquiaUser.auth_user_id,
      };
      if (editNome.trim() !== hierarquiaUser.nome) payload.novo_nome = editNome.trim();
      if (editSenha.trim()) payload.nova_senha = editSenha.trim();

      if (!payload.novo_nome && !payload.nova_senha) {
        toast({ title: 'Nenhuma alteração' }); setEditSaving(false); return;
      }

      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', { body: payload });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário atualizado!' });
      setEditingUser(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;
    const { hierarquiaUser } = editingUser;

    setEditSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: {
          acao: 'deletar',
          hierarquia_id: hierarquiaUser.id,
          auth_user_id: hierarquiaUser.auth_user_id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: '✅ Usuário removido!' });
      setEditingUser(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const typeConfig: Record<string, { bg: string; text: string; label: string; border: string }> = {
    lideranca: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Lid', border: 'border-blue-500/30' },
    eleitor: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Eleit', border: 'border-amber-500/30' },
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const config = typeConfig[node.tipo];
    const hasChildren = node.children.length > 0;
    const nodeKey = `${node.tipo}-${node.id}`;
    const isExpanded = expandedIds.has(nodeKey);

    return (
      <div key={nodeKey}>
        <div
          className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-muted/50 transition-all"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggle(nodeKey)} className="shrink-0 p-0.5">
              {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
            <span className={`text-[9px] font-bold ${config.text}`}>{config.label}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{node.nome}</p>
            <p className="text-[10px] text-muted-foreground">{node.detalhes} · {node.status || '—'}</p>
          </div>
          {node.whatsapp && (
            <a href={`https://wa.me/55${node.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              className="p-1 text-emerald-500 shrink-0">
              <MessageCircle size={13} />
            </a>
          )}
          {hasChildren && (
            <span className="text-[9px] text-muted-foreground shrink-0">{node.children.length}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className={`border-l ${config.border}`} style={{ marginLeft: `${depth * 20 + 20}px` }}>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleCreateNewSuplente = async () => {
    if (!newSupNome.trim()) { toast({ title: 'Informe o nome do suplente', variant: 'destructive' }); return; }
    setSavingNewSup(true);
    try {
      const { error } = await (supabase as any).from('suplentes').insert({
        nome: newSupNome.trim(),
        partido: newSupPartido.trim() || null,
        regiao_atuacao: newSupRegiao.trim() || null,
        telefone: newSupTelefone.trim() || null,
      });
      if (error) throw new Error(error.message);
      toast({ title: '✅ Suplente criado!', description: `${newSupNome.trim()} adicionado com sucesso` });
      setCreatingNewSuplente(false);
      setNewSupNome(''); setNewSupPartido(''); setNewSupRegiao(''); setNewSupTelefone('');
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSavingNewSup(false); }
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  // CREATE NEW SUPLENTE VIEW
  if (creatingNewSuplente) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setCreatingNewSuplente(false)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Novo Suplente</h2>
              <p className="text-xs text-muted-foreground">Cadastrar suplente local</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <input type="text" value={newSupNome} onChange={e => setNewSupNome(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Partido</label>
              <input type="text" value={newSupPartido} onChange={e => setNewSupPartido(e.target.value)} className={inputCls} placeholder="Ex: PL, MDB..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Região de atuação</label>
              <input type="text" value={newSupRegiao} onChange={e => setNewSupRegiao(e.target.value)} className={inputCls} placeholder="Ex: Aparecida de Goiânia" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <input type="text" value={newSupTelefone} onChange={e => setNewSupTelefone(e.target.value)} className={inputCls} placeholder="(62) 99999-9999" />
            </div>
            <button
              onClick={handleCreateNewSuplente}
              disabled={savingNewSup}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {savingNewSup ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {savingNewSup ? 'Criando...' : 'Criar Suplente'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // EDIT USER VIEW
  if (editingUser) {
    const { hierarquiaUser, suplente } = editingUser;
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setEditingUser(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Pencil size={24} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Editar Usuário</h2>
              <p className="text-xs text-muted-foreground">Suplente: {suplente.nome}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <KeyRound size={12} /> Nova senha (deixe vazio para manter)
              </label>
              <div className="relative">
                <input
                  type={showEditSenha ? 'text' : 'password'}
                  value={editSenha}
                  onChange={e => setEditSenha(e.target.value)}
                  className={inputCls}
                  placeholder="Nova senha (opcional)"
                />
                <button onClick={() => setShowEditSenha(!showEditSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showEditSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleEditUser}
              disabled={editSaving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {editSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {editSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Delete section */}
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
              <p className="text-xs text-muted-foreground">Tem certeza? Esta ação remove o acesso do usuário ao sistema.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteUser}
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

  // CREATE ACCESS VIEW
  if (creatingAccess) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setCreatingAccess(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Criar Acesso</h2>
              <p className="text-xs text-muted-foreground">Suplente: {creatingAccess.nome}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome de acesso</label>
              <input type="text" value={accessNome} onChange={e => setAccessNome(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={accessSenha}
                  onChange={e => setAccessSenha(e.target.value)}
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
              onClick={handleCreateAccess}
              disabled={saving}
              className="w-full h-12 gradient-primary text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {saving ? 'Criando...' : 'Criar Acesso'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW - tree
  if (selected) {
    const temAcesso = suplentesComUsuario.has(selected.id);
    return (
      <div className="space-y-3 pb-24">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{selected.nome}</h2>
              <p className="text-xs text-muted-foreground">
                {selected.partido || '—'} · {selected.regiao_atuacao || '—'} · {selected.situacao || '—'}
              </p>
            </div>
            {temAcesso ? (
              <button
                onClick={() => openEditUser(selected)}
                className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-1 rounded-full active:scale-95"
              >
                <Pencil size={12} /> Editar
              </button>
            ) : (
              <button
                onClick={() => openCreateAccess(selected)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg active:scale-95"
              >
                <UserPlus size={14} /> Criar Acesso
              </button>
            )}
          </div>
          {selected.telefone && (
            <div className="flex gap-2 pt-2">
              <a href={`tel:${selected.telefone}`} className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-xs font-medium">
                <Phone size={14} /> Ligar
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Lideranças', value: stats.liderancas, color: 'text-blue-500' },
            { label: 'Eleitores', value: stats.eleitores, color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {loadingTree ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : tree.length === 0 ? (
          <div className="section-card text-center py-6">
            <p className="text-sm text-muted-foreground">Nenhum cadastro vinculado</p>
          </div>
        ) : (
          <div className="section-card !p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1">
              Lideranças → Eleitores
            </p>
            {tree.map(node => renderTreeNode(node, 0))}
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-3 pb-24">
      {isAdmin && (
        <button
          onClick={() => setCreatingNewSuplente(true)}
          className="w-full h-11 flex items-center justify-center gap-2 bg-primary/10 text-primary text-sm font-semibold rounded-xl border border-primary/20 active:scale-[0.97] transition-all"
        >
          <Plus size={16} /> Novo Suplente
        </button>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar suplente..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl border border-border p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{suplentes.length}</p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-500">{suplentes.filter(s => suplentesComUsuario.has(s.id)).length}</p>
          <p className="text-[9px] text-muted-foreground">Com acesso</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-2.5 text-center">
          <p className="text-lg font-bold text-amber-500">{suplentes.filter(s => !suplentesComUsuario.has(s.id)).length}</p>
          <p className="text-[9px] text-muted-foreground">Sem acesso</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} suplente{filtered.length !== 1 ? 's' : ''}</p>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="section-card animate-pulse"><div className="h-4 bg-muted rounded w-2/3" /><div className="h-3 bg-muted rounded w-1/2 mt-2" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhum suplente encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const temAcesso = suplentesComUsuario.has(s.id);
            return (
              <div key={s.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                <button onClick={() => openDetail(s)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    temAcesso ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  }`}>
                    {temAcesso ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Users size={18} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground text-sm truncate block">{s.nome}</span>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.partido || '—'} · {s.regiao_atuacao || '—'}
                    </p>
                  </div>
                </button>
                {temAcesso ? (
                  <button
                    onClick={() => openEditUser(s)}
                    className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold rounded-lg active:scale-95 shrink-0"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                ) : (
                  <button
                    onClick={() => openCreateAccess(s)}
                    className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg active:scale-95 shrink-0"
                  >
                    Criar
                  </button>
                )}
                <button onClick={() => openDetail(s)} className="shrink-0">
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
