import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2, Link2, Copy, Plus, UserCheck, Clock, Trash2, ExternalLink, UserPlus, X } from 'lucide-react';

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
  const [creating, setCreating] = useState(false);

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

  if (!isAdmin) return null;

  const pendentes = items.filter(i => !i.auth_user_id);
  const ativos = items.filter(i => !!i.auth_user_id);

  return (
    <div className="section-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title flex items-center gap-1.5">
          <Link2 size={16} className="text-primary" /> Afiliados
        </h2>
        <button
          onClick={criarAfiliado}
          disabled={creating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Novo Afiliado
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Gere um link e envie para a pessoa. Ela mesma preenche os dados e define usuário e senha.
      </p>

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
                  </div>
                  <button
                    onClick={() => removerAfiliado(item)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors active:scale-90"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

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