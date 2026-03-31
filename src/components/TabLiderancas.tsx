import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronRight, Phone, MessageCircle, Trash2, ArrowLeft, XCircle, Download } from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF } from '@/lib/cpf';
import { toast } from '@/hooks/use-toast';
import StatusBadge from '@/components/StatusBadge';

const statusFilters = ['Todas', 'Ativa', 'Potencial', 'Em negociação', 'Fraca', 'Descartada'];

interface LiderancaRow {
  id: string;
  status: string;
  tipo_lideranca: string | null;
  nivel: string | null;
  zona_atuacao: string | null;
  apoiadores_estimados: number | null;
  cadastrado_por: string | null;
  suplente_id: string | null;
  criado_em: string;
  pessoas: { nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null; email: string | null; instagram: string | null; facebook: string | null; titulo_eleitor: string | null; zona_eleitoral: string | null; secao_eleitoral: string | null; municipio_eleitoral: string | null; uf_eleitoral: string | null; colegio_eleitoral: string | null; endereco_colegio: string | null; situacao_titulo: string | null; };
  hierarquia_usuarios: { nome: string } | null;
  regiao_atuacao: string | null;
  bairros_influencia: string | null;
  comunidades_influencia: string | null;
  origem_captacao: string | null;
  meta_votos: number | null;
  nivel_comprometimento: string | null;
  observacoes: string | null;
}

interface Props {
  refreshKey: number;
}

export default function TabLiderancas({ refreshKey }: Props) {
  const { usuario, isAdmin } = useAuth();
  const [data, setData] = useState<LiderancaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<LiderancaRow | null>(null);
  const [agentes, setAgentes] = useState<{ id: string; nome: string }[]>([]);
  const [agenteFilter, setAgenteFilter] = useState('');

  const fetchData = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('liderancas')
      .select('id, status, tipo_lideranca, nivel, zona_atuacao, apoiadores_estimados, cadastrado_por, suplente_id, criado_em, regiao_atuacao, bairros_influencia, comunidades_influencia, origem_captacao, meta_votos, nivel_comprometimento, observacoes, pessoas(*), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)')
      .order('criado_em', { ascending: false });
    if (!error && data) setData(data as unknown as LiderancaRow[]);
    setLoading(false);
  }, [usuario]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);
  
  useEffect(() => { 
    if (isAdmin) {
      supabase.from('hierarquia_usuarios').select('id, nome').in('tipo', ['suplente', 'lideranca', 'coordenador']).then(({ data }) => { 
        if (data) setAgentes(data); 
      }); 
    }
  }, [isAdmin]);

  const filtered = data.filter(l => {
    if (statusFilter !== 'Todas' && l.status !== statusFilter) return false;
    if (agenteFilter && l.cadastrado_por !== agenteFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nome = l.pessoas?.nome?.toLowerCase() || '';
      const cpf = l.pessoas?.cpf || '';
      const tel = l.pessoas?.telefone || '';
      if (!nome.includes(q) && !cpf.includes(q) && !tel.includes(q)) return false;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta liderança permanentemente?')) return;
    await supabase.from('liderancas').delete().eq('id', id);
    toast({ title: 'Liderança excluída' });
    setSelected(null);
    fetchData();
  };

  const handleDiscard = async (id: string) => {
    await supabase.from('liderancas').update({ status: 'Descartada', atualizado_em: new Date().toISOString() }).eq('id', id);
    toast({ title: 'Liderança descartada' });
    setSelected(null);
    fetchData();
  };

  // ===== DETAIL VIEW =====
  if (selected) {
    const l = selected;
    const p = l.pessoas;
    const canEdit = isAdmin || l.cadastrado_por === usuario?.id;

    const Info = ({ label, value, link }: { label: string; value?: string | null; link?: string }) => {
      if (!value) return null;
      return (
        <div className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
          <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
          {link ? <a href={link} target="_blank" rel="noopener" className="text-sm text-primary text-right ml-2">{value}</a>
            : <span className="text-sm text-foreground text-right ml-2 break-words">{value}</span>}
        </div>
      );
    };

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar à lista
        </button>

        <div className="section-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
              <p className="text-sm text-muted-foreground">{l.tipo_lideranca}{l.nivel ? ` · ${l.nivel}` : ''}</p>
              {isAdmin && l.hierarquia_usuarios && (
                <p className="text-[10px] text-primary/70 mt-1">
                  Por: {l.hierarquia_usuarios.nome} · {new Date(l.criado_em).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            <StatusBadge status={l.status} />
          </div>
          <div className="flex gap-2 pt-2">
            {p.telefone && <a href={`tel:${p.telefone}`} className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-xs font-medium"><Phone size={14} /> Ligar</a>}
            {p.whatsapp && <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium"><MessageCircle size={14} /> WhatsApp</a>}
          </div>
        </div>

        <div className="section-card">
          <h3 className="section-title">👤 Dados Pessoais</h3>
          <Info label="CPF" value={p.cpf ? maskCPF(p.cpf) : null} />
          <Info label="Telefone" value={p.telefone} link={p.telefone ? `tel:${p.telefone}` : undefined} />
          <Info label="WhatsApp" value={p.whatsapp} />
          <Info label="E-mail" value={p.email} link={p.email ? `mailto:${p.email}` : undefined} />
          <Info label="Instagram" value={p.instagram} link={p.instagram ? `https://instagram.com/${p.instagram.replace('@', '')}` : undefined} />
          <Info label="Facebook" value={p.facebook} />
        </div>

        <div className="section-card">
          <h3 className="section-title">🗳️ Dados Eleitorais</h3>
          <Info label="Título" value={p.titulo_eleitor} />
          <Info label="Zona / Seção" value={p.zona_eleitoral || p.secao_eleitoral ? `${p.zona_eleitoral || '—'} / ${p.secao_eleitoral || '—'}` : null} />
          <Info label="Município / UF" value={p.municipio_eleitoral || p.uf_eleitoral ? `${p.municipio_eleitoral || '—'} / ${p.uf_eleitoral || '—'}` : null} />
          <Info label="Colégio" value={p.colegio_eleitoral} />
          <Info label="End. colégio" value={p.endereco_colegio} />
          <Info label="Situação" value={p.situacao_titulo} />
        </div>

        <div className="section-card">
          <h3 className="section-title">⭐ Perfil</h3>
          <Info label="Tipo" value={l.tipo_lideranca} />
          <Info label="Nível" value={l.nivel} />
          <Info label="Região" value={l.regiao_atuacao} />
          <Info label="Zona atuação" value={l.zona_atuacao} />
          <Info label="Bairros" value={l.bairros_influencia} />
          <Info label="Comunidades" value={l.comunidades_influencia} />
          <Info label="Origem" value={l.origem_captacao} />
          <Info label="Apoiadores" value={l.apoiadores_estimados?.toString()} />
          <Info label="Meta votos" value={l.meta_votos?.toString()} />
          <Info label="Comprometimento" value={l.nivel_comprometimento} />
          {l.observacoes && (
            <div className="pt-2">
              <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
              <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{l.observacoes}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {isAdmin && l.status !== 'Descartada' && (
            <button onClick={() => handleDiscard(l.id)}
              className="w-full h-11 border border-border rounded-xl text-muted-foreground font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
              <XCircle size={16} /> Descartar
            </button>
          )}
          {isAdmin && (
            <button onClick={() => handleDelete(l.id)}
              className="w-full h-11 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
              <Trash2 size={16} /> Excluir
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-3 pb-24">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

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

      {isAdmin && (
        <select value={agenteFilter} onChange={e => setAgenteFilter(e.target.value)}
          className="w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none">
          <option value="">Todos os agentes</option>
          {agentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      )}

      {isAdmin && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total', value: data.length },
            { label: 'Ativas', value: data.filter(l => l.status === 'Ativa').length },
            { label: 'Apoiadores', value: data.reduce((s, l) => s + (l.apoiadores_estimados || 0), 0) },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-2 text-center">
              <p className="text-lg font-bold text-primary">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{filtered.length} liderança{filtered.length !== 1 ? 's' : ''}</p>

      {isAdmin && (
        <button onClick={() => exportAllCadastros('lideranca')}
          className="w-full h-9 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-[0.97] transition-all">
          <Download size={14} /> Exportar Lideranças (CSV)
        </button>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="section-card animate-pulse"><div className="h-4 bg-muted rounded w-2/3" /><div className="h-3 bg-muted rounded w-1/2 mt-2" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhuma liderança encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <button key={l.id} onClick={() => setSelected(l)}
              className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm truncate">{l.pessoas?.nome || '—'}</span>
                  <StatusBadge status={l.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {l.tipo_lideranca || '—'}{l.zona_atuacao ? ` · Z${l.zona_atuacao}` : ''}
                  {l.apoiadores_estimados ? ` · ${l.apoiadores_estimados} apoiadores` : ''}
                </p>
                {isAdmin && l.hierarquia_usuarios && (
                  <p className="text-[10px] text-primary/60 mt-0.5">Por: {l.hierarquia_usuarios.nome}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
