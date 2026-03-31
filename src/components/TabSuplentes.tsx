import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronRight, ArrowLeft, Phone, MessageCircle, Loader2, Users, Eye, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SuplenteRow {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
  situacao: string | null;
  base_politica: string | null;
  expectativa_votos: number | null;
  total_votos: number | null;
}

interface TreeNode {
  tipo: 'lideranca' | 'fiscal' | 'eleitor';
  id: string;
  nome: string;
  status: string | null;
  telefone: string | null;
  whatsapp: string | null;
  detalhes: string;
  children: TreeNode[];
}

interface Props {
  refreshKey: number;
}

export default function TabSuplentes({ refreshKey }: Props) {
  const { isAdmin } = useAuth();
  const [suplentes, setSuplentes] = useState<SuplenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SuplenteRow | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Stats for selected suplente
  const [stats, setStats] = useState({ liderancas: 0, fiscais: 0, eleitores: 0 });

  const fetchSuplentes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('suplentes')
      .select('id, nome, regiao_atuacao, telefone, partido, situacao, base_politica, expectativa_votos, total_votos')
      .order('nome');
    if (data) setSuplentes(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSuplentes(); }, [fetchSuplentes, refreshKey]);

  const filtered = useMemo(() => {
    if (!search) return suplentes;
    const q = search.toLowerCase();
    return suplentes.filter(s => s.nome.toLowerCase().includes(q));
  }, [suplentes, search]);

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openDetail = async (sup: SuplenteRow) => {
    setSelected(sup);
    setLoadingTree(true);
    setExpandedIds(new Set());

    // Fetch all lideranças for this suplente
    const { data: lids } = await supabase
      .from('liderancas')
      .select('id, status, tipo_lideranca, pessoas(nome, telefone, whatsapp)')
      .eq('suplente_id', sup.id)
      .order('criado_em', { ascending: false });

    // Fetch all fiscais for this suplente  
    const { data: fiscs } = await supabase
      .from('fiscais')
      .select('id, status, zona_fiscal, secao_fiscal, lideranca_id, pessoas(nome, telefone, whatsapp)')
      .eq('suplente_id', sup.id)
      .order('criado_em', { ascending: false });

    // Fetch all eleitores for this suplente
    const { data: eleits } = await supabase
      .from('possiveis_eleitores')
      .select('id, compromisso_voto, lideranca_id, fiscal_id, pessoas(nome, telefone, whatsapp)')
      .eq('suplente_id', sup.id)
      .order('criado_em', { ascending: false });

    const liderancas = (lids || []) as any[];
    const fiscais = (fiscs || []) as any[];
    const eleitores = (eleits || []) as any[];

    setStats({
      liderancas: liderancas.length,
      fiscais: fiscais.length,
      eleitores: eleitores.length,
    });

    // Build tree: Suplente → Lideranças → Fiscais → Eleitores
    const treeNodes: TreeNode[] = [];

    // Lideranças
    for (const lid of liderancas) {
      const lidNode: TreeNode = {
        tipo: 'lideranca',
        id: lid.id,
        nome: lid.pessoas?.nome || '—',
        status: lid.status,
        telefone: lid.pessoas?.telefone,
        whatsapp: lid.pessoas?.whatsapp,
        detalhes: lid.tipo_lideranca || '—',
        children: [],
      };

      // Fiscais under this liderança
      const lidFiscais = fiscais.filter(f => f.lideranca_id === lid.id);
      for (const fisc of lidFiscais) {
        const fiscNode: TreeNode = {
          tipo: 'fiscal',
          id: fisc.id,
          nome: fisc.pessoas?.nome || '—',
          status: fisc.status,
          telefone: fisc.pessoas?.telefone,
          whatsapp: fisc.pessoas?.whatsapp,
          detalhes: `Z${fisc.zona_fiscal || '—'} S${fisc.secao_fiscal || '—'}`,
          children: [],
        };

        // Eleitores under this fiscal
        const fiscEleitores = eleitores.filter(e => e.fiscal_id === fisc.id);
        for (const el of fiscEleitores) {
          fiscNode.children.push({
            tipo: 'eleitor',
            id: el.id,
            nome: el.pessoas?.nome || '—',
            status: el.compromisso_voto,
            telefone: el.pessoas?.telefone,
            whatsapp: el.pessoas?.whatsapp,
            detalhes: el.compromisso_voto || 'Indefinido',
            children: [],
          });
        }

        lidNode.children.push(fiscNode);
      }

      // Eleitores directly under liderança (no fiscal)
      const lidEleitores = eleitores.filter(e => e.lideranca_id === lid.id && !e.fiscal_id);
      for (const el of lidEleitores) {
        lidNode.children.push({
          tipo: 'eleitor',
          id: el.id,
          nome: el.pessoas?.nome || '—',
          status: el.compromisso_voto,
          telefone: el.pessoas?.telefone,
          whatsapp: el.pessoas?.whatsapp,
          detalhes: el.compromisso_voto || 'Indefinido',
          children: [],
        });
      }

      treeNodes.push(lidNode);
    }

    // Fiscais not linked to any liderança
    const orphanFiscais = fiscais.filter(f => !f.lideranca_id);
    for (const fisc of orphanFiscais) {
      const fiscNode: TreeNode = {
        tipo: 'fiscal',
        id: fisc.id,
        nome: fisc.pessoas?.nome || '—',
        status: fisc.status,
        telefone: fisc.pessoas?.telefone,
        whatsapp: fisc.pessoas?.whatsapp,
        detalhes: `Z${fisc.zona_fiscal || '—'} S${fisc.secao_fiscal || '—'}`,
        children: [],
      };

      const fiscEleitores = eleitores.filter(e => e.fiscal_id === fisc.id && !e.lideranca_id);
      for (const el of fiscEleitores) {
        fiscNode.children.push({
          tipo: 'eleitor',
          id: el.id,
          nome: el.pessoas?.nome || '—',
          status: el.compromisso_voto,
          telefone: el.pessoas?.telefone,
          whatsapp: el.pessoas?.whatsapp,
          detalhes: el.compromisso_voto || 'Indefinido',
          children: [],
        });
      }

      treeNodes.push(fiscNode);
    }

    // Eleitores not linked to anyone
    const orphanEleitores = eleitores.filter(e => !e.lideranca_id && !e.fiscal_id);
    for (const el of orphanEleitores) {
      treeNodes.push({
        tipo: 'eleitor',
        id: el.id,
        nome: el.pessoas?.nome || '—',
        status: el.compromisso_voto,
        telefone: el.pessoas?.telefone,
        whatsapp: el.pessoas?.whatsapp,
        detalhes: el.compromisso_voto || 'Indefinido',
        children: [],
      });
    }

    setTree(treeNodes);
    setLoadingTree(false);
  };

  const typeConfig = {
    lideranca: { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'Lid', border: 'border-blue-500/30' },
    fiscal: { bg: 'bg-purple-500/10', text: 'text-purple-600', label: 'Fisc', border: 'border-purple-500/30' },
    eleitor: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Eleit', border: 'border-amber-500/30' },
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const config = typeConfig[node.tipo];
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(`${node.tipo}-${node.id}`);
    const nodeKey = `${node.tipo}-${node.id}`;

    return (
      <div key={nodeKey}>
        <div
          className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-muted/50 transition-all"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggle(nodeKey)} className="shrink-0 p-0.5">
              {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
            <span className={`text-[9px] font-bold ${config.text}`}>{config.label}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{node.nome}</p>
            <p className="text-[10px] text-muted-foreground">{node.detalhes} · {node.status || '—'}</p>
          </div>
          {node.whatsapp && (
            <a href={`https://wa.me/55${node.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              className="p-1 text-emerald-500 shrink-0">
              <MessageCircle size={13} />
            </a>
          )}
          {hasChildren && (
            <span className="text-[9px] text-muted-foreground shrink-0">{node.children.length}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className={`border-l ${config.border}`} style={{ marginLeft: `${depth * 20 + 20}px` }}>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // DETAIL VIEW - Tree for selected suplente
  if (selected) {
    return (
      <div className="space-y-3 pb-24">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <h2 className="text-lg font-bold text-foreground">{selected.nome}</h2>
          <p className="text-xs text-muted-foreground">
            {selected.partido || '—'} · {selected.regiao_atuacao || '—'} · {selected.situacao || '—'}
          </p>
          {selected.telefone && (
            <div className="flex gap-2 pt-2">
              <a href={`tel:${selected.telefone}`} className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-xs font-medium">
                <Phone size={14} /> Ligar
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Lideranças', value: stats.liderancas, color: 'text-blue-500' },
            { label: 'Fiscais', value: stats.fiscais, color: 'text-purple-500' },
            { label: 'Eleitores', value: stats.eleitores, color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-2.5 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {loadingTree ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : tree.length === 0 ? (
          <div className="section-card text-center py-6">
            <p className="text-sm text-muted-foreground">Nenhum cadastro vinculado a este suplente</p>
          </div>
        ) : (
          <div className="section-card !p-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1">
              Árvore: Suplente → Lideranças → Fiscais → Eleitores
            </p>
            {tree.map(node => renderTreeNode(node, 0))}
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-3 pb-24">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar suplente..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} suplente{filtered.length !== 1 ? 's' : ''}</p>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="section-card animate-pulse"><div className="h-4 bg-muted rounded w-2/3" /><div className="h-3 bg-muted rounded w-1/2 mt-2" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nenhum suplente encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <button key={s.id} onClick={() => openDetail(s)}
              className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <Users size={18} className="text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground text-sm truncate block">{s.nome}</span>
                <p className="text-xs text-muted-foreground truncate">
                  {s.partido || '—'} · {s.regiao_atuacao || '—'}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
