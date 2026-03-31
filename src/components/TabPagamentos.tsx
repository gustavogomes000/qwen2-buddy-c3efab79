import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, DollarSign, Calendar, AlertCircle, CheckCircle2, Clock, Filter } from 'lucide-react';

interface ContaPagar {
  id: string;
  descricao: string;
  motivo: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  categoria: string | null;
  subcategoria: string | null;
  forma_pagamento: string | null;
  fornecedor_nome_livre: string | null;
  recorrente: boolean;
  criado_em: string;
}

const statusColors: Record<string, string> = {
  'Lancada': 'bg-amber-500/10 text-amber-600',
  'Aprovada': 'bg-blue-500/10 text-blue-600',
  'Paga': 'bg-emerald-500/10 text-emerald-600',
  'Vencida': 'bg-red-500/10 text-red-600',
  'Cancelada': 'bg-muted text-muted-foreground',
};

const statusFilters = ['Todas', 'Lancada', 'Aprovada', 'Paga', 'Vencida', 'Cancelada'];

export default function TabPagamentos() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [selected, setSelected] = useState<ContaPagar | null>(null);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('buscar-pagamentos-externo');
      if (fnError) throw fnError;
      setContas(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const filtered = contas.filter(c => {
    if (statusFilter !== 'Todas' && c.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (c.descricao?.toLowerCase() || '').includes(q) ||
        (c.fornecedor_nome_livre?.toLowerCase() || '').includes(q) ||
        (c.motivo?.toLowerCase() || '').includes(q);
    }
    return true;
  });

  const totalValor = filtered.reduce((s, c) => s + (c.valor || 0), 0);
  const totalPago = filtered.filter(c => c.status === 'Paga').reduce((s, c) => s + (c.valor || 0), 0);
  const totalPendente = filtered.filter(c => c.status !== 'Paga' && c.status !== 'Cancelada').reduce((s, c) => s + (c.valor || 0), 0);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

  const isVencida = (c: ContaPagar) => {
    if (c.status === 'Paga' || c.status === 'Cancelada') return false;
    return new Date(c.data_vencimento + 'T23:59:59') < new Date();
  };

  if (selected) {
    const c = selected;
    const Info = ({ label, value }: { label: string; value?: string | null }) => {
      if (!value) return null;
      return (
        <div className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
          <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
          <span className="text-sm text-foreground text-right ml-2 break-words">{value}</span>
        </div>
      );
    };

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          ← Voltar
        </button>
        <div className="section-card">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{c.descricao}</h2>
              <p className="text-sm text-muted-foreground">{c.motivo}</p>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold shrink-0 ${statusColors[c.status] || 'bg-muted text-muted-foreground'}`}>
              {c.status}
            </span>
          </div>
          <div className="flex items-baseline gap-1 pt-1">
            <span className="text-2xl font-bold text-primary">{formatCurrency(c.valor)}</span>
          </div>
        </div>
        <div className="section-card">
          <h3 className="section-title">📋 Detalhes</h3>
          <Info label="Fornecedor" value={c.fornecedor_nome_livre} />
          <Info label="Categoria" value={c.categoria} />
          <Info label="Subcategoria" value={c.subcategoria} />
          <Info label="Forma pgto." value={c.forma_pagamento} />
          <Info label="Vencimento" value={formatDate(c.data_vencimento)} />
          <Info label="Pagamento" value={c.data_pagamento ? formatDate(c.data_pagamento) : null} />
          <Info label="Recorrente" value={c.recorrente ? 'Sim' : 'Não'} />
          <Info label="Criado em" value={new Date(c.criado_em).toLocaleDateString('pt-BR')} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-card text-center py-8">
        <AlertCircle size={32} className="mx-auto text-destructive mb-2" />
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={fetchContas} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium active:scale-95">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: formatCurrency(totalValor), icon: DollarSign, color: 'text-primary' },
          { label: 'Pago', value: formatCurrency(totalPago), icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Pendente', value: formatCurrency(totalPendente), icon: Clock, color: 'text-amber-500' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-2.5 text-center">
            <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
            <p className="text-sm font-bold text-foreground truncate">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar pagamento..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {statusFilters.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-all ${
              statusFilter === s ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
            }`}>
            {s}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhum pagamento encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                c.status === 'Paga' ? 'bg-emerald-500/10' : isVencida(c) ? 'bg-red-500/10' : 'bg-amber-500/10'
              }`}>
                {c.status === 'Paga' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
                  isVencida(c) ? <AlertCircle size={18} className="text-red-500" /> :
                    <DollarSign size={18} className="text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm truncate">{c.descricao}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[c.status] || 'bg-muted text-muted-foreground'}`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {formatCurrency(c.valor)} · Venc. {formatDate(c.data_vencimento)}
                  {c.fornecedor_nome_livre ? ` · ${c.fornecedor_nome_livre}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
