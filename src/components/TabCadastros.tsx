import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Shield, Target, Phone, MapPin, Loader2, Download, UserCheck, Calendar, ChevronDown, Mail, MessageCircle, CreditCard, FileText, Globe } from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import { formatCPF } from '@/lib/cpf';
import { toast } from '@/hooks/use-toast';
import StatusBadge from '@/components/StatusBadge';

type TipoFiltro = 'todos' | 'lideranca' | 'fiscal' | 'eleitor';

interface CadastroUnificado {
  id: string;
  tipo: 'lideranca' | 'fiscal' | 'eleitor';
  nome: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  zona_eleitoral: string | null;
  secao_eleitoral: string | null;
  colegio_eleitoral: string | null;
  municipio_eleitoral: string | null;
  titulo_eleitor: string | null;
  observacoes: string | null;
  status: string | null;
  regiao: string | null;
  cadastrado_por_nome: string | null;
  criado_em: string;
}

const tipoConfig = {
  lideranca: { label: 'Liderança', icon: Users, color: 'bg-purple-500/10 text-purple-600', dot: 'bg-purple-500' },
  fiscal: { label: 'Fiscal', icon: Shield, color: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
  eleitor: { label: 'Eleitor', icon: Target, color: 'bg-blue-500/10 text-blue-600', dot: 'bg-blue-500' },
};

interface Props {
  refreshKey: number;
  onSaved?: () => void;
}

export default function TabCadastros({ refreshKey, onSaved }: Props) {
  const { tipoUsuario, usuario, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cadastros, setCadastros] = useState<CadastroUnificado[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  const isSuperAdmin = tipoUsuario === 'super_admin';

  const fetchAll = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    const results: CadastroUnificado[] = [];

    const [lidRes, fisRes, eleRes] = await Promise.all([
      supabase.from('liderancas')
        .select('id, status, regiao_atuacao, zona_atuacao, criado_em, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)')
        .order('criado_em', { ascending: false }),
      supabase.from('fiscais')
        .select('id, status, zona_fiscal, criado_em, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome)')
        .order('criado_em', { ascending: false }),
      supabase.from('possiveis_eleitores')
        .select('id, compromisso_voto, criado_em, pessoas(nome, cpf, telefone, whatsapp, zona_eleitoral, secao_eleitoral), hierarquia_usuarios!possiveis_eleitores_cadastrado_por_fkey(nome)')
        .order('criado_em', { ascending: false }),
    ]);

    if (lidRes.data) {
      for (const l of lidRes.data as any[]) {
        results.push({
          id: l.id, tipo: 'lideranca',
          nome: l.pessoas?.nome || '—',
          cpf: l.pessoas?.cpf || null,
          telefone: l.pessoas?.telefone || null,
          whatsapp: l.pessoas?.whatsapp || null,
          zona_eleitoral: l.pessoas?.zona_eleitoral || null,
          secao_eleitoral: l.pessoas?.secao_eleitoral || null,
          status: l.status,
          regiao: l.regiao_atuacao || l.zona_atuacao || null,
          cadastrado_por_nome: l.hierarquia_usuarios?.nome || null,
          criado_em: l.criado_em,
        });
      }
    }
    if (fisRes.data) {
      for (const f of fisRes.data as any[]) {
        results.push({
          id: f.id, tipo: 'fiscal',
          nome: f.pessoas?.nome || '—',
          cpf: f.pessoas?.cpf || null,
          telefone: f.pessoas?.telefone || null,
          whatsapp: f.pessoas?.whatsapp || null,
          zona_eleitoral: f.pessoas?.zona_eleitoral || null,
          secao_eleitoral: f.pessoas?.secao_eleitoral || null,
          status: f.status,
          regiao: f.zona_fiscal || null,
          cadastrado_por_nome: f.hierarquia_usuarios?.nome || null,
          criado_em: f.criado_em,
        });
      }
    }
    if (eleRes.data) {
      for (const e of eleRes.data as any[]) {
        results.push({
          id: e.id, tipo: 'eleitor',
          nome: e.pessoas?.nome || '—',
          cpf: e.pessoas?.cpf || null,
          telefone: e.pessoas?.telefone || null,
          whatsapp: e.pessoas?.whatsapp || null,
          zona_eleitoral: e.pessoas?.zona_eleitoral || null,
          secao_eleitoral: e.pessoas?.secao_eleitoral || null,
          status: e.compromisso_voto,
          regiao: null,
          cadastrado_por_nome: e.hierarquia_usuarios?.nome || null,
          criado_em: e.criado_em,
        });
      }
    }

    results.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
    setCadastros(results);
    setLoading(false);
  }, [usuario]);

  useEffect(() => { fetchAll(); }, [fetchAll, refreshKey]);

  const stats = useMemo(() => {
    const total = cadastros.length;
    const liderancas = cadastros.filter(c => c.tipo === 'lideranca').length;
    const fiscais = cadastros.filter(c => c.tipo === 'fiscal').length;
    const eleitores = cadastros.filter(c => c.tipo === 'eleitor').length;
    return { total, liderancas, fiscais, eleitores };
  }, [cadastros]);

  const filtered = useMemo(() => {
    let list = cadastros;
    if (tipoFiltro !== 'todos') list = list.filter(c => c.tipo === tipoFiltro);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf && c.cpf.includes(q)) ||
        (c.telefone && c.telefone.includes(q)) ||
        (c.cadastrado_por_nome && c.cadastrado_por_nome.toLowerCase().includes(q))
      );
    }
    return list;
  }, [cadastros, tipoFiltro, searchQuery]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const tipo = tipoFiltro === 'todos' ? undefined : (tipoFiltro === 'lideranca' ? 'lideranca' : tipoFiltro === 'fiscal' ? 'fiscal' : 'eleitor') as any;
      const count = await exportAllCadastros(tipo);
      toast({ title: `✅ ${count} registros exportados!` });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, active: tipoFiltro === 'todos', onClick: () => setTipoFiltro('todos'), dotClass: 'bg-foreground' },
          { label: 'Lideranças', value: stats.liderancas, active: tipoFiltro === 'lideranca', onClick: () => setTipoFiltro(tipoFiltro === 'lideranca' ? 'todos' : 'lideranca'), dotClass: 'bg-purple-500' },
          { label: 'Fiscais', value: stats.fiscais, active: tipoFiltro === 'fiscal', onClick: () => setTipoFiltro(tipoFiltro === 'fiscal' ? 'todos' : 'fiscal'), dotClass: 'bg-emerald-500' },
          { label: 'Eleitores', value: stats.eleitores, active: tipoFiltro === 'eleitor', onClick: () => setTipoFiltro(tipoFiltro === 'eleitor' ? 'todos' : 'eleitor'), dotClass: 'bg-blue-500' },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`flex flex-col items-center py-2.5 rounded-xl border transition-all active:scale-95 ${
              s.active
                ? 'border-primary/30 bg-primary/5 shadow-sm'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${s.dotClass}`} />
              <span className="text-lg font-bold text-foreground">{s.value}</span>
            </div>
            <span className="text-[9px] text-muted-foreground font-medium">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone ou agente..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Export - super_admin only */}
      {isSuperAdmin && (
        <button onClick={handleExport} disabled={exporting}
          className="w-full h-9 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Exportar {tipoFiltro === 'todos' ? 'Todos' : tipoConfig[tipoFiltro].label + 's'} (CSV)
        </button>
      )}

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>

      {/* List */}
      <div className="space-y-1.5">
        {filtered.map(c => {
          const config = tipoConfig[c.tipo];
          return (
            <div
              key={`${c.tipo}-${c.id}`}
              className="section-card !py-3 !px-3.5"
            >
              <div className="flex items-start gap-3">
                {/* Type indicator */}
                <div className={`w-9 h-9 rounded-full ${config.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  <config.icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + type badge */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${config.color}`}>
                      {config.label}
                    </span>
                  </div>

                  {/* Status */}
                  {c.status && (
                    <div className="mb-1">
                      <StatusBadge status={c.status} />
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    {c.cpf && (
                      <span>CPF: {formatCPF(c.cpf)}</span>
                    )}
                    {c.telefone && (
                      <span className="flex items-center gap-0.5">
                        <Phone size={9} /> {c.telefone}
                      </span>
                    )}
                    {c.zona_eleitoral && (
                      <span>Zona: {c.zona_eleitoral}{c.secao_eleitoral ? ` / Seção: ${c.secao_eleitoral}` : ''}</span>
                    )}
                    {c.regiao && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={9} /> {c.regiao}
                      </span>
                    )}
                  </div>

                  {/* Footer: agent + date */}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/70">
                    {c.cadastrado_por_nome && (
                      <span className="flex items-center gap-0.5">
                        <UserCheck size={9} /> {c.cadastrado_por_nome}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Calendar size={9} /> {formatDate(c.criado_em)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
