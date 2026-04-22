import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link2, Copy, Share2, Users, Phone, Loader2 } from 'lucide-react';

interface CadastroItem {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  criado_em: string;
}

/**
 * Card reutilizável que mostra o link público de captação do usuário logado.
 * Funciona para qualquer tipo (suplente, liderança, coordenador, fernanda etc.).
 * Os cadastros recebidos via link são salvos em `cadastros_afiliados` vinculados
 * ao próprio usuário via `afiliado_id` (a coluna serve apenas como FK para
 * `hierarquia_usuarios.id`, sem restringir o tipo).
 */
export default function LinkCaptacaoCard() {
  const { usuario } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<CadastroItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Garantir token (gera se não tiver)
  useEffect(() => {
    if (!usuario?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('hierarquia_usuarios')
        .select('link_token')
        .eq('id', usuario.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.link_token) {
        setLinkToken(data.link_token);
        return;
      }
      const novoToken = (crypto as any)?.randomUUID
        ? (crypto as any).randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const { error } = await (supabase as any)
        .from('hierarquia_usuarios')
        .update({ link_token: novoToken })
        .eq('id', usuario.id);
      if (!cancelled && !error) setLinkToken(novoToken);
    })();
    return () => { cancelled = true; };
  }, [usuario?.id]);

  const carregarCadastros = useCallback(async () => {
    if (!usuario?.id) return;
    setLoading(true);
    const { data, count } = await (supabase as any)
      .from('cadastros_afiliados')
      .select('id, nome, telefone, origem, criado_em', { count: 'exact' })
      .eq('afiliado_id', usuario.id)
      .order('criado_em', { ascending: false })
      .limit(5);
    setRecentes((data as CadastroItem[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [usuario?.id]);

  useEffect(() => { carregarCadastros(); }, [carregarCadastros]);

  // Realtime: novos cadastros via link aparecem automaticamente
  useEffect(() => {
    if (!usuario?.id) return;
    const channel = supabase
      .channel(`linkcap-${usuario.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cadastros_afiliados', filter: `afiliado_id=eq.${usuario.id}` },
        () => carregarCadastros()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [usuario?.id, carregarCadastros]);

  const slugNome = useMemo(() => {
    const n = (usuario?.nome || '').toString().trim().toLowerCase();
    return n
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
      .slice(0, 40) || 'cadastro';
  }, [usuario?.nome]);

  const linkPublico = useMemo(
    () => linkToken ? `${window.location.origin}/c/${slugNome}/${linkToken}` : null,
    [linkToken, slugNome]
  );

  const copiar = async () => {
    if (!linkPublico) return;
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast({ title: '✅ Link copiado!', description: 'Cole no WhatsApp ou redes sociais' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const compartilhar = async () => {
    if (!linkPublico) return;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Cadastre-se', text: 'Faça seu cadastro:', url: linkPublico });
      } catch {}
    } else {
      copiar();
    }
  };

  if (!usuario?.id) return null;

  return (
    <div className="space-y-3">
      <div className="section-card space-y-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-primary" />
            <p className="text-[11px] font-semibold text-foreground">Seu link personalizado</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
            <Users size={10} /> {total}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Envie para captar cadastros vinculados a <strong>{usuario.nome}</strong>
        </p>
        {linkPublico ? (
          <p className="text-[10px] text-foreground break-all bg-muted/40 rounded-lg p-2 font-mono">
            {linkPublico}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-2">
            <Loader2 size={12} className="animate-spin" /> Gerando seu link…
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={copiar}
            disabled={!linkPublico}
            className="flex-1 h-9 rounded-lg bg-card border border-border text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <Copy size={12} /> Copiar
          </button>
          <button
            onClick={compartilhar}
            disabled={!linkPublico}
            className="flex-1 h-9 rounded-lg gradient-primary text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <Share2 size={12} /> Compartilhar
          </button>
        </div>
      </div>

      <div className="section-card space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Últimos cadastros</p>
          <span className="text-[10px] text-muted-foreground">{total} no total</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
            <Loader2 size={12} className="animate-spin" /> Carregando…
          </div>
        ) : recentes.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-2">
            Ainda não há cadastros. Compartilhe seu link para começar.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentes.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Phone size={10} /> {c.telefone}
                    <span className="mx-1">·</span>
                    {c.origem === 'link_publico' ? '🔗 link' : '✍️ manual'}
                    <span className="mx-1">·</span>
                    {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}