import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Link2, Copy, Plus, UserCheck, Clock, Trash2, ExternalLink, UserPlus, X, MapPin, KeyRound, Eye, EyeOff } from 'lucide-react';

interface AfiliadoItem {
  id: string;
  nome: string;
  ativo: boolean | null;
  auth_user_id: string | null;
  link_token: string | null;
  criado_em: string | null;
}

function gerarToken() {
  // 24 chars hex
  return (crypto as any).randomUUID().replace(/-/g, '').slice(0, 24);
}

export default function SecaoAfiliados() {
  const { usuario, isAdmin } = useAuth();
  const [items, setItems] = useState<AfiliadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [logins, setLogins] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [mNome, setMNome] = useState('');
  const [mWhats, setMWhats] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mCpf, setMCpf] = useState('');
  const [mNasc, setMNasc] = useState('');
  const [mCep, setMCep] = useState('');
  const [mCidadeCep, setMCidadeCep] = useState('');
  const [mUfCep, setMUfCep] = useState('');
  const [mBuscandoCep, setMBuscandoCep] = useState(false);
  const [mInsta, setMInsta] = useState('');
  const [mTitulo, setMTitulo] = useState('');
  const [mZona, setMZona] = useState('');
  const [mSecao, setMSecao] = useState('');
  const [mMunicipio, setMMunicipio] = useState('');
  const [mUf, setMUf] = useState('GO');
  const [mColegio, setMColegio] = useState('');
  const [mLogin, setMLogin] = useState('');
  const [mSenha, setMSenha] = useState('');
  // Reset de senha por afiliado
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetSenha, setResetSenha] = useState('');
  const [resetShow, setResetShow] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  const resetarSenhaAfiliado = async (item: AfiliadoItem) => {
    if (!resetSenha || resetSenha.length < 6) {
      toast({ title: 'Senha precisa ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setResetSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: {
          acao: 'atualizar',
          hierarquia_id: item.id,
          auth_user_id: item.auth_user_id,
          nova_senha: resetSenha,
        },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: '🔑 Senha redefinida', description: `Nova senha aplicada a ${item.nome}` });
      setResetId(null); setResetSenha(''); setResetShow(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setResetSaving(false);
    }
  };

  const buscarCidadeCep = async (raw: string) => {
    const cepLimpo = raw.replace(/\D/g, '');
    if (cepLimpo.length !== 8) { setMCidadeCep(''); setMUfCep(''); return; }
    setMBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d?.erro) { setMCidadeCep(''); setMUfCep(''); }
      else { setMCidadeCep(d.localidade || ''); setMUfCep(d.uf || ''); }
    } catch { setMCidadeCep(''); setMUfCep(''); }
    finally { setMBuscandoCep(false); }
  };

  const fetchAfiliados = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('hierarquia_usuarios')
        .select('id, nome, ativo, auth_user_id, link_token, criado_em')
        .eq('tipo', 'afiliado')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      setItems((data || []) as AfiliadoItem[]);
    } catch (err: any) {
      console.error('Erro afiliados:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAfiliados();
  }, [isAdmin, fetchAfiliados]);

  // Carrega login (email) dos afiliados ativos
  useEffect(() => {
    const ativos = items.filter(i => i.auth_user_id && !logins[i.id]);
    if (ativos.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(ativos.map(async (it) => {
        try {
          const { data } = await supabase.functions.invoke('gerenciar-usuario', {
            body: { acao: 'obter_login', auth_user_id: it.auth_user_id },
          });
          const d: any = data;
          if (d?.login) updates[it.id] = d.login;
        } catch {}
      }));
      if (!cancelled && Object.keys(updates).length) {
        setLogins(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [items, logins]);

  const linkPara = (token: string | null) =>
    token ? `${window.location.origin}/cadastro/${token}` : '';

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: '🔗 Link copiado!' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const criarAfiliado = async () => {
    setCreating(true);
    try {
      const token = gerarToken();
      const nomeProvisorio = `Afiliado ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const { data, error } = await (supabase as any)
        .from('hierarquia_usuarios')
        .insert({
          nome: nomeProvisorio,
          tipo: 'afiliado',
          ativo: false, // só ativa quando o link for usado
          link_token: token,
          superior_id: usuario?.id || null,
          municipio_id: usuario?.municipio_id || null,
        })
        .select('id, link_token')
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/cadastro/${data.link_token}`;
      try { await navigator.clipboard.writeText(url); } catch {}
      toast({ title: '✅ Link de afiliado criado!', description: 'Copiado para a área de transferência.' });
      fetchAfiliados();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const removerAfiliado = async (item: AfiliadoItem) => {
    if (!confirm(`Remover o afiliado "${item.nome}"?`)) return;
    try {
      // Se já virou usuário, usa edge function pra apagar auth também
      if (item.auth_user_id) {
        const { error } = await supabase.functions.invoke('gerenciar-usuario', {
          body: { acao: 'deletar', hierarquia_id: item.id, auth_user_id: item.auth_user_id },
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabase as any).from('hierarquia_usuarios').delete().eq('id', item.id);
        if (error) throw error;
      }
      toast({ title: '🗑️ Afiliado removido' });
      fetchAfiliados();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const criarManual = async () => {
    if (!mNome.trim() || mNome.trim().length < 2) {
      toast({ title: 'Informe o nome', variant: 'destructive' }); return;
    }
    if (!mWhats.trim() || mWhats.replace(/\D/g,'').length < 6) {
      toast({ title: 'Informe um WhatsApp válido', variant: 'destructive' }); return;
    }
    if (!mTitulo.trim() || !mZona.trim() || !mSecao.trim() || !mMunicipio.trim() || !mColegio.trim()) {
      toast({ title: 'Preencha os dados eleitorais (Título, Zona, Seção, Município e Colégio)', variant: 'destructive' }); return;
    }
    if (!mLogin.trim() || mLogin.trim().length < 3) {
      toast({ title: 'Defina um nome de usuário (mín. 3 letras)', variant: 'destructive' }); return;
    }
    if (!mSenha || mSenha.length < 6) {
      toast({ title: 'Senha precisa ter no mínimo 6 caracteres', variant: 'destructive' }); return;
    }
    setSavingManual(true);
    try {
      // 1) Cria registro pendente com token (igual fluxo do link)
      const token = gerarToken();
      const { data: pend, error: insErr } = await (supabase as any)
        .from('hierarquia_usuarios')
        .insert({
          nome: mNome.trim(),
          tipo: 'afiliado',
          ativo: false,
          link_token: token,
          superior_id: usuario?.id || null,
          municipio_id: usuario?.municipio_id || null,
        })
        .select('link_token')
        .single();
      if (insErr) throw insErr;

      // 2) Chama a edge function para criar auth user + pessoa
      const { data, error } = await supabase.functions.invoke('cadastro-afiliado-publico', {
        body: {
          token: pend.link_token,
          nome: mNome.trim(),
          cpf: mCpf.trim() || null,
          telefone: mWhats.trim(),
          whatsapp: mWhats.trim(),
          email: mEmail.trim() || null,
          data_nascimento: mNasc || null,
          cep: mCep.trim() || null,
          cidade_cep: mCidadeCep || null,
          instagram: mInsta.trim() || null,
          titulo_eleitor: mTitulo.trim(),
          zona_eleitoral: mZona.trim(),
          secao_eleitoral: mSecao.trim(),
          municipio_eleitoral: mMunicipio.trim(),
          uf_eleitoral: mUf.trim() || 'GO',
          colegio_eleitoral: mColegio.trim(),
          usuario_login: mLogin.trim(),
          senha: mSenha,
        },
      });
      if (error) throw new Error(error.message);
      const d: any = data;
      if (d?.error) throw new Error(typeof d.error === 'string' ? d.error : 'Erro ao cadastrar');

      toast({ title: '✅ Afiliado cadastrado!', description: `Usuário: ${d?.login || mLogin.trim()}` });
      setShowManual(false);
      setMNome(''); setMWhats(''); setMEmail('');
      setMCpf(''); setMNasc(''); setMInsta('');
      setMCep(''); setMCidadeCep(''); setMUfCep('');
      setMTitulo(''); setMZona(''); setMSecao(''); setMMunicipio(''); setMUf('GO'); setMColegio('');
      setMLogin(''); setMSenha('');
      fetchAfiliados();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSavingManual(false);
    }
  };

  if (!isAdmin) return null;

  const pendentes = items.filter(i => !i.auth_user_id);
  const ativos = items.filter(i => !!i.auth_user_id);

  return (
    <div className="section-card">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="section-title flex items-center gap-1.5">
          <Link2 size={16} className="text-primary" /> Afiliados
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowManual(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all"
          >
            {showManual ? <X size={14} /> : <UserPlus size={14} />}
            {showManual ? 'Cancelar' : 'Cadastrar manual'}
          </button>
          <button
            onClick={criarAfiliado}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Gerar link
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        <b>Gerar link</b>: a pessoa preenche os dados e cria seu próprio usuário/senha. <b>Cadastrar manual</b>: você mesmo registra o afiliado (sem login no sistema).
      </p>

      {showManual && (
        <div className="mb-3 p-3 rounded-xl border border-border bg-muted/30 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Cadastro manual de afiliado</p>
          <input value={mNome} onChange={e => setMNome(e.target.value)} placeholder="Nome completo *" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
          <input value={mWhats} onChange={e => setMWhats(e.target.value)} placeholder="WhatsApp * (também usado como telefone)" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
          <input value={mEmail} onChange={e => setMEmail(e.target.value)} placeholder="E-mail" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={mCpf} onChange={e => setMCpf(e.target.value)} placeholder="CPF" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
            <input type="date" value={mNasc} onChange={e => setMNasc(e.target.value)} className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
          </div>
          <div>
            <div className="relative">
              <input
                value={mCep}
                onChange={e => setMCep(e.target.value)}
                onBlur={e => buscarCidadeCep(e.target.value)}
                placeholder="CEP"
                className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm"
              />
              {mBuscandoCep && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {mCidadeCep && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                <MapPin size={10} /> {mCidadeCep}{mUfCep ? ` - ${mUfCep}` : ''}
              </span>
            )}
          </div>
          <input value={mInsta} onChange={e => setMInsta(e.target.value)} placeholder="Instagram" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />

          <div className="pt-1 mt-1 border-t border-border">
            <p className="text-[11px] font-semibold text-foreground mb-2">🗳️ Dados eleitorais (obrigatórios)</p>
            <input value={mTitulo} onChange={e => setMTitulo(e.target.value)} placeholder="Título de eleitor *" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm mb-2" />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input value={mZona} onChange={e => setMZona(e.target.value)} placeholder="Zona *" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
              <input value={mSecao} onChange={e => setMSecao(e.target.value)} placeholder="Seção *" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input value={mMunicipio} onChange={e => setMMunicipio(e.target.value)} placeholder="Município *" className="col-span-2 w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
              <input value={mUf} onChange={e => setMUf(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
            </div>
            <input value={mColegio} onChange={e => setMColegio(e.target.value)} placeholder="Colégio eleitoral *" className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm" />
          </div>

          <div className="pt-1 mt-1 border-t border-border">
            <p className="text-[11px] font-semibold text-foreground mb-2">🔑 Acesso ao sistema</p>
            <input
              value={mLogin}
              onChange={e => setMLogin(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ''))}
              placeholder="Nome de usuário * (ex: maria.silva)"
              className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm mb-2"
            />
            <input
              type="password"
              value={mSenha}
              onChange={e => setMSenha(e.target.value)}
              placeholder="Senha * (mín. 6 caracteres)"
              className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm"
            />
          </div>
          <button
            onClick={criarManual}
            disabled={savingManual}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {savingManual ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Salvar afiliado
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-foreground">{items.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="bg-amber-500/5 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-amber-600">{pendentes.length}</p>
          <p className="text-[10px] text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-emerald-500/5 rounded-lg px-3 py-2 text-center">
          <p className="text-lg font-bold text-emerald-600">{ativos.length}</p>
          <p className="text-[10px] text-muted-foreground">Ativos</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-sm">
          <Loader2 size={16} className="animate-spin text-primary" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          Nenhum afiliado ainda. Clique em "Novo Afiliado" para gerar um link.
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const url = linkPara(item.link_token);
            const isPendente = !item.auth_user_id;
            return (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-border bg-card"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isPendente ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                  }`}>
                    {isPendente
                      ? <Clock size={16} className="text-amber-600" />
                      : <UserCheck size={16} className="text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold mt-0.5 ${
                      isPendente ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'
                    }`}>
                      {isPendente ? 'Aguardando cadastro' : 'Ativo no sistema'}
                    </span>
                    {!isPendente && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        <span className="font-semibold">Usuário:</span>{' '}
                        <span className="font-mono">{logins[item.id] || '…'}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isPendente && (
                      <button
                        onClick={() => {
                          setResetId(resetId === item.id ? null : item.id);
                          setResetSenha(''); setResetShow(false);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors active:scale-90"
                        title="Redefinir senha"
                      >
                        <KeyRound size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => removerAfiliado(item)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors active:scale-90"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {!isPendente && resetId === item.id && (
                  <div className="mt-2 p-2 rounded-lg border border-border bg-muted/30 space-y-2">
                    <p className="text-[11px] font-semibold text-foreground">Definir nova senha para {item.nome}</p>
                    <div className="relative">
                      <input
                        type={resetShow ? 'text' : 'password'}
                        value={resetSenha}
                        onChange={e => setResetSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full h-9 pl-3 pr-9 bg-card border border-border rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setResetShow(s => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                      >
                        {resetShow ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setResetId(null); setResetSenha(''); setResetShow(false); }}
                        className="flex-1 h-9 rounded-lg bg-card border border-border text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => resetarSenhaAfiliado(item)}
                        disabled={resetSaving || resetSenha.length < 6}
                        className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {resetSaving ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {isPendente && url && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex-1 h-9 px-2.5 bg-muted/50 border border-border rounded-lg flex items-center text-[11px] font-mono text-muted-foreground truncate">
                      {url}
                    </div>
                    <button
                      onClick={() => copiar(url)}
                      className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 active:scale-95"
                    >
                      <Copy size={12} /> Copiar
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground active:scale-95"
                      title="Abrir"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}