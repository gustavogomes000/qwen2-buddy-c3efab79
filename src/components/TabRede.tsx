import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronRight, ArrowLeft, Users, Shield, Eye, User, Phone, MessageCircle, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { maskCPF } from '@/lib/cpf';


interface SuplenteItem {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  telefone: string | null;
  partido: string | null;
}

interface PessoaFull {
  nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null;
  email: string | null; instagram: string | null; facebook: string | null;
  titulo_eleitor: string | null; zona_eleitoral: string | null; secao_eleitoral: string | null;
  municipio_eleitoral: string | null; uf_eleitoral: string | null; colegio_eleitoral: string | null;
  endereco_colegio: string | null; situacao_titulo: string | null; data_nascimento: string | null;
  observacoes_gerais: string | null;
}

interface LiderancaItem {
  id: string;
  status: string;
  tipo_lideranca: string | null;
  nivel: string | null;
  regiao_atuacao: string | null;
  zona_atuacao: string | null;
  bairros_influencia: string | null;
  apoiadores_estimados: number | null;
  meta_votos: number | null;
  nivel_comprometimento: string | null;
  observacoes: string | null;
  origem_captacao: string | null;
  criado_em: string | null;
  pessoas: PessoaFull | null;
  hierarquia_usuarios: { nome: string } | null;
}

interface FiscalItem {
  id: string;
  status: string;
  zona_fiscal: string | null;
  secao_fiscal: string | null;
  colegio_eleitoral: string | null;
  observacoes: string | null;
  origem_captacao: string | null;
  criado_em: string | null;
  pessoas: PessoaFull | null;
  hierarquia_usuarios: { nome: string } | null;
}

interface EleitorItem {
  id: string;
  compromisso_voto: string | null;
  observacoes: string | null;
  origem_captacao: string | null;
  criado_em: string | null;
  pessoas: PessoaFull | null;
  hierarquia_usuarios: { nome: string } | null;
  liderancas: { id: string; pessoas: { nome: string } | null } | null;
  fiscais: { id: string; pessoas: { nome: string } | null } | null;
}

type ViewMode = 'suplentes' | 'detail' | 'record';
type RecordType = 'lideranca' | 'fiscal' | 'eleitor';

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

export default function TabRede() {
  const { usuario, tipoUsuario } = useAuth();
  const isSuperAdmin = tipoUsuario === 'super_admin';
  const [mode, setMode] = useState<ViewMode>('suplentes');
  const [suplentes, setSuplenetes] = useState<SuplenteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Detail state
  const [selectedSuplente, setSelectedSuplente] = useState<SuplenteItem | null>(null);
  const [liderancas, setLiderancas] = useState<LiderancaItem[]>([]);
  const [fiscais, setFiscais] = useState<FiscalItem[]>([]);
  const [eleitores, setEleitores] = useState<EleitorItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Record detail state
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedRecordType, setSelectedRecordType] = useState<RecordType | null>(null);

  useEffect(() => { fetchSuplentes(); }, []);

  const fetchSuplentes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('buscar-suplentes');
      if (!error && data) setSuplenetes(data);
    } catch (err) { console.error('Erro ao buscar suplentes:', err); }
    setLoading(false);
  };

  const openSuplente = async (suplente: SuplenteItem) => {
    setSelectedSuplente(suplente);
    setMode('detail');
    setLoadingDetail(true);

    const { data: usuarios } = await supabase
      .from('hierarquia_usuarios').select('id')
      .eq('suplente_id', suplente.id).eq('ativo', true);
    const userIds = (usuarios || []).map(u => u.id);

    if (userIds.length === 0) {
      setLiderancas([]); setFiscais([]); setEleitores([]);
      setLoadingDetail(false);
      return;
    }

    const orFilter = `cadastrado_por.in.(${userIds.join(',')}),suplente_id.eq.${suplente.id}`;

    const [lRes, fRes, eRes] = await Promise.all([
      (supabase as any).from('liderancas')
        .select('id, status, tipo_lideranca, nivel, regiao_atuacao, zona_atuacao, bairros_influencia, apoiadores_estimados, meta_votos, nivel_comprometimento, observacoes, origem_captacao, criado_em, pessoas(*), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)')
        .or(orFilter).order('criado_em', { ascending: false }),
      (supabase as any).from('fiscais')
        .select('id, status, zona_fiscal, secao_fiscal, colegio_eleitoral, observacoes, origem_captacao, criado_em, pessoas(*), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome)')
        .or(orFilter).order('criado_em', { ascending: false }),
      (supabase as any).from('possiveis_eleitores')
        .select('id, compromisso_voto, observacoes, origem_captacao, criado_em, pessoas(*), hierarquia_usuarios!possiveis_eleitores_cadastrado_por_fkey(nome), liderancas(id, pessoas(nome)), fiscais(id, pessoas(nome))')
        .or(orFilter).order('criado_em', { ascending: false }),
    ]);

    setLiderancas((lRes.data || []) as LiderancaItem[]);
    setFiscais((fRes.data || []) as FiscalItem[]);
    setEleitores((eRes.data || []) as EleitorItem[]);
    setLoadingDetail(false);
  };

  const openRecord = (record: any, type: RecordType) => {
    setSelectedRecord(record);
    setSelectedRecordType(type);
    setMode('record');
  };

  const handleExport = async () => {
    if (!selectedSuplente) return;
    setExporting(true);
    try {
      const allRows: string[][] = [];
      const headers = ['Tipo', 'Nome', 'CPF', 'Telefone', 'WhatsApp', 'E-mail', 'Instagram', 'Facebook',
        'Título Eleitor', 'Zona', 'Seção', 'Município', 'UF', 'Colégio', 'End. Colégio', 'Situação Título',
        'Status', 'Cadastrado por', 'Data Cadastro', 'Detalhes'];
      allRows.push(headers);

      for (const l of liderancas) {
        const p = l.pessoas;
        allRows.push(['Liderança', p?.nome || '', p?.cpf || '', p?.telefone || '', p?.whatsapp || '',
          p?.email || '', p?.instagram || '', p?.facebook || '', p?.titulo_eleitor || '',
          p?.zona_eleitoral || '', p?.secao_eleitoral || '', p?.municipio_eleitoral || '',
          p?.uf_eleitoral || '', p?.colegio_eleitoral || '', p?.endereco_colegio || '',
          p?.situacao_titulo || '', l.status || '', l.hierarquia_usuarios?.nome || '',
          l.criado_em ? new Date(l.criado_em).toLocaleDateString('pt-BR') : '',
          [l.tipo_lideranca, l.nivel_comprometimento].filter(Boolean).join(' | ')]);
      }
      for (const f of fiscais) {
        const p = f.pessoas;
        allRows.push(['Fiscal', p?.nome || '', p?.cpf || '', p?.telefone || '', p?.whatsapp || '',
          p?.email || '', p?.instagram || '', p?.facebook || '', p?.titulo_eleitor || '',
          p?.zona_eleitoral || '', p?.secao_eleitoral || '', p?.municipio_eleitoral || '',
          p?.uf_eleitoral || '', p?.colegio_eleitoral || '', p?.endereco_colegio || '',
          p?.situacao_titulo || '', f.status || '', f.hierarquia_usuarios?.nome || '',
          f.criado_em ? new Date(f.criado_em).toLocaleDateString('pt-BR') : '',
          [f.zona_fiscal ? `Z${f.zona_fiscal}` : '', f.secao_fiscal ? `S${f.secao_fiscal}` : ''].filter(Boolean).join(' ')]);
      }
      for (const e of eleitores) {
        const p = e.pessoas;
        allRows.push(['Eleitor', p?.nome || '', p?.cpf || '', p?.telefone || '', p?.whatsapp || '',
          p?.email || '', p?.instagram || '', p?.facebook || '', p?.titulo_eleitor || '',
          p?.zona_eleitoral || '', p?.secao_eleitoral || '', p?.municipio_eleitoral || '',
          p?.uf_eleitoral || '', p?.colegio_eleitoral || '', p?.endereco_colegio || '',
          p?.situacao_titulo || '', e.compromisso_voto || '', e.hierarquia_usuarios?.nome || '',
          e.criado_em ? new Date(e.criado_em).toLocaleDateString('pt-BR') : '', '']);
      }

      // Generate CSV
      const csvContent = allRows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rede_${selectedSuplente.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
    setExporting(false);
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

  // ===== RECORD DETAIL VIEW =====
  if (mode === 'record' && selectedRecord && selectedRecordType) {
    const p: PessoaFull | null = selectedRecord.pessoas;
    const tipo = selectedRecordType;

    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setMode('detail')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        {/* Header */}
        <div className="section-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{p?.nome || '—'}</h2>
              <p className="text-sm text-muted-foreground">
                {tipo === 'lideranca' ? 'Liderança' : tipo === 'fiscal' ? 'Fiscal' : 'Eleitor'}
                {selectedRecord.origem_captacao === 'visita_comite' && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600">Visita</span>
                )}
              </p>
              {selectedRecord.hierarquia_usuarios?.nome && (
                <p className="text-[10px] text-primary/70 mt-1">
                  Por: {selectedRecord.hierarquia_usuarios.nome}
                  {selectedRecord.criado_em && ` · ${new Date(selectedRecord.criado_em).toLocaleDateString('pt-BR')}`}
                </p>
              )}
            </div>
            {tipo === 'eleitor' && compromissoBadge(selectedRecord.compromisso_voto)}
          </div>
          <div className="flex gap-2 pt-2">
            {p?.whatsapp && <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium"><MessageCircle size={14} /> WhatsApp</a>}
          </div>
        </div>

        {/* Dados Pessoais */}
        <div className="section-card">
          <h3 className="section-title">👤 Dados Pessoais</h3>
          <Info label="CPF" value={p?.cpf ? maskCPF(p.cpf) : null} />
          <Info label="WhatsApp" value={p?.whatsapp} />
          <Info label="E-mail" value={p?.email} link={p?.email ? `mailto:${p.email}` : undefined} />
          <Info label="Rede social" value={p?.instagram || p?.facebook} link={p?.instagram ? `https://instagram.com/${p.instagram.replace('@', '')}` : undefined} />
          <Info label="Nascimento" value={p?.data_nascimento ? new Date(p.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : null} />
        </div>

        {/* Dados Eleitorais */}
        <div className="section-card">
          <h3 className="section-title">🗳️ Dados Eleitorais</h3>
          <Info label="Título" value={p?.titulo_eleitor} />
          <Info label="Zona / Seção" value={p?.zona_eleitoral || p?.secao_eleitoral ? `${p?.zona_eleitoral || '—'} / ${p?.secao_eleitoral || '—'}` : null} />
          <Info label="Município / UF" value={p?.municipio_eleitoral || p?.uf_eleitoral ? `${p?.municipio_eleitoral || '—'} / ${p?.uf_eleitoral || '—'}` : null} />
          <Info label="Colégio" value={p?.colegio_eleitoral} />
          <Info label="End. colégio" value={p?.endereco_colegio} />
        </div>

        {/* Type-specific data */}
        {tipo === 'lideranca' && (
          <div className="section-card">
            <h3 className="section-title">⭐ Perfil da Liderança</h3>
            <Info label="Tipo" value={selectedRecord.tipo_lideranca} />
            <Info label="Nível" value={selectedRecord.nivel} />
            <Info label="Região" value={selectedRecord.regiao_atuacao} />
            <Info label="Zona atuação" value={selectedRecord.zona_atuacao} />
            <Info label="Bairros" value={selectedRecord.bairros_influencia} />
            <Info label="Possíveis votos" value={selectedRecord.apoiadores_estimados?.toString()} />
            <Info label="Meta votos" value={selectedRecord.meta_votos?.toString()} />
            <Info label="Comprometimento" value={selectedRecord.nivel_comprometimento} />
          </div>
        )}

        {tipo === 'fiscal' && (
          <div className="section-card">
            <h3 className="section-title">🛡️ Dados do Fiscal</h3>
            <Info label="Zona Fiscal" value={selectedRecord.zona_fiscal} />
            <Info label="Seção Fiscal" value={selectedRecord.secao_fiscal} />
            <Info label="Colégio" value={selectedRecord.colegio_eleitoral} />
          </div>
        )}

        {tipo === 'eleitor' && (selectedRecord.liderancas || selectedRecord.fiscais) && (
          <div className="section-card">
            <h3 className="section-title">🔗 Vinculado a</h3>
            {selectedRecord.liderancas?.pessoas?.nome && <Info label="Liderança" value={selectedRecord.liderancas.pessoas.nome} />}
            {selectedRecord.fiscais?.pessoas?.nome && <Info label="Fiscal" value={selectedRecord.fiscais.pessoas.nome} />}
          </div>
        )}

        {/* Observações */}
        {(selectedRecord.observacoes || p?.observacoes_gerais) && (
          <div className="section-card">
            <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
              {selectedRecord.observacoes || p?.observacoes_gerais}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ===== DETAIL VIEW (Suplente network) =====
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

        {/* Export button for super_admin */}
        {isSuperAdmin && (totalL + totalF + totalE) > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full h-11 border border-primary/30 rounded-xl text-primary font-medium flex items-center justify-center gap-2 active:scale-[0.97] bg-primary/5"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Exportando...' : 'Exportar Rede (CSV)'}
          </button>
        )}

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
                    <button key={l.id} onClick={() => openRecord(l, 'lideranca')}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card/50 active:scale-[0.98] transition-transform">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{l.pessoas?.nome || '—'}</span>
                          
                          {l.origem_captacao === 'visita_comite' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[l.pessoas?.cpf ? maskCPF(l.pessoas.cpf) : null, l.pessoas?.telefone].filter(Boolean).join(' · ') || l.tipo_lideranca || '—'}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
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
                    <button key={f.id} onClick={() => openRecord(f, 'fiscal')}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card/50 active:scale-[0.98] transition-transform">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{f.pessoas?.nome || '—'}</span>
                          
                          {f.origem_captacao === 'visita_comite' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[f.pessoas?.cpf ? maskCPF(f.pessoas.cpf) : null, f.pessoas?.telefone].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
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
                    <button key={e.id} onClick={() => openRecord(e, 'eleitor')}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border border-border bg-card/50 active:scale-[0.98] transition-transform">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">{e.pessoas?.nome || '—'}</span>
                          {compromissoBadge(e.compromisso_voto)}
                          {e.origem_captacao === 'visita_comite' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {[e.pessoas?.cpf ? maskCPF(e.pessoas.cpf) : null, e.pessoas?.telefone].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
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
