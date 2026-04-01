import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Shield, Target, Phone, MapPin, Loader2, Download, UserCheck, Calendar, ChevronDown, Mail, MessageCircle, CreditCard, FileText, Globe } from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import { formatCPF } from '@/lib/cpf';
import { toast } from '@/hooks/use-toast';
import StatusBadge from '@/components/StatusBadge';
import SkeletonLista from '@/components/SkeletonLista';

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
  const { tipoUsuario, usuario, isAdmin, municipioId: authMunicipioId } = useAuth();
  const { cidadeAtiva, isTodasCidades, nomeMunicipioPorId } = useCidade();
  const [loading, setLoading] = useState(true);
  const [cadastros, setCadastros] = useState<CadastroUnificado[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const paginaRef = useRef(0);

  const isSuperAdmin = tipoUsuario === 'super_admin';

  const PAGE_SIZE = 20;

  const fetchAll = useCallback(async (reset = true) => {
    if (!usuario) return;
    if (reset) { setLoading(true); paginaRef.current = 0; } else { setCarregandoMais(true); }
    const results: CadastroUnificado[] = [];

    const filtroMunicipioId = (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador')
      ? (isTodasCidades ? null : cidadeAtiva?.id)
      : authMunicipioId;

    const isAdminUser = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

    const from = paginaRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let lidQuery = (supabase as any).from('liderancas')
      .select('id, status, regiao_atuacao, zona_atuacao, criado_em, municipio_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, zona_eleitoral, secao_eleitoral, colegio_eleitoral, municipio_eleitoral, titulo_eleitor, observacoes_gerais), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)')
      .order('criado_em', { ascending: false }).range(from, to);
    let fisQuery = (supabase as any).from('fiscais')
      .select('id, status, zona_fiscal, criado_em, municipio_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, zona_eleitoral, secao_eleitoral, colegio_eleitoral, municipio_eleitoral, titulo_eleitor, observacoes_gerais), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome)')
      .order('criado_em', { ascending: false }).range(from, to);
    let eleQuery = (supabase as any).from('possiveis_eleitores')
      .select('id, compromisso_voto, criado_em, municipio_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, zona_eleitoral, secao_eleitoral, colegio_eleitoral, municipio_eleitoral, titulo_eleitor, observacoes_gerais), hierarquia_usuarios!possiveis_eleitores_cadastrado_por_fkey(nome)')
      .order('criado_em', { ascending: false }).range(from, to);

    if (filtroMunicipioId) {
      lidQuery = lidQuery.eq('municipio_id', filtroMunicipioId);
      fisQuery = fisQuery.eq('municipio_id', filtroMunicipioId);
      eleQuery = eleQuery.eq('municipio_id', filtroMunicipioId);
    }
    if (!isAdminUser) {
      lidQuery = lidQuery.eq('cadastrado_por', usuario.id);
      fisQuery = fisQuery.eq('cadastrado_por', usuario.id);
      eleQuery = eleQuery.eq('cadastrado_por', usuario.id);
    }

    const [lidRes, fisRes, eleRes] = await Promise.all([lidQuery, fisQuery, eleQuery]);

    const mapPessoa = (item: any, tipo: CadastroUnificado['tipo'], regiao: string | null, status: string | null) => ({
      id: item.id, tipo,
      nome: item.pessoas?.nome || '—',
      cpf: item.pessoas?.cpf || null,
      telefone: item.pessoas?.telefone || null,
      whatsapp: item.pessoas?.whatsapp || null,
      email: item.pessoas?.email || null,
      instagram: item.pessoas?.instagram || null,
      facebook: item.pessoas?.facebook || null,
      zona_eleitoral: item.pessoas?.zona_eleitoral || null,
      secao_eleitoral: item.pessoas?.secao_eleitoral || null,
      colegio_eleitoral: item.pessoas?.colegio_eleitoral || null,
      municipio_eleitoral: item.pessoas?.municipio_eleitoral || null,
      titulo_eleitor: item.pessoas?.titulo_eleitor || null,
      observacoes: item.observacoes || item.pessoas?.observacoes_gerais || null,
      status,
      regiao,
      cadastrado_por_nome: item.hierarquia_usuarios?.nome || null,
      criado_em: item.criado_em,
    });

    if (lidRes.data) {
      for (const l of lidRes.data as any[]) {
        results.push(mapPessoa(l, 'lideranca', l.regiao_atuacao || l.zona_atuacao || null, l.status));
      }
    }
    if (fisRes.data) {
      for (const f of fisRes.data as any[]) {
        results.push(mapPessoa(f, 'fiscal', f.zona_fiscal || null, f.status));
      }
    }
    if (eleRes.data) {
      for (const e of eleRes.data as any[]) {
        results.push(mapPessoa(e, 'eleitor', null, e.compromisso_voto));
      }
    }

    results.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
    
    if (reset) {
      setCadastros(results);
    } else {
      setCadastros(prev => [...prev, ...results]);
    }
    paginaRef.current += 1;
    setTemMais(results.length >= PAGE_SIZE);
    setLoading(false);
    setCarregandoMais(false);
  }, [usuario, tipoUsuario, cidadeAtiva, isTodasCidades, authMunicipioId]);

  useEffect(() => { fetchAll(true); }, [fetchAll, refreshKey]);

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

  if (loading && cadastros.length === 0) {
    return <SkeletonLista />;
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
              {/* Header - always visible */}
              <button
                onClick={() => setExpandedId(expandedId === `${c.tipo}-${c.id}` ? null : `${c.tipo}-${c.id}`)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <config.icon size={17} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${config.color}`}>
                        {config.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {c.status && <StatusBadge status={c.status} />}
                      {c.telefone && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Phone size={9} /> {c.telefone}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/70">
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

                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-muted-foreground transition-transform mt-1 ${
                      expandedId === `${c.tipo}-${c.id}` ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Expanded details */}
              {expandedId === `${c.tipo}-${c.id}` && (
                <div className="mt-3 pt-3 border-t border-border space-y-2.5">
                  {/* Contato */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Contato</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {c.cpf && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <CreditCard size={11} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{formatCPF(c.cpf)}</span>
                        </div>
                      )}
                      {c.telefone && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <Phone size={11} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{c.telefone}</span>
                        </div>
                      )}
                      {c.whatsapp && c.whatsapp !== c.telefone && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <MessageCircle size={11} className="text-emerald-500 shrink-0" />
                          <span className="truncate">{c.whatsapp}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <Mail size={11} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.instagram && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <Globe size={11} className="text-pink-500 shrink-0" />
                          <span className="truncate">@{c.instagram.replace('@', '')}</span>
                        </div>
                      )}
                      {c.facebook && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <Globe size={11} className="text-blue-500 shrink-0" />
                          <span className="truncate">{c.facebook}</span>
                        </div>
                      )}
                    </div>
                    {!c.cpf && !c.telefone && !c.whatsapp && !c.email && !c.instagram && !c.facebook && (
                      <p className="text-[10px] text-muted-foreground/50 italic">Nenhum contato cadastrado</p>
                    )}
                  </div>

                  {/* Dados eleitorais */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Dados Eleitorais</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {c.titulo_eleitor && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <FileText size={11} className="text-muted-foreground shrink-0" />
                          <span>Título: {c.titulo_eleitor}</span>
                        </div>
                      )}
                      {c.zona_eleitoral && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <MapPin size={11} className="text-muted-foreground shrink-0" />
                          <span>Zona: {c.zona_eleitoral}</span>
                        </div>
                      )}
                      {c.secao_eleitoral && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <MapPin size={11} className="text-muted-foreground shrink-0" />
                          <span>Seção: {c.secao_eleitoral}</span>
                        </div>
                      )}
                      {c.colegio_eleitoral && (
                        <div className="col-span-2 flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <MapPin size={11} className="text-muted-foreground shrink-0" />
                          <span className="truncate">Colégio: {c.colegio_eleitoral}</span>
                        </div>
                      )}
                      {c.municipio_eleitoral && (
                        <div className="col-span-2 flex items-center gap-1.5 text-xs text-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <MapPin size={11} className="text-muted-foreground shrink-0" />
                          <span className="truncate">Município: {c.municipio_eleitoral}</span>
                        </div>
                      )}
                    </div>
                    {!c.titulo_eleitor && !c.zona_eleitoral && !c.secao_eleitoral && !c.colegio_eleitoral && !c.municipio_eleitoral && (
                      <p className="text-[10px] text-muted-foreground/50 italic">Nenhum dado eleitoral</p>
                    )}
                  </div>

                  {/* Região / Observações */}
                  {(c.regiao || c.observacoes) && (
                    <div>
                      {c.regiao && (
                        <div className="flex items-center gap-1.5 text-xs text-foreground mb-1">
                          <MapPin size={11} className="text-primary shrink-0" />
                          <span>Região: {c.regiao}</span>
                        </div>
                      )}
                      {c.observacoes && (
                        <div className="bg-muted/30 rounded-lg px-2.5 py-2 text-xs text-muted-foreground italic">
                          "{c.observacoes}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado</p>
          </div>
        )}

        {temMais && (
          <button onClick={() => fetchAll(false)} disabled={carregandoMais}
            className="w-full py-3 text-sm text-primary font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
            {carregandoMais ? <Loader2 size={16} className="animate-spin" /> : 'Carregar mais'}
          </button>
        )}
      </div>
    </div>
  );
}
