import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, ChevronRight, ArrowLeft, Loader2, Phone, Instagram,
  MapPin, User, Trash2, XCircle, Pencil, Calendar as CalendarIcon
} from 'lucide-react';
import SkeletonLista from '@/components/SkeletonLista';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CadastroFernanda {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  instagram: string | null;
  cadastrado_por: string | null;
  criado_em: string;
}

interface FormState {
  id?: string;
  nome: string;
  telefone: string;
  cidade: string;
  instagram: string;
}

const EMPTY: FormState = { nome: '', telefone: '', cidade: '', instagram: '' };

const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block';

export default function TabCadastrosFernanda() {
  const { usuario, isAdmin } = useAuth();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [cadastros, setCadastros] = useState<CadastroFernanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<CadastroFernanda | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'data'>('hoje');
  const [dataEspecifica, setDataEspecifica] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cadastros_fernanda' as any)
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setCadastros((data || []) as unknown as CadastroFernanda[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const channel = supabase
      .channel('cadastros_fernanda_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_fernanda' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    let base = cadastros;

    if (periodo === 'data' && dataEspecifica) {
      const inicioDia = new Date(dataEspecifica.getFullYear(), dataEspecifica.getMonth(), dataEspecifica.getDate());
      const fimDia = new Date(inicioDia); fimDia.setDate(fimDia.getDate() + 1);
      base = base.filter(c => {
        const d = new Date(c.criado_em);
        return d >= inicioDia && d < fimDia;
      });
    } else if (periodo !== 'todos' && periodo !== 'data') {
      const agora = new Date();
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      let from = inicio;
      let to: Date | null = null;
      if (periodo === 'hoje') {
        // from = inicio do dia, sem limite superior (até agora)
      } else if (periodo === 'ontem') {
        from = new Date(inicio); from.setDate(from.getDate() - 1);
        to = inicio;
      } else if (periodo === 'semana') {
        from = new Date(inicio); from.setDate(from.getDate() - 7);
      } else if (periodo === 'mes') {
        from = new Date(inicio); from.setDate(from.getDate() - 30);
      }
      base = base.filter(c => {
        const d = new Date(c.criado_em);
        if (d < from) return false;
        if (to && d >= to) return false;
        return true;
      });
    }

    if (!q) return base;
    return base.filter(c =>
      c.nome.toLowerCase().includes(q)
      || c.telefone.toLowerCase().includes(q)
      || (c.cidade || '').toLowerCase().includes(q)
      || (c.instagram || '').toLowerCase().includes(q)
    );
  }, [cadastros, busca, periodo, dataEspecifica]);

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    if (!form.telefone.trim()) { toast({ title: 'Informe o telefone', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      cidade: form.cidade.trim() || null,
      instagram: form.instagram.trim() || null,
      cadastrado_por: usuario?.id ?? null,
    };
    if (form.id) {
      const { data, error } = await supabase.from('cadastros_fernanda' as any).update(payload).eq('id', form.id).select().single();
      setSaving(false);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      setCadastros(prev => prev.map(c => c.id === form.id ? (data as unknown as CadastroFernanda) : c));
      toast({ title: '✅ Cadastro atualizado' });
    } else {
      const { data, error } = await supabase.from('cadastros_fernanda' as any).insert(payload).select().single();
      setSaving(false);
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      setCadastros(prev => [(data as unknown as CadastroFernanda), ...prev]);
      toast({ title: '✅ Cadastro salvo' });
    }
    setForm(EMPTY);
    setMode('list');
  };

  const abrirNovo = () => { setForm(EMPTY); setMode('form'); };
  const abrirEditar = (c: CadastroFernanda) => {
    setForm({ id: c.id, nome: c.nome, telefone: c.telefone, cidade: c.cidade ?? '', instagram: c.instagram ?? '' });
    setMode('form');
  };
  const abrirDetalhe = (c: CadastroFernanda) => { setSelected(c); setConfirmDelete(false); setMode('detail'); };

  const handleExcluir = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('cadastros_fernanda' as any).delete().eq('id', selected.id);
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
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefone *</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Cidade</label>
            <input
              type="text"
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              placeholder="Cidade"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Instagram</label>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="@usuario"
              className={inputCls}
            />
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
          <button
            onClick={() => { setMode('list'); setSelected(null); }}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95"
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-bold text-foreground truncate flex-1">{selected.nome}</h2>
          <button
            onClick={() => abrirEditar(selected)}
            className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95"
            aria-label="Editar"
          >
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
                Cadastrado em {new Date(selected.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2.5 py-1.5">
              <Phone size={14} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">{selected.telefone}</span>
            </div>
            {selected.cidade && (
              <div className="flex items-center gap-2.5 py-1.5">
                <MapPin size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{selected.cidade}</span>
              </div>
            )}
            {selected.instagram && (
              <div className="flex items-center gap-2.5 py-1.5">
                <Instagram size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{selected.instagram}</span>
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="section-card">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full h-10 border border-destructive/30 text-destructive text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.97]"
              >
                <Trash2 size={16} /> Excluir cadastro
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Tem certeza? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 h-10 bg-muted text-sm font-semibold rounded-xl">Cancelar</button>
                  <button
                    onClick={handleExcluir}
                    disabled={saving}
                    className="flex-1 h-10 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
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
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone, cidade..."
          className="w-full h-11 pl-9 pr-9 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground active:scale-90">
            <XCircle size={14} />
          </button>
        )}
      </div>

      {/* Novo */}
      <button
        onClick={abrirNovo}
        className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97]"
      >
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
            onClick={() => { setPeriodo(opt.v); setDataEspecifica(undefined); }}
            className={cn(
              'shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-all active:scale-95',
              periodo === opt.v
                ? 'gradient-primary text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground'
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
                periodo === 'data'
                  ? 'gradient-primary text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground'
              )}
            >
              <CalendarIcon size={11} />
              {periodo === 'data' && dataEspecifica
                ? format(dataEspecifica, "dd/MM/yy", { locale: ptBR })
                : 'Data'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dataEspecifica}
              onSelect={(d) => {
                if (d) { setDataEspecifica(d); setPeriodo('data'); setDatePickerOpen(false); }
              }}
              initialFocus
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading ? 'Carregando...' : `${filtrados.length} cadastro${filtrados.length !== 1 ? 's' : ''}`}
      </p>

      {/* List */}
      {loading && cadastros.length === 0 ? (
        <SkeletonLista />
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {busca ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro ainda. Toque em "Novo cadastro" para começar.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtrados.map(c => (
            <button
              key={c.id}
              onClick={() => abrirDetalhe(c)}
              className="w-full section-card !py-3 !px-3.5 text-left active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={17} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Phone size={9} /> {c.telefone}
                    </span>
                    {c.cidade && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <MapPin size={9} /> {c.cidade}
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
