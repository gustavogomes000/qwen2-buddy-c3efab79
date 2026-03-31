import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, Loader2, ChevronRight, ChevronDown, User, Users, Shield, Eye, Crown, UserCircle,
  Phone, MessageCircle, ArrowLeft, MapPin
} from 'lucide-react';

interface HierarchyUser {
  id: string;
  nome: string;
  tipo: string;
  superior_id: string | null;
  suplente_id: string | null;
}

interface SuplenteInfo {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
}

interface CadastroItem {
  id: string;
  tipo: 'lideranca' | 'fiscal' | 'eleitor';
  nome: string;
  status: string | null;
  telefone: string | null;
  whatsapp: string | null;
  detalhes: string;
  cadastrado_por: string | null;
}

const tipoConfig: Record<string, { icon: typeof User; color: string; label: string }> = {
  super_admin: { icon: Crown, color: 'text-amber-500', label: 'Super Admin' },
  coordenador: { icon: Shield, color: 'text-blue-500', label: 'Coordenador' },
  suplente: { icon: User, color: 'text-purple-500', label: 'Suplente' },
  lideranca: { icon: Users, color: 'text-emerald-500', label: 'Liderança' },
  fiscal: { icon: Eye, color: 'text-rose-500', label: 'Fiscal' },
};

export default function TabHierarquia() {
  const { isAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<HierarchyUser[]>([]);
  const [suplentes, setSuplentes] = useState<SuplenteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<HierarchyUser | null>(null);
  const [userCadastros, setUserCadastros] = useState<CadastroItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [usrRes, supRes] = await Promise.all([
      supabase.from('hierarquia_usuarios').select('id, nome, tipo, superior_id, suplente_id').eq('ativo', true).order('nome'),
      supabase.functions.invoke('buscar-suplentes'),
    ]);
    setUsuarios((usrRes.data || []) as HierarchyUser[]);
    if (!supRes.error && supRes.data) setSuplentes(supRes.data);
    setLoading(false);
  };

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getChildren = (parentId: string) => usuarios.filter(u => u.superior_id === parentId);
  const roots = useMemo(() => usuarios.filter(u => !u.superior_id), [usuarios]);

  const getSuplenteNome = (sid: string | null) => {
    if (!sid) return null;
    return suplentes.find(s => s.id === sid)?.nome || null;
  };

  const openUserDetail = async (user: HierarchyUser) => {
    setSelectedUser(user);
    setLoadingDetail(true);

    const cadastros: CadastroItem[] = [];

    const [lRes, fRes, eRes] = await Promise.all([
      supabase.from('liderancas').select('id, status, tipo_lideranca, pessoas(nome, telefone, whatsapp)').eq('cadastrado_por', user.id).order('criado_em', { ascending: false }).limit(100),
      supabase.from('fiscais').select('id, status, zona_fiscal, secao_fiscal, pessoas(nome, telefone, whatsapp)').eq('cadastrado_por', user.id).order('criado_em', { ascending: false }).limit(100),
      supabase.from('possiveis_eleitores').select('id, compromisso_voto, pessoas(nome, telefone, whatsapp)').eq('cadastrado_por', user.id).order('criado_em', { ascending: false }).limit(100),
    ]);

    (lRes.data || []).forEach((l: any) => cadastros.push({
      id: l.id, tipo: 'lideranca', nome: l.pessoas?.nome || '—', status: l.status,
      telefone: l.pessoas?.telefone, whatsapp: l.pessoas?.whatsapp,
      detalhes: l.tipo_lideranca || '—', cadastrado_por: user.id,
    }));
    (fRes.data || []).forEach((f: any) => cadastros.push({
      id: f.id, tipo: 'fiscal', nome: f.pessoas?.nome || '—', status: f.status,
      telefone: f.pessoas?.telefone, whatsapp: f.pessoas?.whatsapp,
      detalhes: `Z${f.zona_fiscal || '—'} S${f.secao_fiscal || '—'}`, cadastrado_por: user.id,
    }));
    (eRes.data || []).forEach((e: any) => cadastros.push({
      id: e.id, tipo: 'eleitor', nome: e.pessoas?.nome || '—', status: e.compromisso_voto,
      telefone: e.pessoas?.telefone, whatsapp: e.pessoas?.whatsapp,
      detalhes: e.compromisso_voto || 'Indefinido', cadastrado_por: user.id,
    }));

    setUserCadastros(cadastros);
    setLoadingDetail(false);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    return usuarios.filter(u => u.nome.toLowerCase().includes(q));
  }, [searchQuery, usuarios]);

  // Detail view
  if (selectedUser) {
    const user = selectedUser;
    const config = tipoConfig[user.tipo] || tipoConfig.lideranca;
    const Icon = config.icon;
    const totalL = userCadastros.filter(c => c.tipo === 'lideranca').length;
    const totalF = userCadastros.filter(c => c.tipo === 'fiscal').length;
    const totalE = userCadastros.filter(c => c.tipo === 'eleitor').length;
    const supNome = getSuplenteNome(user.suplente_id);

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setSelectedUser(null)} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0`}>
            <Icon size={28} className={config.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground">{user.nome}</h2>
            <p className="text-xs text-muted-foreground">
              <span className={`font-semibold ${config.color}`}>{config.label}</span>
              {supNome && <> · Suplente: {supNome}</>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Lideranças', value: totalL, color: 'text-blue-500', icon: Users },
            { label: 'Fiscais', value: totalF, color: 'text-purple-500', icon: Shield },
            { label: 'Eleitores', value: totalE, color: 'text-amber-500', icon: Eye },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-2.5 text-center">
              <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {loadingDetail ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : userCadastros.length === 0 ? (
          <div className="section-card text-center py-6">
            <p className="text-sm text-muted-foreground">Nenhum cadastro realizado por este usuário</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userCadastros.map(c => {
              const typeConfig = c.tipo === 'lideranca' 
                ? { bg: 'bg-blue-500/10', textColor: 'text-blue-600', label: 'Lid.' }
                : c.tipo === 'fiscal'
                ? { bg: 'bg-purple-500/10', textColor: 'text-purple-600', label: 'Fisc.' }
                : { bg: 'bg-amber-500/10', textColor: 'text-amber-600', label: 'Eleit.' };

              return (
                <div key={`${c.tipo}-${c.id}`} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${typeConfig.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-[10px] font-bold ${typeConfig.textColor}`}>{typeConfig.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{c.detalhes} · {c.status || '—'}</p>
                  </div>
                  {c.whatsapp && (
                    <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                      className="p-1.5 text-emerald-500 shrink-0">
                      <MessageCircle size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Tree node
  const renderNode = (user: HierarchyUser, depth: number = 0) => {
    const children = getChildren(user.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(user.id);
    const config = tipoConfig[user.tipo] || tipoConfig.lideranca;
    const Icon = config.icon;
    const supNome = getSuplenteNome(user.suplente_id);

    return (
      <div key={user.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted/50 active:scale-[0.98] transition-all cursor-pointer"
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggle(user.id)} className="shrink-0 p-0.5">
              {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <button onClick={() => openUserDetail(user)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <div className={`w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0`}>
              <Icon size={14} className={config.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.nome}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                <span className={config.color}>{config.label}</span>
                {supNome && <> · {supNome}</>}
              </p>
            </div>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="border-l border-border/50" style={{ marginLeft: `${depth * 20 + 24}px` }}>
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const tipoCounts = usuarios.reduce((acc, u) => {
    acc[u.tipo] = (acc[u.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-3 pb-24">
      {/* Stats */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {Object.entries(tipoCounts).map(([tipo, count]) => {
          const config = tipoConfig[tipo] || tipoConfig.lideranca;
          return (
            <div key={tipo} className="bg-card rounded-xl border border-border px-3 py-2 text-center shrink-0">
              <p className={`text-base font-bold ${config.color}`}>{count}</p>
              <p className="text-[9px] text-muted-foreground">{config.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar usuário..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Tree or search results */}
      <div className="section-card !p-2">
        {filteredUsers ? (
          filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
          ) : (
            filteredUsers.map(u => renderNode(u, 0))
          )
        ) : roots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
        ) : (
          roots.map(u => renderNode(u, 0))
        )}
      </div>
    </div>
  );
}
