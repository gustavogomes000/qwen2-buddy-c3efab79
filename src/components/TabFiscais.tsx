import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2, CheckCircle2, Search, ChevronRight, ArrowLeft, Phone, MessageCircle, Trash2, Download, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidarCadastros } from '@/hooks/useDataCache';
import { useCidade } from '@/contexts/CidadeContext';
import { formatCPF, cleanCPF, validateCPF, maskCPF } from '@/lib/cpf';
import { checkCpfDuplicateByUser } from '@/lib/cpfDuplicateCheck';
import { resolverLigacaoPolitica } from '@/lib/resolverLigacaoPolitica';
import { toast } from '@/hooks/use-toast';
import { useEvento } from '@/contexts/EventoContext';
import { useQuery } from '@tanstack/react-query';
import { addToOfflineQueue } from '@/lib/offlineQueue';

import CampoLigacaoPolitica from '@/components/CampoLigacaoPolitica';
import SkeletonLista from '@/components/SkeletonLista';

const situacoesTitulo = ['Regular', 'Cancelado', 'Suspenso', 'Não informado'];

const emptyForm = {
  cpf: '', nome: '', telefone: '', whatsapp: '', email: '',
  instagram: '', facebook: '',
  titulo_eleitor: '', zona_eleitoral: '', secao_eleitoral: '',
  municipio_eleitoral: '', uf_eleitoral: 'GO', colegio_eleitoral: '',
  endereco_colegio: '', situacao_titulo: '',
  zona_fiscal: '', secao_fiscal: '', colegio_eleitoral_fiscal: '',
  lideranca_id: '', observacoes: '',
};

interface FiscalRow {
  id: string;
  status: string | null;
  zona_fiscal: string | null;
  secao_fiscal: string | null;
  colegio_eleitoral: string | null;
  cadastrado_por: string | null;
  suplente_id: string | null;
  criado_em: string;
  observacoes: string | null;
  origem_captacao: string | null;
  pessoas: {
    nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null;
    email: string | null; instagram: string | null; facebook: string | null;
    zona_eleitoral: string | null; secao_eleitoral: string | null;
    titulo_eleitor: string | null; municipio_eleitoral: string | null;
    uf_eleitoral: string | null; colegio_eleitoral: string | null;
    endereco_colegio: string | null; situacao_titulo: string | null;
  };
  hierarquia_usuarios: { nome: string } | null;
  liderancas: { id: string; pessoas: { nome: string } | null } | null;
}

const QUERY_FISCAL = 'id, status, zona_fiscal, secao_fiscal, colegio_eleitoral, cadastrado_por, suplente_id, criado_em, observacoes, origem_captacao, municipio_id, lideranca_id, pessoas(nome, cpf, telefone, whatsapp, email, instagram, facebook, titulo_eleitor, zona_eleitoral, secao_eleitoral, municipio_eleitoral, uf_eleitoral, colegio_eleitoral, endereco_colegio, situacao_titulo), hierarquia_usuarios!fiscais_cadastrado_por_fkey(nome), liderancas:lideranca_id(id, pessoas(nome))';

function useFiscais() {
  const { usuario, tipoUsuario } = useAuth();
  const { cidadeAtiva, isTodasCidades } = useCidade();
  const isAdmin = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

  return useQuery({
    queryKey: ['fiscais', usuario?.id, isAdmin ? 'admin' : 'own'],
    queryFn: async () => {
      let q = (supabase as any)
        .from('fiscais')
        .select(QUERY_FISCAL)
        .order('criado_em', { ascending: false })
        .limit(500);

      if (!isAdmin && usuario) {
        if (usuario.suplente_id) {
          q = q.or(`cadastrado_por.eq.${usuario.id},suplente_id.eq.${usuario.suplente_id}`);
        } else {
          q = q.eq('cadastrado_por', usuario.id);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FiscalRow[];
    },
    enabled: !!usuario,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

interface Props {
  refreshKey: number;
  onSaved?: () => void;
  viewOnly?: boolean;
}

export default function TabFiscais({ refreshKey, onSaved, viewOnly }: Props) {
  const { usuario, isAdmin, tipoUsuario } = useAuth();
  const { eventoAtivo } = useEvento();
  const invalidarCadastros = useInvalidarCadastros();
  const { data: cachedData, isLoading: cacheLoading } = useFiscais();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [data, setData] = useState<FiscalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<FiscalRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [pessoaExistenteId, setPessoaExistenteId] = useState<string | null>(null);
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'validando' | 'confirmado'>('idle');
  const [cpfNomePessoa, setCpfNomePessoa] = useState('');
  const [cpfDuplicado, setCpfDuplicado] = useState<{ isDuplicate: boolean; tipos: string[] }>({ isDuplicate: false, tipos: [] });
  const [validandoCPF, setValidandoCPF] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [liderancas, setLiderancas] = useState<{ id: string; nome: string }[]>([]);
  const cpfTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ligação política
  const [ligBloqueado, setLigBloqueado] = useState(false);
  const [ligNomeFixo, setLigNomeFixo] = useState<string | null>(null);
  const [ligSubtitulo, setLigSubtitulo] = useState<string | null>(null);
  const [ligSuplenteId, setLigSuplenteId] = useState<string | null>(null);
  const [ligLiderancaId, setLigLiderancaId] = useState<string | null>(null);
  const [ligMunicipioId, setLigMunicipioId] = useState<string | null>(null);
  const [ligErro, setLigErro] = useState<string | null>(null);

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

  const update = useCallback((field: string, value: string) => setForm(f => ({ ...f, [field]: value })), []);

  useEffect(() => {
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
    }
  }, [cachedData]);

  useEffect(() => {
    if (cacheLoading) setLoading(true);
  }, [cacheLoading]);

  useEffect(() => {
    if (refreshKey > 0) invalidarCadastros();
  }, [refreshKey, invalidarCadastros]);

  useEffect(() => {
    supabase.from('liderancas').select('id, pessoas(nome)').eq('status', 'Ativa')
      .then(({ data }) => { if (data) setLiderancas(data.map((l: any) => ({ id: l.id, nome: l.pessoas?.nome || '—' }))); });
  }, []);

  const validarCPF = useCallback(async (cpfClean: string) => {
    if (cpfClean.length !== 11 || !validateCPF(cpfClean)) return;
    if (validandoCPF) return;
    setValidandoCPF(true);
    setCpfStatus('validando');
    try {
      const { data: pessoa } = await supabase.from('pessoas').select('*').eq('cpf', cpfClean).maybeSingle();
      if (pessoa) {
        setForm(f => ({
          ...f, cpf: pessoa.cpf || cpfClean,
          nome: pessoa.nome || f.nome, telefone: pessoa.telefone || f.telefone,
          whatsapp: pessoa.whatsapp || f.whatsapp, email: pessoa.email || f.email,
          instagram: pessoa.instagram || f.instagram, facebook: pessoa.facebook || f.facebook,
          titulo_eleitor: pessoa.titulo_eleitor || f.titulo_eleitor,
          zona_eleitoral: pessoa.zona_eleitoral || f.zona_eleitoral,
          secao_eleitoral: pessoa.secao_eleitoral || f.secao_eleitoral,
          municipio_eleitoral: pessoa.municipio_eleitoral || f.municipio_eleitoral,
          uf_eleitoral: pessoa.uf_eleitoral || f.uf_eleitoral,
          colegio_eleitoral: pessoa.colegio_eleitoral || f.colegio_eleitoral,
          endereco_colegio: pessoa.endereco_colegio || f.endereco_colegio,
          situacao_titulo: pessoa.situacao_titulo || f.situacao_titulo,
        }));
        setPessoaExistenteId(pessoa.id);
        setCpfStatus('confirmado');
        setCpfNomePessoa(pessoa.nome);
        toast({ title: '✅ Pessoa encontrada!', description: `Dados de ${pessoa.nome} preenchidos` });
      } else { setCpfStatus('idle'); setCpfDuplicado({ isDuplicate: false, tipos: [] }); }
    } catch (err) { console.error(err); }
    finally { setValidandoCPF(false); }
  }, [validandoCPF, usuario?.id]);

  const handleCPFChange = (value: string) => {
    const cleaned = cleanCPF(value);
    update('cpf', cleaned);
    setCpfStatus('idle');
    setPessoaExistenteId(null);
    setCpfDuplicado({ isDuplicate: false, tipos: [] });
    if (cpfTimeoutRef.current) clearTimeout(cpfTimeoutRef.current);
    if (cleaned.length === 11) cpfTimeoutRef.current = setTimeout(() => validarCPF(cleaned), 500);
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
    if (!form.zona_fiscal.trim()) { toast({ title: 'Informe a zona fiscal', variant: 'destructive' }); return; }
    if (!form.secao_fiscal.trim()) { toast({ title: 'Informe a seção fiscal', variant: 'destructive' }); return; }
    if (usuario?.id) {
      const dup = await checkCpfDuplicateByUser(form.cpf, usuario.id);
      if (dup.isDuplicate) { toast({ title: '❌ CPF já cadastrado por você', description: `Cadastrado como: ${dup.tipos.join(', ')}`, variant: 'destructive' }); return; }
    }
    if (!ligBloqueado && tipoUsuario !== 'super_admin' && tipoUsuario !== 'coordenador' && !ligSuplenteId && !ligLiderancaId) {
      setLigErro('Selecione um suplente ou liderança');
      toast({ title: 'Selecione uma ligação política', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const pessoaData = {
      cpf: form.cpf || null, nome: form.nome, telefone: form.telefone || null,
      whatsapp: form.whatsapp || null, email: form.email || null,
      instagram: form.instagram || null, facebook: form.facebook || null,
      titulo_eleitor: form.titulo_eleitor || null, zona_eleitoral: form.zona_eleitoral || null,
      secao_eleitoral: form.secao_eleitoral || null, municipio_eleitoral: form.municipio_eleitoral || null,
      uf_eleitoral: form.uf_eleitoral || null, colegio_eleitoral: form.colegio_eleitoral || null,
      endereco_colegio: form.endereco_colegio || null, situacao_titulo: form.situacao_titulo || null,
    };

    const registroData = {
      cadastrado_por: usuario?.id || null,
      suplente_id: ligSuplenteId || usuario?.suplente_id || null,
      lideranca_id: ligLiderancaId || form.lideranca_id || null,
      zona_fiscal: form.zona_fiscal || null,
      secao_fiscal: form.secao_fiscal || null,
      colegio_eleitoral: form.colegio_eleitoral_fiscal || null,
      observacoes: form.observacoes || null,
      municipio_id: ligMunicipioId || null,
      evento_id: eventoAtivo?.id || null,
    };

    // Offline: salvar na fila
    if (!navigator.onLine) {
      try {
        await addToOfflineQueue({ type: 'fiscal', pessoa: pessoaData, registro: registroData, pessoaExistenteId });
        toast({ title: '📱 Salvo offline!', description: 'Será enviado quando voltar a internet.' });
        setForm({ ...emptyForm }); setPessoaExistenteId(null); setCpfStatus('idle'); setCpfNomePessoa('');
        setMode('list'); onSaved?.();
      } catch (err: any) { toast({ title: 'Erro ao salvar offline', description: err.message, variant: 'destructive' }); }
      finally { setSaving(false); }
      return;
    }

    try {
      let pessoaId: string;
      if (pessoaExistenteId) {
        pessoaId = pessoaExistenteId;
        await supabase.from('pessoas').update({ ...pessoaData, atualizado_em: new Date().toISOString() }).eq('id', pessoaId);
      } else {
        const { data: novaPessoa, error } = await supabase.from('pessoas').insert(pessoaData as any).select('id').single();
        if (error) throw error;
        pessoaId = novaPessoa!.id;
      }

      const { error } = await (supabase as any).from('fiscais').insert({ ...registroData, pessoa_id: pessoaId });
      if (error) throw error;

      toast({ title: '✅ Fiscal cadastrado!' });
      setForm({ ...emptyForm }); setPessoaExistenteId(null); setCpfStatus('idle'); setCpfNomePessoa('');
      setMode('list'); invalidarCadastros(); onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const fetchDetalhe = useCallback(async (id: string) => {
    const { data } = await (supabase as any).from('fiscais').select(QUERY_FISCAL).eq('id', id).single();
    if (data) setSelected(data as FiscalRow);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este fiscal permanentemente?')) return;
    await supabase.from('fiscais').delete().eq('id', id);
    toast({ title: 'Fiscal excluído' });
    setSelected(null);
    setMode('list');
    invalidarCadastros();
  };

  const filtered = useMemo(() => data.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (f.pessoas?.nome?.toLowerCase() || '').includes(q) || (f.pessoas?.cpf || '').includes(q) || (f.pessoas?.whatsapp || '').includes(q);
  }), [data, searchQuery]);

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const textareaCls = "w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none";
  const cpfBorderCls = cpfStatus === 'confirmado' ? 'border-emerald-500 ring-1 ring-emerald-500/30' : '';

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

  // DETAIL
  if (mode === 'detail' && selected) {
    const f = selected;
    const p = f.pessoas;
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => { setSelected(null); setMode('list'); }} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
          <p className="text-sm text-muted-foreground">Fiscal</p>
          {isAdmin && f.hierarquia_usuarios && (
            <p className="text-[10px] text-primary/70 mt-1">Por: {f.hierarquia_usuarios.nome} · {new Date(f.criado_em).toLocaleDateString('pt-BR')}</p>
          )}
          <div className="flex gap-2 pt-2">
            {p.whatsapp && <a href={`https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-medium"><MessageCircle size={14} /> WhatsApp</a>}
          </div>
        </div>
        <div className="section-card">
          <h3 className="section-title">👤 Dados Pessoais</h3>
          <Info label="CPF" value={p.cpf ? maskCPF(p.cpf) : null} />
          <Info label="WhatsApp" value={p.whatsapp} />
          <Info label="E-mail" value={p.email} link={p.email ? `mailto:${p.email}` : undefined} />
          <Info label="Rede social" value={p.instagram || p.facebook} />
        </div>
        <div className="section-card">
          <h3 className="section-title">🗳️ Dados Eleitorais</h3>
          <Info label="Título" value={p.titulo_eleitor} />
          <Info label="Zona / Seção" value={`${p.zona_eleitoral || '—'} / ${p.secao_eleitoral || '—'}`} />
          <Info label="Município / UF" value={`${p.municipio_eleitoral || '—'} / ${p.uf_eleitoral || '—'}`} />
          <Info label="Colégio" value={p.colegio_eleitoral} />
          <Info label="End. colégio" value={p.endereco_colegio} />
        </div>
        <div className="section-card">
          <h3 className="section-title">🔍 Dados do Fiscal</h3>
          <Info label="Zona Fiscal" value={f.zona_fiscal} />
          <Info label="Seção Fiscal" value={f.secao_fiscal} />
          <Info label="Colégio" value={f.colegio_eleitoral} />
          <Info label="Status" value={f.status} />
        </div>
        {f.liderancas && (
          <div className="section-card">
            <h3 className="section-title">🔗 Vinculado a</h3>
            {f.liderancas?.pessoas?.nome && <Info label="Liderança" value={f.liderancas.pessoas.nome} />}
          </div>
        )}
        {f.observacoes && (
          <div className="section-card">
            <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{f.observacoes}</p>
          </div>
        )}
        {isAdmin && (
          <button onClick={() => handleDelete(f.id)} className="w-full h-11 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
            <Trash2 size={16} /> Excluir
          </button>
        )}
      </div>
    );
  }

  // FORM
  if (mode === 'form' && !viewOnly) {
    return (
      <div className="space-y-4 pb-24">
        <button onClick={() => setMode('list')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="section-card">
          <h2 className="section-title">👤 Dados Pessoais</h2>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome completo <span className="text-primary">*</span></label>
            <input type="text" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Nome do fiscal" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              CPF <span className="text-primary">*</span>
              {cpfStatus === 'validando' && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              {cpfStatus === 'confirmado' && <CheckCircle2 size={12} className="text-emerald-500" />}
            </label>
            <input type="text" value={maskCPF(form.cpf)} onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00" maxLength={14} className={`${inputCls} ${cpfBorderCls}`} />
            {cpfStatus === 'confirmado' && cpfNomePessoa && <p className="text-[10px] text-emerald-600">✓ {cpfNomePessoa}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">WhatsApp <span className="text-primary">*</span></label>
            <input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="(62) 99999-9999" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rede social <span className="text-primary">*</span></label>
            <input type="text" value={form.instagram} onChange={e => update('instagram', e.target.value)} placeholder="Instagram ou Facebook (@ ou link)" className={inputCls} />
          </div>
        </div>

        <div className="section-card">
          <h2 className="section-title">🗳️ Dados Eleitorais</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Título de eleitor <span className="text-primary">*</span></label>
              <input type="text" value={form.titulo_eleitor} onChange={e => update('titulo_eleitor', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Situação</label>
              <select value={form.situacao_titulo} onChange={e => update('situacao_titulo', e.target.value)} className={selectCls}>
                <option value="">Selecione</option>
                {situacoesTitulo.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Zona eleitoral <span className="text-primary">*</span></label>
              <input type="text" value={form.zona_eleitoral} onChange={e => update('zona_eleitoral', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Seção eleitoral <span className="text-primary">*</span></label>
              <input type="text" value={form.secao_eleitoral} onChange={e => update('secao_eleitoral', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Município eleitoral <span className="text-primary">*</span></label>
              <input type="text" value={form.municipio_eleitoral} onChange={e => update('municipio_eleitoral', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">UF</label>
              <input type="text" value={form.uf_eleitoral} readOnly className={`${inputCls} bg-muted/50`} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Colégio eleitoral <span className="text-primary">*</span></label>
            <input type="text" value={form.colegio_eleitoral} onChange={e => update('colegio_eleitoral', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="section-card">
          <h2 className="section-title">🔍 Dados da Fiscalização</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Zona fiscal <span className="text-primary">*</span></label>
              <input type="text" value={form.zona_fiscal} onChange={e => update('zona_fiscal', e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Seção fiscal <span className="text-primary">*</span></label>
              <input type="text" value={form.secao_fiscal} onChange={e => update('secao_fiscal', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Colégio eleitoral do fiscal</label>
            <input type="text" value={form.colegio_eleitoral_fiscal} onChange={e => update('colegio_eleitoral_fiscal', e.target.value)} className={inputCls} />
          </div>
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
        />

        <div className="section-card">
          <h2 className="section-title">📝 Observações</h2>
          <textarea value={form.observacoes} onChange={e => update('observacoes', e.target.value)} rows={3} className={textareaCls} />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full h-12 gradient-primary rounded-xl text-primary-foreground font-bold text-sm shadow-lg active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : null}
          {saving ? 'Salvando...' : 'Cadastrar Fiscal'}
        </button>
      </div>
    );
  }

  // LIST
  if (loading && data.length === 0) return <SkeletonLista />;

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} fiscal{filtered.length !== 1 ? 'is' : ''}</p>
        {!viewOnly && (
          <button onClick={() => setMode('form')}
            className="h-9 px-4 gradient-primary rounded-xl text-primary-foreground text-xs font-bold shadow active:scale-95">
            + Novo Fiscal
          </button>
        )}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar fiscal..."
          className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="space-y-1.5">
        {filtered.map(f => (
          <button
            key={f.id}
            onClick={() => { fetchDetalhe(f.id); setMode('detail'); }}
            className="section-card w-full text-left !py-3 !px-3.5 flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0">
              <Search size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{f.pessoas?.nome || '—'}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {f.pessoas?.whatsapp && <span className="flex items-center gap-0.5"><Phone size={9} /> {f.pessoas.whatsapp}</span>}
                {f.zona_fiscal && <span>Zona {f.zona_fiscal}</span>}
                
              </div>
              {isAdmin && f.hierarquia_usuarios && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Por: {f.hierarquia_usuarios.nome}</p>
              )}
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nenhum fiscal encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
