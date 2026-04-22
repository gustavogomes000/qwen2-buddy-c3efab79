import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link2, Copy, Share2, Users, Phone, Loader2, Sparkles, Crown, Shield, UserPlus } from 'lucide-react';

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
  const isSuplente = usuario?.tipo === 'suplente';
  const variantes = useMemo(() => (
    isSuplente
      ? [
          { key: 'lideranca', label: 'Lideranças', icon: Crown, hint: 'Para captar lideranças' },
          { key: 'fiscal',    label: 'Fiscais',    icon: Shield, hint: 'Para captar fiscais' },
          { key: 'eleitor',   label: 'Eleitores',  icon: UserPlus, hint: 'Para captar eleitores' },
        ] as const
      : [
          { key: 'geral', label: 'Cadastro', icon: UserPlus, hint: 'Link único de cadastro' },
        ] as const
  ), [isSuplente]);
  const [variante, setVariante] = useState<string>(variantes[0].key);
  useEffect(() => { setVariante(variantes[0].key); }, [variantes]);

  // Garantir token (gera se não tiver)
  useEffect(() => {
    if (!usuario?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error: selErr } = await (supabase as any)
        .from('hierarquia_usuarios')
        .select('link_token')
        .eq('id', usuario.id)
        .maybeSingle();
      if (selErr) console.warn('[LinkCaptacao] select err', selErr);
      if (cancelled) return;
      if (data?.link_token) {
        setLinkToken(data.link_token);
        return;
      }
      const novoToken = (crypto as any)?.randomUUID
        ? (crypto as any).randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const { error, data: updData } = await (supabase as any)
        .from('hierarquia_usuarios')
        .update({ link_token: novoToken })
        .eq('id', usuario.id)
        .select('link_token')
        .maybeSingle();
      if (error) console.warn('[LinkCaptacao] update err', error);
      if (!cancelled) {
        if (!error) setLinkToken(updData?.link_token || novoToken);
        else setLinkToken(novoToken); // fallback: mostra mesmo assim para o usuário copiar
      }
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
    () => {
      if (!linkToken) return null;
      const base = `${window.location.origin}/c/${slugNome}/${linkToken}`;
      return variante && variante !== 'geral' ? `${base}?tipo=${variante}` : base;
    },
    [linkToken, slugNome, variante]
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

  const varianteAtual = variantes.find(v => v.key === variante) || variantes[0];

  return (
    <div className="space-y-3">
      {/* Hero card do link */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 shadow-lg shadow-primary/10 bg-gradient-to-br from-primary/10 via-card to-card">
        <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative p-4 space-y-3">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary/30">
                <Link2 size={16} className="text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary flex items-center gap-1">
                  <Sparkles size={10} /> Seu link de captação
                </p>
                <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">{usuario.nome}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full gradient-primary text-white text-[11px] font-bold shadow-sm">
              <Users size={11} /> {total}
            </span>
          </div>

          {/* Seletor de variantes (apenas suplente) */}
          {variantes.length > 1 && (
            <div className="grid grid-cols-3 gap-1.5">
              {variantes.map(v => {
                const Icon = v.icon;
                const ativo = v.key === variante;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setVariante(v.key)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
                      ativo
                        ? 'gradient-primary text-white shadow-md shadow-primary/30'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon size={14} />
                    {v.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hint */}
          <p className="text-[10px] text-muted-foreground text-center">
            {varianteAtual.hint} — vinculado a você
          </p>

          {/* URL */}
          {linkPublico ? (
            <div className="rounded-xl bg-background/80 backdrop-blur border border-border px-3 py-2.5">
              <p className="text-[11px] text-foreground break-all font-mono leading-relaxed select-all">
                {linkPublico}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-3 rounded-xl bg-background/60 border border-border">
              <Loader2 size={12} className="animate-spin" /> Gerando seu link…
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2">
            <button
              onClick={copiar}
              disabled={!linkPublico}
              className="flex-1 h-10 rounded-xl bg-card border border-border text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 hover:border-primary/40 transition-colors"
            >
              <Copy size={13} /> Copiar
            </button>
            <button
              onClick={compartilhar}
              disabled={!linkPublico}
              className="flex-1 h-10 rounded-xl gradient-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-md shadow-primary/30"
            >
              <Share2 size={13} /> Compartilhar
            </button>
          </div>
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