import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, ChevronRight, Phone, MessageCircle, Trash2, ArrowLeft, XCircle, Download, Loader2, ExternalLink, PlusCircle } from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLiderancas, useInvalidarCadastros } from '@/hooks/useDataCache';
import { useCidade } from '@/contexts/CidadeContext';
import { formatCPF, cleanCPF, validateCPF } from '@/lib/cpf';

import { resolverLigacaoPolitica } from '@/lib/resolverLigacaoPolitica';
import { toast } from '@/hooks/use-toast';

import CampoLigacaoPolitica from '@/components/CampoLigacaoPolitica';
import SkeletonLista from '@/components/SkeletonLista';

const comprometimentos = ['Alto', 'Médio', 'Baixo'];
const situacoesTitulo = ['Regular', 'Cancelado', 'Suspenso', 'Não informado'];

const emptyForm = {
  cpf: '', nome: '', telefone: '', whatsapp: '', email: '',
  instagram: '', facebook: '',
  titulo_eleitor: '', zona_eleitoral: '', secao_eleitoral: '',
  municipio_eleitoral: '', uf_eleitoral: 'GO', colegio_eleitoral: '',
  endereco_colegio: '', situacao_titulo: '',
  tipo_lideranca: '', nivel: '', regiao_atuacao: '',
  zona_atuacao: '', bairros_influencia: '', comunidades_influencia: '',
  lider_principal_id: '', origem_captacao: '',
  apoiadores_estimados: '', meta_votos: '',
  status: 'Ativa', nivel_comprometimento: '', observacoes: '',
};

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
  onSaved?: () => void;
  viewOnly?: boolean;
}

export default function TabLiderancas({ refreshKey, onSaved, viewOnly }: Props) {
  const { usuario, isAdmin, tipoUsuario, municipioId: authMunicipioId } = useAuth();
  const { cidadeAtiva, isTodasCidades, nomeMunicipioPorId } = useCidade();
  const { data: cachedData, isLoading: cacheLoading, refetch: refetchCache } = useLiderancas();
  const invalidarCadastros = useInvalidarCadastros();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [data, setData] = useState<LiderancaRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<LiderancaRow | null>(null);
  const [temMais, setTemMais] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const paginaRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [liderancasExistentes, setLiderancasExistentes] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState({ ...emptyForm });

  // Ligação política state
  const [ligBloqueado, setLigBloqueado] = useState(false);
  const [ligNomeFixo, setLigNomeFixo] = useState<string | null>(null);
  const [ligSubtitulo, setLigSubtitulo] = useState<string | null>(null);
  const [ligSuplenteId, setLigSuplenteId] = useState<string | null>(null);
  const [ligLiderancaId, setLigLiderancaId] = useState<string | null>(null);
  const [ligMunicipioId, setLigMunicipioId] = useState<string | null>(null);
  const [ligErro, setLigErro] = useState<string | null>(null);

  const update = useCallback((field: string, value: string) => setForm(f => ({ ...f, [field]: value })), []);

  // Resolver ligação política do usuário logado
  useEffect(() => {
    if (!usuario) return;
    resolverLigacaoPolitica(usuario).then(res => {
      setLigBloqueado(res.bloqueado);
      setLigNomeFixo(res.nomeFixo);
      setLigSubtitulo(res.subtitulo);
      setLigSuplenteId(res.suplenteId);
      setLigMunicipioId(res.municipioId);
      if (res.liderancaId) setLigLiderancaId(res.liderancaId);
    });
  }, [usuario]);

  // Use cached data from React Query
  useEffect(() => {
    if (cachedData) {
      setData(cachedData as unknown as LiderancaRow[]);
      setLoading(false);
      setTemMais(false); // cached data already has all rows
    }
  }, [cachedData]);

  useEffect(() => {
    if (cacheLoading) setLoading(true);
  }, [cacheLoading]);

  // Refetch on refreshKey change
  useEffect(() => {
    if (refreshKey > 0) {
      invalidarCadastros();
    }
  }, [refreshKey, invalidarCadastros]);


  useEffect(() => {
    supabase.from('liderancas').select('id, pessoas(nome)').eq('status', 'Ativa')
      .then(({ data }) => {
        if (data) setLiderancasExistentes(data.map((l: any) => ({ id: l.id, nome: l.pessoas?.nome || '—' })));
      });
  }, [isAdmin]);

  const handleCPFChange = (value: string) => {
    const cleaned = cleanCPF(value);
    update('cpf', cleaned);
  };

  const getSuplementeId = (): string | null => {
    if (!usuario) return null;
    if (usuario.tipo === 'suplente') return usuario.suplente_id;
    return usuario.suplente_id || null;
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: 'Preencha o nome', variant: 'destructive' }); return; }
    if (!form.cpf || form.cpf.length !== 11) { toast({ title: 'Informe o CPF', variant: 'destructive' }); return; }
    if (form.cpf.length === 11 && !validateCPF(form.cpf)) { toast({ title: 'CPF inválido', variant: 'destructive' }); return; }
    if (!form.whatsapp.trim()) { toast({ title: 'Informe o WhatsApp', variant: 'destructive' }); return; }
    if (!form.instagram.trim()) { toast({ title: 'Informe a rede social', variant: 'destructive' }); return; }
    if (!form.titulo_eleitor.trim()) { toast({ title: 'Informe o título de eleitor', variant: 'destructive' }); return; }
    if (!form.zona_eleitoral.trim()) { toast({ title: 'Informe a zona eleitoral', variant: 'destructive' }); return; }
    if (!form.secao_eleitoral.trim()) { toast({ title: 'Informe a seção eleitoral', variant: 'destructive' }); return; }
    if (!form.municipio_eleitoral.trim()) { toast({ title: 'Informe o município eleitoral', variant: 'destructive' }); return; }
    if (!form.colegio_eleitoral.trim()) { toast({ title: 'Informe o colégio eleitoral', variant: 'destructive' }); return; }
    if (!form.regiao_atuacao.trim()) { toast({ title: 'Informe a região de atuação', variant: 'destructive' }); return; }
    if (!form.meta_votos.trim()) { toast({ title: 'Informe quantos votos pode trazer', variant: 'destructive' }); return; }
    if (!form.nivel_comprometimento) { toast({ title: 'Selecione o comprometimento', variant: 'destructive' }); return; }

    // Coordenadores: bloquear CPF duplicado
    if (tipoUsuario === 'coordenador' && form.cpf && form.cpf.length === 11) {
      const { data: cpfExiste } = await supabase.from('pessoas').select('id').eq('cpf', form.cpf).limit(1);
      if (cpfExiste && cpfExiste.length > 0) {
        toast({ title: 'CPF já cadastrado', description: 'Este CPF já existe no sistema.', variant: 'destructive' });
        return;
      }
    }

    // Validar ligação política obrigatória para avulsos
    if (!ligBloqueado && tipoUsuario !== 'super_admin' && tipoUsuario !== 'coordenador' && !ligSuplenteId && !ligLiderancaId) {
      setLigErro('Selecione um suplente ou liderança');
      toast({ title: 'Selecione uma ligação política', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data: novaPessoa, error } = await supabase.from('pessoas').insert({
        cpf: form.cpf || null, nome: form.nome, telefone: form.telefone || null,
        whatsapp: form.whatsapp || null, email: form.email || null,
        instagram: form.instagram || null, facebook: form.facebook || null,
        titulo_eleitor: form.titulo_eleitor || null, zona_eleitoral: form.zona_eleitoral || null,
        secao_eleitoral: form.secao_eleitoral || null, municipio_eleitoral: form.municipio_eleitoral || null,
        uf_eleitoral: form.uf_eleitoral || null, colegio_eleitoral: form.colegio_eleitoral || null,
        endereco_colegio: form.endereco_colegio || null, situacao_titulo: form.situacao_titulo || null,
      }).select('id').single();
      if (error) throw error;
      const pessoaId = novaPessoa!.id;

      const suplenteId = ligSuplenteId || getSuplementeId();
      const { error: lError } = await (supabase as any).from('liderancas').insert({
        pessoa_id: pessoaId, tipo_lideranca: form.tipo_lideranca || null,
        nivel: form.nivel || null, regiao_atuacao: form.regiao_atuacao || null,
        zona_atuacao: form.zona_atuacao || null, bairros_influencia: form.bairros_influencia || null,
        comunidades_influencia: form.comunidades_influencia || null,
        lider_principal_id: form.lider_principal_id || null,
        origem_captacao: form.origem_captacao || null,
        apoiadores_estimados: form.apoiadores_estimados ? parseInt(form.apoiadores_estimados) : null,
        meta_votos: form.meta_votos ? parseInt(form.meta_votos) : null,
        status: form.status, nivel_comprometimento: form.nivel_comprometimento || null,
        observacoes: form.observacoes || null,
        cadastrado_por: usuario?.id || null,
        suplente_id: suplenteId,
        municipio_id: ligMunicipioId || null,
      });
      if (lError) throw lError;

      toast({ title: '✅ Liderança cadastrada!' });
      setForm({ ...emptyForm });
      setMode('list');
      invalidarCadastros();
      onSaved?.();
      setMode('list');
      invalidarCadastros();
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const filtered = useMemo(() => data.filter(l => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nome = l.pessoas?.nome?.toLowerCase() || '';
      const cpf = l.pessoas?.cpf || '';
      const wpp = l.pessoas?.whatsapp || '';
      if (!nome.includes(q) && !cpf.includes(q) && !wpp.includes(q)) return false;
    }
    return true;
  }), [data, searchQuery]);

  const QUERY_DETALHE = 'id, status, tipo_lideranca, nivel, zona_atuacao, apoiadores_estimados, cadastrado_por, suplente_id, criado_em, regiao_atuacao, bairros_influencia, comunidades_influencia, origem_captacao, meta_votos, nivel_comprometimento, observacoes, municipio_id, pessoas(*), hierarquia_usuarios!liderancas_cadastrado_por_fkey(nome)';

  const fetchDetalhe = useCallback(async (id: string) => {
    const { data } = await (supabase as any).from('liderancas').select(QUERY_DETALHE).eq('id', id).single();
    if (data) setSelected(data as unknown as LiderancaRow);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta liderança permanentemente?')) return;
    await supabase.from('liderancas').delete().eq('id', id);
    toast({ title: 'Liderança excluída' });
    setSelected(null);
    setMode('list');
    invalidarCadastros();
  };

  const handleDiscard = async (id: string) => {
    await supabase.from('liderancas').update({ status: 'Descartada', atualizado_em: new Date().toISOString() }).eq('id', id);
    toast({ title: 'Liderança descartada' });
    setSelected(null);
    setMode('list');
    invalidarCadastros();
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const textareaCls = "w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none";
  

  const Info = ({ label, value, link }: { label: string; value?: string | null; link?: string }) => {
    const display = value && value.trim() ? value : '—';
    return (
      <div className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
        <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
        {link && display !== '—' ? <a href={link} target="_blank" rel="noopener" className="text-sm text-primary text-right ml-2">{display}</a>
          : <span className={`text-sm text-right ml-2 break-words ${display === '—' ? 'text-muted-foreground' : 'text-foreground'}`}>{display}</span>}
      </div>
    );
  };

  // ===== DETAIL VIEW =====
  if (mode === 'detail' && selected) {
    const l = selected;
    const p = l.pessoas;
    return (
      <div key="detail" className="space-y-4 pb-24">
        <button onClick={() => { setSelected(null); setMode('list'); }} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
              <p className="text-sm text-muted-foreground">{l.tipo_lideranca}{l.nivel ? ` · ${l.nivel}` : ''}</p>
              {isAdmin && l.hierarquia_usuarios && (
                <p className="text-[10px] text-primary/70 mt-1">Por: {l.hierarquia_usuarios.nome} · {new Date(l.criado_em).toLocaleDateString('pt-BR')}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            {p.whatsapp && <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium"><MessageCircle size={14} /> WhatsApp</a>}
          </div>
        </div>
        <div className="section-card">
          <h3 className="section-title">👤 Dados Pessoais</h3>
          <Info label="CPF" value={p.cpf ? formatCPF(p.cpf) : null} />
          <Info label="WhatsApp" value={p.whatsapp} />
          <Info label="Rede social" value={p.instagram || p.facebook} link={p.instagram ? `https://instagram.com/${p.instagram.replace('@', '')}` : undefined} />
        </div>
        <div className="section-card">
          <h3 className="section-title">🗳️ Dados Eleitorais</h3>
          <Info label="Título" value={p.titulo_eleitor} />
          <Info label="Zona / Seção" value={`${p.zona_eleitoral || '—'} / ${p.secao_eleitoral || '—'}`} />
          <Info label="Município / UF" value={`${p.municipio_eleitoral || '—'} / ${p.uf_eleitoral || '—'}`} />
          <Info label="Colégio" value={p.colegio_eleitoral} />
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
          <Info label="Possíveis votos" value={l.apoiadores_estimados?.toString()} />
          <Info label="Quantos votos pode trazer" value={l.meta_votos?.toString()} />
          <Info label="Comprometimento" value={l.nivel_comprometimento} />
          <Info label="Observações" value={l.observacoes} />
        </div>
        <div className="space-y-2">
          {isAdmin && l.status !== 'Descartada' && (
            <button onClick={() => handleDiscard(l.id)} className="w-full h-11 border border-border rounded-xl text-muted-foreground font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
              <XCircle size={16} /> Descartar
            </button>
          )}
          {isAdmin && (
            <button onClick={() => handleDelete(l.id)} className="w-full h-11 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
              <Trash2 size={16} /> Excluir
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== FORM VIEW =====
  if (mode === 'form' && !viewOnly) {
    return (
      <div key="form" className="space-y-4 pb-24">
        <button data-testid="btn-voltar" onClick={() => setMode('list')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <h2 className="section-title">👤 Dados Pessoais</h2>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome completo <span className="text-primary">*</span></label>
            <input type="text" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Nome da liderança" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              CPF <span className="text-primary">*</span>
            </label>
            <input type="text" inputMode="numeric" value={formatCPF(form.cpf)} onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00" className={inputCls} maxLength={14} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">WhatsApp <span className="text-primary">*</span></label>
            <input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rede social <span className="text-primary">*</span></label>
            <input type="text" value={form.instagram} onChange={e => update('instagram', e.target.value)} placeholder="Instagram ou Facebook (@ ou link)" className={inputCls} />
          </div>
        </div>

        <div className="section-card">
          <h2 className="section-title">🗳️ Dados Eleitorais</h2>
          <button type="button" onClick={() => window.open('https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor', '_blank')}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 border border-border rounded-xl text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 active:scale-[0.97] transition-all">
            <ExternalLink size={16} /> Consultar dados no TSE
          </button>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Título de eleitor <span className="text-primary">*</span></label><input type="text" value={form.titulo_eleitor} onChange={e => update('titulo_eleitor', e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Zona <span className="text-primary">*</span></label><input type="text" value={form.zona_eleitoral} onChange={e => update('zona_eleitoral', e.target.value)} className={inputCls} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Seção <span className="text-primary">*</span></label><input type="text" value={form.secao_eleitoral} onChange={e => update('secao_eleitoral', e.target.value)} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1"><label className="text-xs font-medium text-muted-foreground">Município <span className="text-primary">*</span></label><input type="text" value={form.municipio_eleitoral} onChange={e => update('municipio_eleitoral', e.target.value)} className={inputCls} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">UF</label><input type="text" value="GO" readOnly className={`${inputCls} bg-muted cursor-not-allowed`} /></div>
          </div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Colégio eleitoral <span className="text-primary">*</span></label><input type="text" value={form.colegio_eleitoral} onChange={e => update('colegio_eleitoral', e.target.value)} className={inputCls} /></div>
        </div>

        <div className="section-card">
          <h2 className="section-title">⭐ Perfil e Status</h2>
          
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Região de atuação <span className="text-primary">*</span></label><textarea value={form.regiao_atuacao} onChange={e => update('regiao_atuacao', e.target.value)} rows={2} placeholder="Ex: Setor Bueno, Jardim América..." className={textareaCls} /></div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Quantos votos pode trazer <span className="text-primary">*</span></label><input type="number" value={form.meta_votos} onChange={e => update('meta_votos', e.target.value)} placeholder="Ex: 500" className={inputCls} /></div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Comprometimento <span className="text-primary">*</span></label>
            <select value={form.nivel_comprometimento} onChange={e => update('nivel_comprometimento', e.target.value)} className={selectCls}>
              <option value="">Selecione...</option>
              {comprometimentos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Observações</label><textarea value={form.observacoes} onChange={e => update('observacoes', e.target.value)} rows={3} className={textareaCls} /></div>
        </div>

        <CampoLigacaoPolitica
          bloqueado={ligBloqueado}
          nomeFixo={ligNomeFixo}
          subtituloFixo={ligSubtitulo}
          suplenteIdSelecionado={ligSuplenteId}
          liderancaIdSelecionada={ligLiderancaId}
          onSuplenteChange={(id, _nome, munId) => { setLigSuplenteId(id); setLigLiderancaId(null); setLigMunicipioId(munId); setLigErro(null); }}
          onLiderancaChange={(id, _nome, supId, munId) => { setLigLiderancaId(id); setLigSuplenteId(supId); setLigMunicipioId(munId); setLigErro(null); }}
          obrigatorio={tipoUsuario !== 'super_admin' && tipoUsuario !== 'coordenador'}
          erro={ligErro}
          cidadeAtivaId={cidadeAtiva?.id || null}
        />

        <button data-testid="btn-salvar-lideranca" onClick={handleSave} disabled={saving}
          className="w-full h-14 gradient-primary text-white text-base font-semibold rounded-2xl shadow-lg shadow-pink-500/25 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Salvando...</> : '✅ Cadastrar Liderança'}
        </button>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-3 pb-24">
      {!viewOnly && (
        <button data-testid="btn-cadastrar-lideranca" onClick={() => { setForm({ ...emptyForm }); setMode('form'); }}
          className="w-full h-12 gradient-primary text-white font-semibold rounded-xl active:scale-[0.97] transition-all flex items-center justify-center gap-2">
          <PlusCircle size={18} /> Cadastrar Liderança
        </button>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="input-busca-lideranca" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nome, CPF ou WhatsApp..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
      </div>



      {isAdmin && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Total', value: data.length },
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

      <button onClick={() => exportAllCadastros('lideranca')}
        className="w-full h-9 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-[0.97] transition-all">
        <Download size={14} /> Exportar Lideranças (Excel)
      </button>

      {loading ? (
        <SkeletonLista />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Nenhuma liderança encontrada</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <button key={l.id} onClick={() => { fetchDetalhe(l.id); setMode('detail'); }}
              className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm truncate">{l.pessoas?.nome || '—'}</span>
                  
                  {(l as any).origem_captacao === 'visita_comite' && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                  )}
                </div>
                {l.regiao_atuacao && (
                  <p className="text-[10px] text-muted-foreground truncate">{l.regiao_atuacao}</p>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {l.tipo_lideranca || ''}{l.zona_atuacao ? `${l.tipo_lideranca ? ' · ' : ''}Z${l.zona_atuacao}` : ''}
                  {l.apoiadores_estimados ? ` · ${l.apoiadores_estimados} apoiadores` : ''}
                </p>
                {isAdmin && l.hierarquia_usuarios && (
                  <p className="text-[10px] text-primary/60 mt-0.5">Por: {l.hierarquia_usuarios.nome}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
          {/* All data loaded from cache */}
        </div>
      )}
    </div>
  );
}
