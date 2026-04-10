import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, ExternalLink, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import { formatCPF, cleanCPF, validateCPF } from '@/lib/cpf';
import { resolverLigacaoPolitica } from '@/lib/resolverLigacaoPolitica';
import { toast } from '@/hooks/use-toast';
import { useEvento } from '@/contexts/EventoContext';
import CampoLigacaoPolitica from '@/components/CampoLigacaoPolitica';
import { addToOfflineQueue, getPendingCount } from '@/lib/offlineQueue';
import { useFormDraft } from '@/hooks/useFormDraft';


const comprometimentos = ['Alto', 'Médio', 'Baixo'];
const situacoesTitulo = ['Regular', 'Cancelado', 'Suspenso', 'Não informado'];

const emptyForm = {
  cpf: '', nome: '', telefone: '', whatsapp: '', email: '',
  instagram: '', facebook: '',
  titulo_eleitor: '', zona_eleitoral: '', secao_eleitoral: '',
  municipio_eleitoral: '', uf_eleitoral: '', colegio_eleitoral: '',
  endereco_colegio: '', situacao_titulo: '',
  tipo_lideranca: '', nivel: '', regiao_atuacao: '',
  zona_atuacao: '', bairros_influencia: '', comunidades_influencia: '',
  lider_principal_id: '', origem_captacao: '',
  apoiadores_estimados: '', meta_votos: '',
  status: 'Ativa', nivel_comprometimento: '', observacoes: '',
};

interface Props {
  onSaved: () => void;
}

export default function TabCadastrar({ onSaved }: Props) {
  const { usuario, tipoUsuario } = useAuth();
  const { cidadeAtiva } = useCidade();
  const { eventoAtivo } = useEvento();
  const [saving, setSaving] = useState(false);
  const [liderancasExistentes, setLiderancasExistentes] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState({ ...emptyForm });

  // Persist form draft to IndexedDB (survives refresh/crash/close)
  const { clearDraft } = useFormDraft('cadastrar-lideranca', form, setForm, emptyForm);

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

  useEffect(() => {
    supabase.from('liderancas').select('id, pessoas(nome)').eq('status', 'Ativa')
      .then(({ data }) => {
        if (data) setLiderancasExistentes(data.map((l: any) => ({ id: l.id, nome: l.pessoas?.nome || '—' })));
      });
  }, []);

  const update = useCallback((field: string, value: string) => setForm(f => ({ ...f, [field]: value })), []);

  const handleCPFChange = (value: string) => {
    const cleaned = cleanCPF(value);
    update('cpf', cleaned);
  };

  // Get suplente_id: if user is suplente, use their suplente_id; otherwise traverse hierarchy
  const getSuplementeId = (): string | null => {
    if (!usuario) return null;
    if (usuario.tipo === 'suplente') return usuario.suplente_id;
    // For liderança, suplente_id should be resolved server-side via get_meu_suplente_id()
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

    // Coordenadores: bloquear CPF duplicado (apenas online)
    if (navigator.onLine && tipoUsuario === 'coordenador' && form.cpf && form.cpf.length === 11) {
      const { data: cpfExiste } = await supabase.from('pessoas').select('id').eq('cpf', form.cpf).limit(1);
      if (cpfExiste && cpfExiste.length > 0) {
        toast({ title: 'CPF já cadastrado', description: 'Este CPF já existe no sistema.', variant: 'destructive' });
        return;
      }
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

    const suplenteId = ligSuplenteId || getSuplementeId();

    const registroData = {
      tipo_lideranca: form.tipo_lideranca || null,
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
      evento_id: eventoAtivo?.id || null,
    };

    // Se offline, salvar na fila local
    if (!navigator.onLine) {
      try {
        await addToOfflineQueue({
          type: 'lideranca',
          pessoa: pessoaData,
          registro: registroData,
          pessoaExistenteId: null,
        });
        toast({ title: '📱 Salvo offline!', description: 'Será enviado automaticamente quando voltar a internet.' });
        setForm({ ...emptyForm });
        clearDraft();
        onSaved();
      } catch (err: any) {
        toast({ title: 'Erro ao salvar offline', description: err.message, variant: 'destructive' });
      } finally { setSaving(false); }
      return;
    }

    // Online: salvar normalmente com fallback offline se a rede cair
    try {
      const { data: novaPessoa, error } = await supabase.from('pessoas').insert(pessoaData as any).select('id').single();
      if (error) throw error;
      const pessoaId = novaPessoa!.id;

      const { error: lError } = await (supabase as any).from('liderancas').insert({
        ...registroData,
        pessoa_id: pessoaId,
      });
      if (lError) {
        // Pessoa foi criada mas liderança falhou — salvar na fila com pessoaExistenteId
        // para evitar pessoa órfã e duplicação
        console.warn('[TabCadastrar] Liderança insert falhou após pessoa criada, salvando offline com pessoaExistenteId');
        await addToOfflineQueue({
          type: 'lideranca',
          pessoa: pessoaData,
          registro: registroData,
          pessoaExistenteId: pessoaId,
        });
        toast({ title: '⚠️ Salvo parcialmente', description: 'A liderança será sincronizada automaticamente.' });
        setForm({ ...emptyForm });
        clearDraft();
        onSaved();
        setSaving(false);
        return;
      }

      toast({ title: '✅ Liderança cadastrada com sucesso!' });
      setForm({ ...emptyForm });
      clearDraft();
      onSaved();
    } catch (err: any) {
      // If network error, fall back to offline queue instead of losing data
      if (!navigator.onLine || err?.message?.includes('fetch') || err?.message?.includes('network') || err?.code === 'PGRST301') {
        console.warn('[TabCadastrar] Network error durante save, caindo para offline queue');
        try {
          await addToOfflineQueue({
            type: 'lideranca',
            pessoa: pessoaData,
            registro: registroData,
            pessoaExistenteId: null,
          });
          toast({ title: '📱 Salvo offline!', description: 'Conexão instável. Será enviado quando a internet estabilizar.' });
          setForm({ ...emptyForm });
          clearDraft();
          onSaved();
        } catch (offlineErr: any) {
          toast({ title: 'Erro crítico', description: 'Não foi possível salvar. Tente novamente.', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
      }
    } finally { setSaving(false); }
  };

  const inputCls = "w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";
  const selectCls = inputCls;
  const textareaCls = "w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none";

  

  return (
    <div className="space-y-4 pb-24">
      {/* Dados Pessoais */}
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
          <input type="text" inputMode="numeric" value={formatCPF(form.cpf)}
            onChange={e => handleCPFChange(e.target.value)} placeholder="000.000.000-00"
            className={inputCls}
            maxLength={14} />
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
          <label className="text-xs font-medium text-muted-foreground">Título de eleitor <span className="text-primary">*</span></label>
          <input type="text" value={form.titulo_eleitor} onChange={e => update('titulo_eleitor', e.target.value)} placeholder="Número do título" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Zona <span className="text-primary">*</span></label>
            <input type="text" value={form.zona_eleitoral} onChange={e => update('zona_eleitoral', e.target.value)} placeholder="045" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Seção <span className="text-primary">*</span></label>
            <input type="text" value={form.secao_eleitoral} onChange={e => update('secao_eleitoral', e.target.value)} placeholder="0123" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Município <span className="text-primary">*</span></label>
            <input type="text" value={form.municipio_eleitoral} onChange={e => update('municipio_eleitoral', e.target.value)} placeholder="Cidade" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">UF</label>
            <input type="text" value={form.uf_eleitoral} onChange={e => update('uf_eleitoral', e.target.value)} placeholder="GO" className={inputCls} maxLength={2} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Colégio eleitoral <span className="text-primary">*</span></label>
          <input type="text" value={form.colegio_eleitoral} onChange={e => update('colegio_eleitoral', e.target.value)} placeholder="Nome da escola / local" className={inputCls} />
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

      {/* Perfil + Status */}
      <div className="section-card">
        <h2 className="section-title">⭐ Perfil e Status</h2>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Região de atuação <span className="text-primary">*</span></label>
          <textarea value={form.regiao_atuacao} onChange={e => update('regiao_atuacao', e.target.value)} rows={2} placeholder="Bairro X, Comunidade Y..." className={textareaCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Apoiadores</label>
            <input type="number" value={form.apoiadores_estimados} onChange={e => update('apoiadores_estimados', e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Meta votos <span className="text-primary">*</span></label>
            <input type="number" value={form.meta_votos} onChange={e => update('meta_votos', e.target.value)} placeholder="0" className={inputCls} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Comprometimento <span className="text-primary">*</span></label>
          <select value={form.nivel_comprometimento} onChange={e => update('nivel_comprometimento', e.target.value)} className={selectCls}>
            <option value="">Selecione...</option>
            {comprometimentos.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Observações</label>
          <textarea value={form.observacoes} onChange={e => update('observacoes', e.target.value)} rows={3} placeholder="Anotações..." className={textareaCls} />
        </div>
      </div>

      {/* Botão Salvar */}
      <button onClick={handleSave} disabled={saving}
        className="w-full h-14 gradient-primary text-white text-base font-semibold rounded-2xl shadow-lg shadow-pink-500/25 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <><Loader2 size={20} className="animate-spin" /> Salvando...</> : '✅ Salvar Liderança'}
      </button>
    </div>
  );
}
