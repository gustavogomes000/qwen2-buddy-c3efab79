import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, ChevronRight, ArrowLeft, Loader2, Phone,
  MapPin, User, Trash2, XCircle, Pencil, Calendar as CalendarIcon, Link2, Copy, Share2, AtSign, Cake
} from 'lucide-react';
import SkeletonLista from '@/components/SkeletonLista';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CadastroAfil {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string | null;
  cep: string | null;
  rede_social: string | null;
  origem: string;
  afiliado_id: string;
  criado_em: string;
}

interface FormState {
  id?: string;
  nome: string;
  telefone: string;
  data_nascimento: string;
  cep: string;
  rede_social: string;
}

const EMPTY: FormState = { nome: '', telefone: '', data_nascimento: '', cep: '', rede_social: '' };

const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block';

export default function TabCadastrosAfiliado() {
  const { usuario, isAdmin } = useAuth();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [cadastros, setCadastros] = useState<CadastroAfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<CadastroAfil | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'data'>('hoje');
  const [intervalo, setIntervalo] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cadastros_afiliados' as any)
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setCadastros((data || []) as unknown as CadastroAfil[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Buscar token do afiliado logado
  useEffect(() => {
    if (!usuario?.id) return;
    (supabase as any).from('hierarquia_usuarios')
      .select('link_token')
      .eq('id', usuario.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.link_token) setLinkToken(data.link_token);
      });
  }, [usuario?.id]);

  useEffect(() => {
    const channel = supabase
      .channel('cadastros_afiliados_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_afiliados' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const slugNome = useMemo(() => {
    const n = (usuario?.nome || '').toString().trim().toLowerCase();
    return n
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
      .slice(0, 40) || 'afiliado';
  }, [usuario?.nome]);

  const linkPublico = useMemo(
    () => linkToken ? `${window.location.origin}/c/${slugNome}/${linkToken}` : null,
    [linkToken, slugNome]
  );

  const copiarLink = async () => {
    if (!linkPublico) return;
    try {
      await navigator.clipboard.writeText(linkPublico);
      toast({ title: '✅ Link copiado!', description: 'Cole no WhatsApp ou redes sociais' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const compartilharLink = async () => {
    if (!linkPublico) return;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Cadastre-se',
          text: 'Faça seu cadastro:',
          url: linkPublico,
        });
      } catch {}
    } else {
      copiarLink();
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let base = cadastros;

    if (periodo === 'data' && (intervalo?.from || intervalo?.to)) {
      const start = intervalo.from ?? intervalo.to!;
      const end = intervalo.to ?? intervalo.from!;
      const inicioDia = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const fimDia = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      fimDia.setDate(fimDia.getDate() + 1);
      base = base.filter(c => {
        const d = new Date(c.criado_em);
        return d >= inicioDia && d < fimDia;
      });
    } else if (periodo !== 'todos' && periodo !== 'data') {
      const agora = new Date();
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      let from = inicio;
      let to: Date | null = null;
      if (periodo === 'ontem') {
        from = new Date(inicio); from.setDate(from.getDate() - 1);
        to = inicio;
      } else if (periodo === 'semana') {
        from = new Date(inicio); from.setDate(from.getDate() - 7);
      } else if (periodo === 'mes') {
        from = new Date(inicio); from.setDate(from.getDate() - 30);
      }
      const fromTs = from.getTime();
      const toTs = to ? to.getTime() : null;
      base = base.filter(c => {
        const t = Date.parse(c.criado_em);
        if (t < fromTs) return false;
        if (toTs !== null && t >= toTs) return false;
        return true;
      });
    }

    if (!q) return base;
    return base.filter(c =>
      c.nome.toLowerCase().includes(q)
      || c.telefone.toLowerCase().includes(q)
      || (c.cep || '').toLowerCase().includes(q)
      || (c.rede_social || '').toLowerCase().includes(q)
    );
  }, [cadastros, busca, periodo, intervalo]);

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!form.telefone.trim()) { toast({ title: 'Informe o telefone', variant: 'destructive' }); return; }
    if (!usuario?.id) { toast({ title: 'Sessão inválida', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      data_nascimento: form.data_nascimento || null,
      cep: form.cep.trim() || null,
      rede_social: form.rede_social.trim() || null,
      afiliado_id: usuario.id,
      origem: 'manual',
    };
    if (form.id) {
      const { data, error } = await supabase.from('cadastros_afiliados' as any).update(payload).eq('id', form.id).select().single();
      setSaving(false);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      setCadastros(prev => prev.map(c => c.id === form.id ? (data as unknown as CadastroAfil) : c));
      toast({ title: '✅ Cadastro atualizado' });
    } else {
      const { data, error } = await supabase.from('cadastros_afiliados' as any).insert(payload).select().single();
      setSaving(false);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      setCadastros(prev => [(data as unknown as CadastroAfil), ...prev]);
      toast({ title: '✅ Cadastro salvo' });
    }
    setForm(EMPTY);
    setMode('list');
  };

  const abrirNovo = () => { setForm(EMPTY); setMode('form'); };
  const abrirEditar = (c: CadastroAfil) => {
    setForm({
      id: c.id, nome: c.nome, telefone: c.telefone,
      data_nascimento: c.data_nascimento ?? '', cep: c.cep ?? '', rede_social: c.rede_social ?? '',
    });
    setMode('form');
  };
  const abrirDetalhe = (c: CadastroAfil) => { setSelected(c); setConfirmDelete(false); setMode('detail'); };

  const handleExcluir = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('cadastros_afiliados' as any).delete().eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '🗑️ Cadastro excluído' });
    setSelected(null);
    setConfirmDelete(false);
    setMode('list');
    carregar();
  };

  // ─── FORM VIEW ───
  if (mode === 'form') {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMode('list'); setForm(EMPTY); }}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95"
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-bold text-foreground">
            {form.id ? 'Editar cadastro' : 'Novo cadastro'}
          </h2>
        </div>

        <div className="section-card space-y-3">
          <div>
            <label className={labelCls}>Nome *</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefone *</label>
            <input type="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Data de nascimento</label>
            <input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CEP</label>
            <input type="text" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Rede social</label>
            <input type="text" value={form.rede_social} onChange={(e) => setForm({ ...form, rede_social: e.target.value })} placeholder="@usuario / link" className={inputCls} />
          </div>
        </div>

        <button
          onClick={handleSalvar}
          disabled={saving}
          className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {form.id ? 'Salvar alterações' : 'Cadastrar'}
        </button>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (mode === 'detail' && selected) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <button onClick={() => { setMode('list'); setSelected(null); }} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95" aria-label="Voltar">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-bold text-foreground truncate flex-1">{selected.nome}</h2>
          <button onClick={() => abrirEditar(selected)} className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95" aria-label="Editar">
            <Pencil size={14} />
          </button>
        </div>

        <div className="section-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{selected.nome}</p>
              <p className="text-[11px] text-muted-foreground">
                {selected.origem === 'link_publico' ? '🔗 Via link público · ' : '✍️ Manual · '}
                {new Date(selected.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2.5 py-1.5">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">{selected.telefone}</span>
            </div>
            {selected.data_nascimento && (
              <div className="flex items-center gap-2.5 py-1.5">
                <Cake size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{new Date(selected.data_nascimento + 'T00:00').toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {selected.cep && (
              <div className="flex items-center gap-2.5 py-1.5">
                <MapPin size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">CEP {selected.cep}</span>
              </div>
            )}
            {selected.rede_social && (
              <div className="flex items-center gap-2.5 py-1.5">
                <AtSign size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{selected.rede_social}</span>
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="section-card">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="w-full h-10 border border-destructive/30 text-destructive text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]">
                <Trash2 size={16} /> Excluir cadastro
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tem certeza? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl">Cancelar</button>
                  <button onClick={handleExcluir} disabled={saving} className="flex-1 h-10 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-3 pb-24">
      {/* Link personalizado do afiliado */}
      {linkPublico && (
        <div className="section-card space-y-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-primary" />
            <p className="text-[11px] font-semibold text-foreground">
              Seu link personalizado
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-1">
            Envie para captar cadastros vinculados a <strong>{usuario?.nome}</strong>
          </p>
          <p className="text-[10px] text-foreground break-all bg-muted/40 rounded-lg p-2 font-mono">
            {linkPublico}
          </p>
          <div className="flex gap-2">
            <button onClick={copiarLink} className="flex-1 h-9 rounded-lg bg-card border border-border text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95">
              <Copy size={12} /> Copiar
            </button>
            <button onClick={compartilharLink} className="flex-1 h-9 rounded-lg gradient-primary text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95">
              <Share2 size={12} /> Compartilhar
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone, CEP..."
          className="w-full h-11 pl-9 pr-9 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground active:scale-90">
            <XCircle size={14} />
          </button>
        )}
      </div>

      {/* Novo */}
      <button onClick={abrirNovo} className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97]">
        <Plus size={16} /> Novo cadastro
      </button>

      {/* Filtro por período */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-hide">
        {([
          { v: 'hoje', l: 'Hoje' },
          { v: 'ontem', l: 'Ontem' },
          { v: 'semana', l: '7 dias' },
          { v: 'mes', l: '30 dias' },
          { v: 'todos', l: 'Todos' },
        ] as const).map(opt => (
          <button
            key={opt.v}
            onClick={() => { setPeriodo(opt.v); setIntervalo(undefined); }}
            className={cn(
              'shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95',
              periodo === opt.v ? 'gradient-primary text-white shadow-sm' : 'bg-card border border-border text-muted-foreground'
            )}
          >
            {opt.l}
          </button>
        ))}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1',
                periodo === 'data' ? 'gradient-primary text-white shadow-sm' : 'bg-card border border-border text-muted-foreground'
              )}
            >
              <CalendarIcon size={11} />
              {periodo === 'data' && intervalo?.from
                ? intervalo.to && intervalo.to.getTime() !== intervalo.from.getTime()
                  ? `${format(intervalo.from, 'dd/MM', { locale: ptBR })} – ${format(intervalo.to, 'dd/MM', { locale: ptBR })}`
                  : format(intervalo.from, 'dd/MM/yy', { locale: ptBR })
                : 'Escolher datas'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-2 pb-0 text-[11px] text-muted-foreground text-center">
              Toque no dia inicial e depois no dia final
            </div>
            <Calendar
              mode="range"
              selected={intervalo as any}
              onSelect={(range: any) => {
                setIntervalo(range);
                if (range?.from) setPeriodo('data');
              }}
              numberOfMonths={1}
              initialFocus
              locale={ptBR}
              modifiersClassNames={{ today: '' }}
              classNames={{ day_today: '' }}
              className={cn('p-3 pointer-events-auto')}
            />
            <div className="p-2 pt-0 flex gap-2">
              <button onClick={() => { setIntervalo(undefined); setPeriodo('hoje'); setDatePickerOpen(false); }} className="flex-1 h-8 rounded-lg bg-muted text-[11px] font-semibold">
                Limpar
              </button>
              <button onClick={() => setDatePickerOpen(false)} className="flex-1 h-8 rounded-lg gradient-primary text-white text-[11px] font-semibold">
                Aplicar
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <p className="text-xs text-muted-foreground">
        {loading ? 'Carregando...' : `${filtrados.length} cadastro${filtrados.length !== 1 ? 's' : ''}`}
      </p>

      {loading && cadastros.length === 0 ? (
        <SkeletonLista />
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {busca ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro ainda. Toque em "Novo cadastro" ou compartilhe seu link.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtrados.map(c => (
            <button key={c.id} onClick={() => abrirDetalhe(c)} className="w-full section-card !py-3 !px-3.5 text-left active:scale-[0.99] transition-transform">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={17} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    {c.origem === 'link_publico' && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">🔗 LINK</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Phone size={9} /> {c.telefone}
                    </span>
                    {c.cep && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MapPin size={9} /> {c.cep}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 mt-1">
                    <CalendarIcon size={9} /> {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}