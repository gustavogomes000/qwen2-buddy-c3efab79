import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronRight, ArrowLeft, Users, Shield, Eye, User, Phone, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';

interface SuplenteItem {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
}

interface LiderancaItem {
  id: string;
  status: string;
  tipo_lideranca: string | null;
  origem_captacao: string | null;
  pessoas: { nome: string; telefone: string | null; whatsapp: string | null } | null;
}

interface FiscalItem {
  id: string;
  status: string;
  zona_fiscal: string | null;
  secao_fiscal: string | null;
  origem_captacao: string | null;
  pessoas: { nome: string; telefone: string | null; whatsapp: string | null } | null;
}

interface EleitorItem {
  id: string;
  compromisso_voto: string | null;
  origem_captacao: string | null;
  pessoas: { nome: string; telefone: string | null; whatsapp: string | null } | null;
}

type ViewMode = 'suplentes' | 'detail';

export default function TabRede() {
  const { usuario } = useAuth();
  const [mode, setMode] = useState<ViewMode>('suplentes');
  const [suplentes, setSuplenetes] = useState<SuplenteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail state
  const [selectedSuplente, setSelectedSuplente] = useState<SuplenteItem | null>(null);
  const [liderancas, setLiderancas] = useState<LiderancaItem[]>([]);
  const [fiscais, setFiscais] = useState<FiscalItem[]>([]);
  const [eleitores, setEleitores] = useState<EleitorItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchSuplentes();
  }, []);

  const fetchSuplentes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('buscar-suplentes');
      if (!error && data) setSuplenetes(data);
    } catch (err) {
      console.error('Erro ao buscar suplentes:', err);
    }
    setLoading(false);
  };

  const openSuplente = async (suplente: SuplenteItem) => {
    setSelectedSuplente(suplente);
    setMode('detail');
    setLoadingDetail(true);

    // Fetch all data linked to this suplente
    const [lRes, fRes, eRes] = await Promise.all([
      supabase.from('liderancas').select('id, status, tipo_lideranca, origem_captacao, pessoas(nome, telefone, whatsapp)').eq('suplente_id', suplente.id).order('criado_em', { ascending: false }),
      supabase.from('fiscais').select('id, status, zona_fiscal, secao_fiscal, origem_captacao, pessoas(nome, telefone, whatsapp)').eq('suplente_id', suplente.id).order('criado_em', { ascending: false }),
      supabase.from('possiveis_eleitores').select('id, compromisso_voto, origem_captacao, pessoas(nome, telefone, whatsapp)').eq('suplente_id', suplente.id).order('criado_em', { ascending: false }),
    ]);

    setLiderancas((lRes.data || []) as unknown as LiderancaItem[]);
    setFiscais((fRes.data || []) as unknown as FiscalItem[]);
    setEleitores((eRes.data || []) as unknown as EleitorItem[]);
    setLoadingDetail(false);
  };

  const filtered = suplentes.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.nome.toLowerCase().includes(q) || (s.regiao_atuacao || '').toLowerCase().includes(q);
  });

  const compromissoBadge = (c: string | null) => {
    const colors: Record<string, string> = {
      'Confirmado': 'bg-emerald-500/10 text-emerald-600',
      'Provável': 'bg-blue-500/10 text-blue-600',
      'Indefinido': 'bg-amber-500/10 text-amber-600',
      'Improvável': 'bg-red-500/10 text-red-600',
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[c || ''] || 'bg-muted text-muted-foreground'}`}>{c || '—'}</span>;
  };

  // ===== DETAIL VIEW =====
  if (mode === 'detail' && selectedSuplente) {
    const s = selectedSuplente;
    const totalL = liderancas.length;
    const totalF = fiscais.length;
    const totalE = eleitores.length;
    const confirmados = eleitores.filter(e => e.compromisso_voto === 'Confirmado').length;

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => { setMode('suplentes'); setSelectedSuplente(null); }} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        {/* Suplente header */}
        <div className="section-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{s.nome}</h2>
              <p className="text-xs text-muted-foreground">
                {s.partido || 'Suplente'}{s.regiao_atuacao ? ` · ${s.regiao_atuacao}` : ''}
              </p>
            </div>
          </div>
          {s.telefone && (
            <div className="flex gap-2 pt-2">
              <a href={`tel:${s.telefone}`} className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-lg text-xs font-medium"><Phone size={14} /> {s.telefone}</a>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Users, label: 'Lideranças', value: totalL, color: 'text-blue-500' },
            { icon: Shield, label: 'Fiscais', value: totalF, color: 'text-purple-500' },
            { icon: Eye, label: 'Eleitores', value: totalE, color: 'text-amber-500' },
            { icon: Eye, label: 'Confirm.', value: confirmados, color: 'text-emerald-500' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-2 text-center">
              <Icon size={14} className={`${color} mx-auto mb-1`} />
              <p className="text-base font-bold text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Lideranças */}
            <div className="section-card">
              <h3 className="section-title flex items-center gap-2">
                <Users size={16} className="text-blue-500" /> Lideranças ({totalL})
              </h3>
              {liderancas.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma liderança cadastrada</p>
              ) : (
                <div className="space-y-1.5">
                  {liderancas.map(l => (
                    <div key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{l.pessoas?.nome || '—'}</span>
                          <StatusBadge status={l.status} />
                          {l.origem_captacao === 'visita_comite' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{l.tipo_lideranca || '—'}</p>
                      </div>
                      {l.pessoas?.whatsapp && (
                        <a href={`https://wa.me/55${l.pessoas.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="p-1.5 text-emerald-500">
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fiscais */}
            <div className="section-card">
              <h3 className="section-title flex items-center gap-2">
                <Shield size={16} className="text-purple-500" /> Fiscais ({totalF})
              </h3>
              {fiscais.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum fiscal cadastrado</p>
              ) : (
                <div className="space-y-1.5">
                  {fiscais.map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{f.pessoas?.nome || '—'}</span>
                          <StatusBadge status={f.status} />
                          {f.origem_captacao === 'visita_comite' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {f.zona_fiscal ? `Z${f.zona_fiscal}` : ''}{f.secao_fiscal ? ` S${f.secao_fiscal}` : ''}
                        </p>
                      </div>
                      {f.pessoas?.whatsapp && (
                        <a href={`https://wa.me/55${f.pessoas.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="p-1.5 text-emerald-500">
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Eleitores */}
            <div className="section-card">
              <h3 className="section-title flex items-center gap-2">
                <Eye size={16} className="text-amber-500" /> Possíveis Eleitores ({totalE})
              </h3>
              {eleitores.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum eleitor cadastrado</p>
              ) : (
                <div className="space-y-1.5">
                  {eleitores.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{e.pessoas?.nome || '—'}</span>
                          {compromissoBadge(e.compromisso_voto)}
                          {e.origem_captacao === 'visita_comite' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                          )}
                        </div>
                      </div>
                      {e.pessoas?.whatsapp && (
                        <a href={`https://wa.me/55${e.pessoas.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="p-1.5 text-emerald-500">
                          <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ===== SUPLENTES LIST =====
  return (
    <div className="space-y-3 pb-24">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
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
            <button key={s.id} onClick={() => openSuplente(s)}
              className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{s.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground text-sm truncate block">{s.nome}</span>
                <p className="text-xs text-muted-foreground truncate">
                  {s.partido || 'Suplente'}{s.regiao_atuacao ? ` · ${s.regiao_atuacao}` : ''}
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
