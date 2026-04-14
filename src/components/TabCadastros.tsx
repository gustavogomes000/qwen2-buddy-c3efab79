import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';
import { useLiderancas, useEleitores, useFiscaisAdmin, useInvalidarCadastros } from '@/hooks/useDataCache';
import { Search, Users, Target, Phone, MapPin, Loader2, Download, UserCheck, Calendar, ChevronDown, Mail, MessageCircle, CreditCard, FileText, Globe, Trash2 } from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import { formatCPF } from '@/lib/cpf';
import { toast } from '@/hooks/use-toast';

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
  endereco_colegio: string | null;
  municipio_eleitoral: string | null;
  uf_eleitoral: string | null;
  titulo_eleitor: string | null;
  situacao_titulo: string | null;
  observacoes: string | null;
  status: string | null;
  regiao: string | null;
  cadastrado_por_nome: string | null;
  criado_em: string;
  // Liderança specific
  tipo_lideranca: string | null;
  nivel: string | null;
  bairros_influencia: string | null;
  comunidades_influencia: string | null;
  apoiadores_estimados: number | null;
  meta_votos: number | null;
  nivel_comprometimento: string | null;
  origem_captacao: string | null;
  lideranca_nome: string | null;
  // Eleitor specific
  compromisso_voto: string | null;
}

const tipoConfig = {
  lideranca: { label: 'Liderança', icon: Users, color: 'bg-purple-500/10 text-purple-600', dot: 'bg-purple-500' },
  fiscal: { label: 'Fiscal', icon: Search, color: 'bg-orange-500/10 text-orange-600', dot: 'bg-orange-500' },
  eleitor: { label: 'Eleitor', icon: Target, color: 'bg-blue-500/10 text-blue-600', dot: 'bg-blue-500' },
};

interface Props {
  refreshKey: number;
  onSaved?: () => void;
}

export default function TabCadastros({ refreshKey, onSaved }: Props) {
  const { tipoUsuario, usuario, isAdmin, municipioId: authMunicipioId } = useAuth();
  const { cidadeAtiva, isTodasCidades, nomeMunicipioPorId } = useCidade();
  const scope = isAdmin ? 'all' : 'own';
  const { data: lidData, isLoading: lidLoading } = useLiderancas(scope);
  const { data: fisData, isLoading: fisLoading } = useFiscaisAdmin();
  const { data: eleData, isLoading: eleLoading } = useEleitores(scope);
  const invalidarCadastros = useInvalidarCadastros();

  const loading = lidLoading || fisLoading || eleLoading;
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isSuperAdmin = tipoUsuario === 'super_admin';

  const mapBase = (item: any) => ({
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
    endereco_colegio: item.pessoas?.endereco_colegio || null,
    municipio_eleitoral: item.pessoas?.municipio_eleitoral || null,
    uf_eleitoral: item.pessoas?.uf_eleitoral || null,
    titulo_eleitor: item.pessoas?.titulo_eleitor || null,
    situacao_titulo: item.pessoas?.situacao_titulo || null,
    observacoes: item.observacoes || item.pessoas?.observacoes_gerais || null,
    cadastrado_por_nome: item.hierarquia_usuarios?.nome || null,
    criado_em: item.criado_em,
    // defaults
    tipo_lideranca: null as string | null,
    nivel: null as string | null,
    bairros_influencia: null as string | null,
    comunidades_influencia: null as string | null,
    apoiadores_estimados: null as number | null,
    meta_votos: null as number | null,
    nivel_comprometimento: null as string | null,
    origem_captacao: item.origem_captacao || null,
    lideranca_nome: null as string | null,
    compromisso_voto: null as string | null,
  });

  const cadastros = useMemo(() => {
    const results: CadastroUnificado[] = [];
    if (lidData) {
      for (const l of lidData as any[]) {
        results.push({
          ...mapBase(l), id: l.id, tipo: 'lideranca',
          status: l.status, regiao: l.regiao_atuacao || l.zona_atuacao || null,
          tipo_lideranca: l.tipo_lideranca || null,
          nivel: l.nivel || null,
          bairros_influencia: l.bairros_influencia || null,
          comunidades_influencia: l.comunidades_influencia || null,
          apoiadores_estimados: l.apoiadores_estimados || null,
          meta_votos: l.meta_votos || null,
          nivel_comprometimento: l.nivel_comprometimento || null,
        });
      }
    }
    if (fisData) {
      for (const f of fisData as any[]) {
        results.push({
          ...mapBase(f), id: f.id, tipo: 'fiscal',
          status: f.status, regiao: f.origem_captacao || null,
          lideranca_nome: f.liderancas?.pessoas?.nome || null,
        });
      }
    }
    if (eleData) {
      for (const e of eleData as any[]) {
        results.push({
          ...mapBase(e), id: e.id, tipo: 'eleitor',
          status: e.compromisso_voto, regiao: e.origem_captacao || null,
          compromisso_voto: e.compromisso_voto || null,
          lideranca_nome: e.liderancas?.pessoas?.nome || null,
        });
      }
    }
    results.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
    return results;
  }, [lidData, fisData, eleData]);

  useEffect(() => {
    if (refreshKey > 0) invalidarCadastros();
  }, [refreshKey, invalidarCadastros]);

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
      const tipo = tipoFiltro === 'todos' ? undefined : (tipoFiltro as 'lideranca' | 'eleitor');
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

  const handleDelete = async (c: CadastroUnificado) => {
    const confirmMsg = `Tem certeza que deseja apagar "${c.nome}" (${tipoConfig[c.tipo].label})?`;
    if (!window.confirm(confirmMsg)) return;

    const key = `${c.tipo}-${c.id}`;
    setDeletingId(key);
    try {
      const table = c.tipo === 'lideranca' ? 'liderancas' : c.tipo === 'fiscal' ? 'fiscais' : 'possiveis_eleitores';
      const { error } = await supabase.from(table).delete().eq('id', c.id);
      if (error) throw error;

      toast({ title: '🗑️ Registro apagado', description: `${c.nome} foi removido` });
      setExpandedId(null);
      invalidarCadastros();
    } catch (err: any) {
      toast({ title: 'Erro ao apagar', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
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
          { label: 'Fiscais', value: stats.fiscais, active: tipoFiltro === 'fiscal', onClick: () => setTipoFiltro(tipoFiltro === 'fiscal' ? 'todos' : 'fiscal'), dotClass: 'bg-orange-500' },
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
          data-testid="input-busca-cadastros"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone ou agente..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Export */}
      <button data-testid="btn-exportar" onClick={handleExport} disabled={exporting}
        className="w-full h-9 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-[0.97] transition-all disabled:opacity-50">
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Exportar {tipoFiltro === 'todos' ? 'Todos' : tipoConfig[tipoFiltro].label + 's'} (Excel)
      </button>

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
                      {c.regiao && (
                        <span className="text-[10px] text-muted-foreground truncate">{c.regiao}</span>
                      )}
                      {!c.regiao && c.telefone && (
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
                  {(() => {
                    const Field = ({ label, value, span2 }: { label: string; value: string | number | null | undefined; span2?: boolean }) => (
                      <div className={`text-xs bg-muted/40 rounded-lg px-2.5 py-1.5 ${span2 ? 'col-span-2' : ''}`}>
                        <span className="text-muted-foreground">{label}:</span>{' '}
                        <span className={value ? 'text-foreground' : 'text-muted-foreground/50 italic'}>{value || '—'}</span>
                      </div>
                    );
                    return (
                      <>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Contato</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Field label="CPF" value={c.cpf ? formatCPF(c.cpf) : null} />
                            <Field label="WhatsApp" value={c.whatsapp} />
                            <Field label="Rede social" value={c.instagram || c.facebook} />
                            <Field label="Região" value={c.regiao} />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Dados Eleitorais</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Field label="Título" value={c.titulo_eleitor} />
                            <Field label="Zona" value={c.zona_eleitoral} />
                            <Field label="Seção" value={c.secao_eleitoral} />
                            <Field label="Município" value={c.municipio_eleitoral} />
                            <Field label="UF" value={c.uf_eleitoral} />
                            <Field label="Colégio" value={c.colegio_eleitoral} span2 />
                          </div>
                        </div>
                        {c.tipo === 'lideranca' && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Dados da Liderança</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Field label="Tipo" value={c.tipo_lideranca} />
                              <Field label="Nível" value={c.nivel} />
                              <Field label="Comprometimento" value={c.nivel_comprometimento} />
                              <Field label="Apoiadores" value={c.apoiadores_estimados} />
                              <Field label="Meta votos" value={c.meta_votos} />
                              <Field label="Região" value={c.regiao} />
                              <Field label="Bairros" value={c.bairros_influencia} span2 />
                              <Field label="Comunidades" value={c.comunidades_influencia} span2 />
                            </div>
                          </div>
                        )}
                        {c.tipo === 'eleitor' && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Vínculo do Eleitor</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Field label="Compromisso" value={c.compromisso_voto} />
                              <Field label="Liderança" value={c.lideranca_nome} />
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Outros</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Field label="Cadastrado por" value={c.cadastrado_por_nome} />
                          </div>
                          {c.observacoes && (
                            <div className="bg-muted/30 rounded-lg px-2.5 py-2 text-xs text-muted-foreground italic mt-1.5">
                              "{c.observacoes}"
                            </div>
                          )}
                        </div>
                         {isAdmin && (
                           <div className="pt-2 border-t border-border">
                             <button
                               onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                               disabled={deletingId === `${c.tipo}-${c.id}`}
                               className="w-full h-9 flex items-center justify-center gap-2 bg-destructive/10 text-destructive text-xs font-semibold rounded-xl border border-destructive/20 active:scale-[0.97] transition-all disabled:opacity-50"
                             >
                               {deletingId === `${c.tipo}-${c.id}` ? (
                                 <Loader2 size={14} className="animate-spin" />
                               ) : (
                                 <Trash2 size={14} />
                               )}
                               Apagar registro
                             </button>
                           </div>
                         )}
                       </>
                     );
                   })()}
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

        {/* All data loaded from cache */}
      </div>
    </div>
  );
}
