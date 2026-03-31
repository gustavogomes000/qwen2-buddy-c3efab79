import { useState, useEffect } from 'react';
import { useAuth, TipoUsuario } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Shield, User, UserPlus, Loader2, Crown, Users, Eye, Copy, X, Pencil, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const tipoLabels: Record<TipoUsuario, string> = {
  super_admin: 'Super Admin',
  coordenador: 'Coordenador',
  suplente: 'Suplente',
  lideranca: 'Liderança',
  fiscal: 'Fiscal',
};

const tipoIcons: Record<TipoUsuario, typeof Shield> = {
  super_admin: Crown,
  coordenador: Shield,
  suplente: User,
  lideranca: Users,
  fiscal: Eye,
};

interface SuplenteOption {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
}

interface UsuarioItem {
  id: string;
  nome: string;
  tipo: string;
  criado_em: string;
  suplente_id: string | null;
  auth_user_id: string | null;
}

interface UsuarioModalInfo {
  usuario: UsuarioItem;
  senhaOriginal?: string;
}

function generateEmail(nome: string) {
  const slug = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}@rede.sarelli.com`;
}

function UsuarioModal({ info, onClose, onUpdated }: { info: UsuarioModalInfo; onClose: () => void; onUpdated: () => void }) {
  const [editNome, setEditNome] = useState(info.usuario.nome);
  const [editSenha, setEditSenha] = useState(info.senhaOriginal || '');
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const copiar = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    toast({ title: `${label} copiado!` });
  };

  const handleSalvar = async () => {
    if (!editNome.trim()) return;
    setSalvando(true);
    try {
      const body: any = { acao: 'atualizar', hierarquia_id: info.usuario.id, auth_user_id: info.usuario.auth_user_id };
      if (editNome.trim() !== info.usuario.nome) body.novo_nome = editNome.trim();
      if (editSenha.trim()) body.nova_senha = editSenha.trim();

      if (!body.novo_nome && !body.nova_senha) {
        toast({ title: 'Nenhuma alteração' });
        setSalvando(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Usuário atualizado!' });
      onUpdated();
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  const handleDeletar = async () => {
    setDeletando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: { acao: 'deletar', hierarquia_id: info.usuario.id, auth_user_id: info.usuario.auth_user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: '🗑️ Usuário removido!' });
      onUpdated();
      onClose();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    } finally { setDeletando(false); }
  };

  const inputCls = "w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">🔑 Credenciais</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Usuário (nome de login)</p>
            <div className="flex items-center gap-2">
              <input value={editNome} onChange={e => setEditNome(e.target.value)} className={inputCls} />
              <button onClick={() => copiar(editNome, 'Usuário')} className="text-primary shrink-0 p-1"><Copy size={14} /></button>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              {info.senhaOriginal ? 'Senha' : 'Nova senha (deixe vazio para manter)'}
            </p>
            <div className="flex items-center gap-2">
              <input
                value={editSenha}
                onChange={e => setEditSenha(e.target.value)}
                placeholder={info.senhaOriginal ? '' : 'Digite nova senha...'}
                className={inputCls}
              />
              {editSenha && (
                <button onClick={() => copiar(editSenha, 'Senha')} className="text-primary shrink-0 p-1"><Copy size={14} /></button>
              )}
            </div>
          </div>
        </div>

        {info.senhaOriginal && (
          <p className="text-[10px] text-muted-foreground text-center">
            Anote essas credenciais! A senha não poderá ser visualizada novamente.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSalvar}
            disabled={salvando || !editNome.trim()}
            className="flex-1 h-10 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
            Salvar
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="h-10 px-4 rounded-xl text-sm font-semibold border border-destructive/30 text-destructive active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <button
              onClick={handleDeletar}
              disabled={deletando}
              className="h-10 px-4 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              {deletando ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TabPerfil() {
  const { usuario, isAdmin, tipoUsuario, signOut } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [novoSenha, setNovoSenha] = useState('');
  const [criando, setCriando] = useState(false);
  const [suplentes, setSuplentes] = useState<SuplenteOption[]>([]);
  const [selectedSuplenteId, setSelectedSuplenteId] = useState('');
  const [modalInfo, setModalInfo] = useState<UsuarioModalInfo | null>(null);

  const fetchUsuarios = async () => {
    const { data } = await supabase.from('hierarquia_usuarios').select('id, nome, tipo, criado_em, suplente_id, auth_user_id').eq('ativo', true).order('criado_em', { ascending: false });
    if (data) setUsuarios(data as UsuarioItem[]);
    setLoaded(true);
  };

  const fetchSuplentes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('buscar-suplentes');
      if (!error && data) setSuplentes(data);
    } catch (err) {
      console.error('Erro ao buscar suplentes:', err);
    }
  };

  useEffect(() => {
    if (isAdmin && !loaded) {
      fetchUsuarios();
      fetchSuplentes();
    }
  }, [isAdmin]);

  const suplentesJaVinculados = new Set(usuarios.filter(u => u.suplente_id).map(u => u.suplente_id));
  const suplentesDisponiveis = suplentes.filter(s => !suplentesJaVinculados.has(s.id));
  const selectedSuplente = suplentes.find(s => s.id === selectedSuplenteId);

  const [modoLivre, setModoLivre] = useState(false);
  const [nomeLivre, setNomeLivre] = useState('');

  const handleCriar = async () => {
    if (modoLivre) {
      if (!nomeLivre.trim() || !novoSenha.trim()) return;
    } else {
      if (!selectedSuplenteId || !novoSenha.trim()) return;
      if (!selectedSuplente) return;
    }
    setCriando(true);
    try {
      const nomeUsuario = modoLivre ? nomeLivre.trim() : selectedSuplente!.nome.trim();
      const body: any = {
        nome: nomeUsuario,
        senha: novoSenha,
        tipo: modoLivre ? 'lideranca' : 'suplente',
        superior_id: usuario?.id,
      };
      if (!modoLivre) body.suplente_id = selectedSuplenteId;

      const { data, error } = await supabase.functions.invoke('criar-usuario', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const senha = novoSenha;
      setNovoSenha('');
      setSelectedSuplenteId('');
      setNomeLivre('');
      setShowForm(false);
      await fetchUsuarios();

      setModalInfo({
        usuario: { id: data.hierarquia_id, nome: nomeUsuario, tipo: modoLivre ? 'lideranca' : 'suplente', criado_em: new Date().toISOString(), suplente_id: modoLivre ? null : selectedSuplenteId, auth_user_id: data.auth_user_id },
        senhaOriginal: senha,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' });
    } finally { setCriando(false); }
  };

  const handleClickUsuario = (u: UsuarioItem) => {
    setModalInfo({ usuario: u });
  };

  const inputCls = "w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const IconComponent = tipoUsuario ? tipoIcons[tipoUsuario] : User;

  const getSuplenteNome = (suplente_id: string | null) => {
    if (!suplente_id) return null;
    return suplentes.find(s => s.id === suplente_id)?.nome || null;
  };

  return (
    <div className="space-y-4 pb-24">
      {modalInfo && <UsuarioModal info={modalInfo} onClose={() => setModalInfo(null)} onUpdated={fetchUsuarios} />}

      <div className="section-card flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
          <IconComponent size={28} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-foreground mt-3">{usuario?.nome || '—'}</h2>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider mt-1">
          {tipoUsuario ? tipoLabels[tipoUsuario] : '—'}
        </span>
      </div>

      {isAdmin && (
        <div className="section-card">
          <div className="flex items-center justify-between">
            <h2 className="section-title">🔑 Usuários do Sistema</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all"
            >
              <UserPlus size={14} />
              Novo
            </button>
          </div>

          {showForm && (
            <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setModoLivre(false)} className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${!modoLivre ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}>
                  Da Rede (Suplente)
                </button>
                <button onClick={() => setModoLivre(true)} className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${modoLivre ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}>
                  Livre (Nome + Senha)
                </button>
              </div>

              {modoLivre ? (
                <>
                  <p className="text-[10px] text-muted-foreground">Crie um usuário com nome e senha, sem vínculo a suplente.</p>
                  <input type="text" value={nomeLivre} onChange={e => setNomeLivre(e.target.value)} placeholder="Nome do usuário" className={inputCls} />
                </>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground">Selecione o suplente já cadastrado e defina uma senha.</p>
                  <select value={selectedSuplenteId} onChange={e => setSelectedSuplenteId(e.target.value)} className={selectCls}>
                    <option value="">Selecione o suplente...</option>
                    {suplentesDisponiveis.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.nome}{s.regiao_atuacao ? ` — ${s.regiao_atuacao}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedSuplente && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                      <p className="text-xs font-semibold text-primary">{selectedSuplente.nome}</p>
                      {selectedSuplente.regiao_atuacao && <p className="text-[10px] text-muted-foreground">{selectedSuplente.regiao_atuacao}</p>}
                    </div>
                  )}
                </>
              )}

              <input type="text" value={novoSenha} onChange={e => setNovoSenha(e.target.value)} placeholder="Senha de acesso" className={inputCls} />

              <button
                onClick={handleCriar}
                disabled={criando || (!modoLivre && !selectedSuplenteId) || (modoLivre && !nomeLivre.trim()) || !novoSenha.trim()}
                className="w-full h-10 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 active:scale-[0.97] transition-all flex items-center justify-center gap-2"
              >
                {criando ? <><Loader2 size={14} className="animate-spin" /> Criando...</> : 'Criar Acesso'}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {usuarios.map(u => (
              <div
                key={u.id}
                onClick={() => handleClickUsuario(u)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/30 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{u.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{u.nome}</p>
                    {(u.tipo === 'super_admin' || u.tipo === 'coordenador') && <Shield size={12} className="text-primary shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {tipoLabels[u.tipo as TipoUsuario] || u.tipo}
                    {getSuplenteNome(u.suplente_id) ? ` · ${getSuplenteNome(u.suplente_id)}` : ''}
                    {' · Desde '}
                    {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={signOut}
        className="w-full h-12 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97] transition-all">
        <LogOut size={18} /> Sair
      </button>

      <p className="text-center text-[10px] text-muted-foreground">v2.0 · Rede Política – Dra. Fernanda Sarelli</p>
    </div>
  );
}
