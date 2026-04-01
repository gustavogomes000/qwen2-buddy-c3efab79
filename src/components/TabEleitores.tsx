import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2, CheckCircle2, Search, ChevronRight, ArrowLeft, Phone, MessageCircle, Trash2, ExternalLink, Download } from 'lucide-react';
import { exportAllCadastros } from '@/lib/exportXlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { formatCPF, cleanCPF, validateCPF, maskCPF } from '@/lib/cpf';
import { checkCpfDuplicateByUser } from '@/lib/cpfDuplicateCheck';
import { resolverLigacaoPolitica } from '@/lib/resolverLigacaoPolitica';
import { toast } from '@/hooks/use-toast';
import StatusBadge from '@/components/StatusBadge';
import CampoLigacaoPolitica from '@/components/CampoLigacaoPolitica';
import SkeletonLista from '@/components/SkeletonLista';

const compromissoOptions = ['Confirmado', 'Provável', 'Indefinido', 'Improvável'];
const situacoesTitulo = ['Regular', 'Cancelado', 'Suspenso', 'Não informado'];

const emptyForm = {
  cpf: '', nome: '', telefone: '', whatsapp: '', email: '',
  instagram: '', facebook: '',
  titulo_eleitor: '', zona_eleitoral: '', secao_eleitoral: '',
  municipio_eleitoral: '', uf_eleitoral: '', colegio_eleitoral: '',
  endereco_colegio: '', situacao_titulo: '',
  lideranca_id: '', fiscal_id: '',
  compromisso_voto: 'Indefinido', observacoes: '',
};

interface EleitorRow {
  id: string;
  compromisso_voto: string | null;
  lideranca_id: string | null;
  fiscal_id: string | null;
  cadastrado_por: string | null;
  observacoes: string | null;
  criado_em: string;
  pessoas: {
    nome: string; cpf: string | null; telefone: string | null; whatsapp: string | null;
    email: string | null; instagram: string | null; facebook: string | null;
    zona_eleitoral: string | null; secao_eleitoral: string | null;
    titulo_eleitor: string | null; municipio_eleitoral: string | null;
    uf_eleitoral: string | null; colegio_eleitoral: string | null;
    endereco_colegio: string | null; situacao_titulo: string | null;
  };
  liderancas: { id: string; pessoas: { nome: string } | null } | null;
  fiscais: { id: string; pessoas: { nome: string } | null } | null;
}

interface Props {
  refreshKey: number;
  onSaved?: () => void;
  viewOnly?: boolean;
}

export default function TabEleitores({ refreshKey, onSaved, viewOnly }: Props) {
  const { usuario, isAdmin, tipoUsuario, municipioId: authMunicipioId } = useAuth();
  const { cidadeAtiva, isTodasCidades } = useCidade();
  const [mode, setMode] = useState<'list' | 'form' | 'detail'>('list');
  const [data, setData] = useState<EleitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<EleitorRow | null>(null);
  const [temMais, setTemMais] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const paginaRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [pessoaExistenteId, setPessoaExistenteId] = useState<string | null>(null);
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'validando' | 'confirmado'>('idle');
  const [cpfNomePessoa, setCpfNomePessoa] = useState('');
  const [cpfDuplicado, setCpfDuplicado] = useState<{ isDuplicate: boolean; tipos: string[] }>({ isDuplicate: false, tipos: [] });
  const [validandoCPF, setValidandoCPF] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [liderancas, setLiderancas] = useState<{ id: string; nome: string }[]>([]);
  const [fiscais, setFiscais] = useState<{ id: string; nome: string }[]>([]);
  const cpfTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ligação política
  const [ligBloqueado, setLigBloqueado] = useState(false);
  const [ligNomeFixo, setLigNomeFixo] = useState<string | null>(null);
  const [ligSubtitulo, setLigSubtitulo] = useState<string | null>(null);
  const [ligSuplenteId, setLigSuplenteId] = useState<string | null>(null);
  const [ligLiderancaId, setLigLiderancaId] = useState<string | null>(null);
  const [ligMunicipioId, setLigMunicipioId] = useState<string | null>(null);
  const [ligErro, setLigErro] = useState<string | null>(null);

  // Resolver ligação política
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

  const PAGE_SIZE = 20;
  const QUERY_LISTA_ELE = 'id, compromisso_voto, lideranca_id, fiscal_id, cadastrado_por, criado_em, municipio_id, origem_captacao, pessoas(nome, cpf, telefone, whatsapp), liderancas:lideranca_id(id, pessoas(nome)), fiscais:fiscal_id(id, pessoas(nome))';

  const fetchData = useCallback(async (reset = true) => {
    if (!usuario) return;
    if (reset) { setLoading(true); paginaRef.current = 0; } else { setCarregandoMais(true); }

    const filtroMunicipioId = (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador')
      ? (isTodasCidades ? null : cidadeAtiva?.id)
      : authMunicipioId;

    const from = paginaRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = (supabase as any)
      .from('possiveis_eleitores')
      .select(QUERY_LISTA_ELE, { count: 'exact' })
      .order('criado_em', { ascending: false })
      .range(from, to);

    if (filtroMunicipioId) query = query.eq('municipio_id', filtroMunicipioId);
    if (tipoUsuario !== 'super_admin' && tipoUsuario !== 'coordenador') query = query.eq('cadastrado_por', usuario.id);

    const { data: eleitores } = await query;
    if (eleitores) {
      if (reset) setData(eleitores as unknown as EleitorRow[]);
      else setData(prev => [...prev, ...(eleitores as unknown as EleitorRow[])]);
      paginaRef.current += 1;
      setTemMais(eleitores.length === PAGE_SIZE);
    }
    setLoading(false);
    setCarregandoMais(false);
  }, [usuario, tipoUsuario, cidadeAtiva, isTodasCidades, authMunicipioId]);

  useEffect(() => { fetchData(true); }, [fetchData, refreshKey]);

  useEffect(() => {
    supabase.from('liderancas').select('id, pessoas(nome)').eq('status', 'Ativa')
      .then(({ data }) => { if (data) setLiderancas(data.map((l: any) => ({ id: l.id, nome: l.pessoas?.nome || '—' }))); });
    supabase.from('fiscais').select('id, pessoas(nome)').eq('status', 'Ativo')
      .then(({ data }) => { if (data) setFiscais(data.map((f: any) => ({ id: f.id, nome: f.pessoas?.nome || '—' }))); });
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
        if (usuario?.id) {
          const dup = await checkCpfDuplicateByUser(cpfClean, usuario.id);
          setCpfDuplicado(dup);
          if (dup.isDuplicate) {
            toast({ title: '⚠️ CPF já cadastrado por você', description: `Cadastrado como: ${dup.tipos.join(', ')}`, variant: 'destructive' });
          } else {
            toast({ title: '✅ Pessoa encontrada!', description: `Dados de ${pessoa.nome} preenchidos` });
          }
        } else {
          toast({ title: '✅ Pessoa encontrada!', description: `Dados de ${pessoa.nome} preenchidos` });
        }
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
    if (cpfDuplicado.isDuplicate) { toast({ title: '❌ CPF já cadastrado por você', description: `Você já cadastrou este CPF como: ${cpfDuplicado.tipos.join(', ')}`, variant: 'destructive' }); return; }
    if (!ligBloqueado && tipoUsuario !== 'super_admin' && tipoUsuario !== 'coordenador' && !ligSuplenteId && !ligLiderancaId) {
      setLigErro('Selecione um suplente ou liderança');
      toast({ title: 'Selecione uma ligação política', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let pessoaId: string;
      if (pessoaExistenteId) {
        pessoaId = pessoaExistenteId;
        await supabase.from('pessoas').update({
          nome: form.nome, telefone: form.telefone || null, whatsapp: form.whatsapp || null,
          email: form.email || null, instagram: form.instagram || null, facebook: form.facebook || null,
          titulo_eleitor: form.titulo_eleitor || null, zona_eleitoral: form.zona_eleitoral || null,
          secao_eleitoral: form.secao_eleitoral || null, municipio_eleitoral: form.municipio_eleitoral || null,
          uf_eleitoral: form.uf_eleitoral || null, colegio_eleitoral: form.colegio_eleitoral || null,
          endereco_colegio: form.endereco_colegio || null, situacao_titulo: form.situacao_titulo || null,
          atualizado_em: new Date().toISOString(),
        }).eq('id', pessoaId);
      } else {
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
        pessoaId = novaPessoa!.id;
      }

      const { error } = await (supabase as any).from('possiveis_eleitores').insert({
        pessoa_id: pessoaId,
        cadastrado_por: usuario?.id || null,
        suplente_id: ligSuplenteId || usuario?.suplente_id || null,
        lideranca_id: ligLiderancaId || form.lideranca_id || null,
        fiscal_id: form.fiscal_id || null,
        compromisso_voto: form.compromisso_voto,
        observacoes: form.observacoes || null,
        municipio_id: ligMunicipioId || null,
      });
      if (error) throw error;

      toast({ title: '✅ Eleitor cadastrado!' });
      setForm({ ...emptyForm });
      setPessoaExistenteId(null);
      setCpfStatus('idle');
      setCpfNomePessoa('');
      setMode('list');
      fetchData(true);
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const QUERY_DETALHE_ELE = 'id, compromisso_voto, lideranca_id, fiscal_id, cadastrado_por, observacoes, criado_em, municipio_id, pessoas(*), liderancas:lideranca_id(id, pessoas(nome)), fiscais:fiscal_id(id, pessoas(nome))';

  const fetchDetalhe = useCallback(async (id: string) => {
    const { data } = await (supabase as any).from('possiveis_eleitores').select(QUERY_DETALHE_ELE).eq('id', id).single();
    if (data) setSelected(data as unknown as EleitorRow);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este registro?')) return;
    await supabase.from('possiveis_eleitores').delete().eq('id', id);
    toast({ title: 'Registro excluído' });
    setSelected(null);
    setMode('list');
    fetchData(true);
  };

  const filtered = useMemo(() => data.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (e.pessoas?.nome?.toLowerCase() || '').includes(q) || (e.pessoas?.cpf || '').includes(q);
  }), [data, searchQuery]);

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const textareaCls = "w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none";
  const cpfBorderCls = cpfStatus === 'confirmado' ? 'border-emerald-500 ring-1 ring-emerald-500/30' : '';

  const compromissoBadge = (c: string | null) => {
    const colors: Record<string, string> = {
      'Confirmado': 'bg-emerald-500/10 text-emerald-600',
      'Provável': 'bg-blue-500/10 text-blue-600',
      'Indefinido': 'bg-amber-500/10 text-amber-600',
      'Improvável': 'bg-red-500/10 text-red-600',
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[c || ''] || 'bg-muted text-muted-foreground'}`}>{c || 'Indefinido'}</span>;
  };

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

  // DETAIL VIEW
  if (mode === 'detail' && selected) {
    const e = selected;
    const p = e.pessoas;
    return (
      <div key="detail" className="space-y-4 pb-24">
        <button onClick={() => { setSelected(null); setMode('list'); }} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="section-card">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">{p.nome}</h2>
              <p className="text-sm text-muted-foreground">Eleitor</p>
            </div>
            {compromissoBadge(e.compromisso_voto)}
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

        {(e.liderancas || e.fiscais) && (
          <div className="section-card">
            <h3 className="section-title">🔗 Vinculado a</h3>
            {e.liderancas?.pessoas?.nome && <Info label="Liderança" value={e.liderancas.pessoas.nome} />}
            {e.fiscais?.pessoas?.nome && <Info label="Fiscal" value={e.fiscais.pessoas.nome} />}
          </div>
        )}

        {e.observacoes && (
          <div className="section-card">
            <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{e.observacoes}</p>
          </div>
        )}

        {isAdmin && (
          <button onClick={() => handleDelete(e.id)} className="w-full h-11 border border-destructive/30 rounded-xl text-destructive font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
            <Trash2 size={16} /> Excluir
          </button>
        )}
      </div>
    );
  }

  // FORM VIEW
  if (mode === 'form' && !viewOnly) {
    return (
      <div key="form" className="space-y-4 pb-24">
        <button onClick={() => setMode('list')} className="flex items-center gap-1 text-sm text-muted-foreground active:scale-95">
          <ArrowLeft size={16} /> Voltar
        </button>

        {/* Dados Pessoais */}
        <div className="section-card">
          <h2 className="section-title">👤 Dados Pessoais</h2>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome completo <span className="text-primary">*</span></label>
            <input type="text" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Nome do eleitor" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              CPF
              {cpfStatus === 'validando' && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              {cpfStatus === 'confirmado' && <CheckCircle2 size={12} className="text-emerald-500" />}
            </label>
            <input type="text" inputMode="numeric" value={formatCPF(form.cpf)} onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00" className={`${inputCls} ${cpfBorderCls}`} maxLength={14} />
            {cpfStatus === 'confirmado' && cpfNomePessoa && !cpfDuplicado.isDuplicate && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✅ Pessoa encontrada: {cpfNomePessoa}</p>
            )}
            {cpfDuplicado.isDuplicate && (
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-xs font-semibold text-destructive">⚠️ Você já cadastrou este CPF como: {cpfDuplicado.tipos.join(', ')}</p>
                <p className="text-[10px] text-destructive/80 mt-0.5">Não é possível cadastrar o mesmo CPF duas vezes pelo mesmo usuário.</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <input type="tel" value={form.telefone} onChange={e => update('telefone', e.target.value)} placeholder="(00) 0000-0000" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
              <input type="tel" value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@exemplo.com" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Instagram</label>
              <input type="text" value={form.instagram} onChange={e => update('instagram', e.target.value)} placeholder="@usuario" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Facebook</label>
              <input type="text" value={form.facebook} onChange={e => update('facebook', e.target.value)} placeholder="Nome ou link" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Dados Eleitorais */}
        <div className="section-card">
          <h2 className="section-title">🗳️ Dados Eleitorais</h2>
          <button
            type="button"
            onClick={() => window.open('https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor', '_blank')}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 border border-border rounded-xl text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10 active:scale-[0.97] transition-all"
          >
            <ExternalLink size={16} />
            Consultar dados no TSE
          </button>
          <p className="text-[11px] text-muted-foreground -mt-2">Abra o site do TSE, consulte os dados eleitorais e preencha abaixo.</p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título de eleitor</label>
            <input type="text" value={form.titulo_eleitor} onChange={e => update('titulo_eleitor', e.target.value)} placeholder="Número do título" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Zona</label>
              <input type="text" value={form.zona_eleitoral} onChange={e => update('zona_eleitoral', e.target.value)} placeholder="045" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Seção</label>
              <input type="text" value={form.secao_eleitoral} onChange={e => update('secao_eleitoral', e.target.value)} placeholder="0123" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Município</label>
              <input type="text" value={form.municipio_eleitoral} onChange={e => update('municipio_eleitoral', e.target.value)} placeholder="Cidade" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">UF</label>
              <input type="text" value={form.uf_eleitoral} onChange={e => update('uf_eleitoral', e.target.value)} placeholder="GO" className={inputCls} maxLength={2} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Colégio eleitoral</label>
            <input type="text" value={form.colegio_eleitoral} onChange={e => update('colegio_eleitoral', e.target.value)} placeholder="Nome da escola / local" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Situação do título</label>
            <select value={form.situacao_titulo} onChange={e => update('situacao_titulo', e.target.value)} className={selectCls}>
              <option value="">Selecione...</option>
              {situacoesTitulo.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Ligação Política */}
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

        {/* Vínculo (opcional) */}
        <div className="section-card">
          <h2 className="section-title">🔗 Vínculo Adicional</h2>
          <p className="text-[10px] text-muted-foreground -mt-2 mb-2">Opcional: vincule a um fiscal específico.</p>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fiscal vinculado</label>
            <select value={form.fiscal_id} onChange={e => update('fiscal_id', e.target.value)} className={selectCls}>
              <option value="">Nenhum</option>
              {fiscais.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Compromisso de voto</label>
            <select value={form.compromisso_voto} onChange={e => update('compromisso_voto', e.target.value)} className={selectCls}>
              {compromissoOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <textarea value={form.observacoes} onChange={e => update('observacoes', e.target.value)} rows={3} className={textareaCls} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full h-14 gradient-primary text-white text-base font-semibold rounded-2xl shadow-lg shadow-pink-500/25 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Salvando...</> : '✅ Salvar Eleitor'}
        </button>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-3 pb-24">
      {!viewOnly && (
        <button onClick={() => setMode('form')} className="w-full h-12 gradient-primary text-white font-semibold rounded-xl active:scale-[0.97] transition-all">
          + Cadastrar Eleitor
        </button>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar eleitor..." className="w-full h-11 pl-9 pr-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: data.length },
          { label: 'Confirmados', value: data.filter(e => e.compromisso_voto === 'Confirmado').length },
          { label: 'Prováveis', value: data.filter(e => e.compromisso_voto === 'Provável').length },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-2 text-center">
            <p className="text-lg font-bold text-primary">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</p>
      {tipoUsuario === 'super_admin' && (
        <button onClick={() => exportAllCadastros('eleitor')}
          className="w-full h-9 flex items-center justify-center gap-2 bg-card border border-border rounded-xl text-xs font-medium text-foreground active:scale-[0.97] transition-all">
          <Download size={14} /> Exportar Eleitores (CSV)
        </button>
      )}
      {loading ? (
        <SkeletonLista />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Nenhum eleitor encontrado</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <button key={e.id} onClick={() => { fetchDetalhe(e.id); setMode('detail'); }} className="w-full text-left bg-card rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-foreground text-sm truncate">{e.pessoas?.nome || '—'}</span>
                  {compromissoBadge(e.compromisso_voto)}
                  {(e as any).origem_captacao === 'visita_comite' && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">Visita</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {e.liderancas?.pessoas?.nome ? `Líder: ${e.liderancas.pessoas.nome}` : ''}{e.fiscais?.pessoas?.nome ? `${e.liderancas ? ' · ' : ''}Fiscal: ${e.fiscais.pessoas.nome}` : ''}
                  {!e.liderancas && !e.fiscais && (e.pessoas?.zona_eleitoral ? `Z${e.pessoas.zona_eleitoral}` : '')}{!e.liderancas && !e.fiscais && (e.pessoas?.secao_eleitoral ? ` S${e.pessoas.secao_eleitoral}` : '')}
                </p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </button>
          ))}
          {temMais && (
            <button onClick={() => fetchData(false)} disabled={carregandoMais}
              className="w-full py-3 text-sm text-primary font-medium flex items-center justify-center gap-2 active:scale-[0.97]">
              {carregandoMais ? <Loader2 size={16} className="animate-spin" /> : 'Carregar mais'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
