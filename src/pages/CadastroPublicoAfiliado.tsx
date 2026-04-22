import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, ClipboardList, Eye, EyeOff, KeyRound, LogIn, MapPin, Heart, Sparkles, UserCheck } from 'lucide-react';

export default function CadastroPublicoAfiliado() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const tipoParam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const t = new URLSearchParams(window.location.search).get('tipo');
    return t === 'lideranca' || t === 'fiscal' || t === 'eleitor' ? t : null;
  }, []);
  const tipoLabel = tipoParam === 'lideranca'
    ? 'Convite para Liderança'
    : tipoParam === 'fiscal'
    ? 'Convite para Fiscal'
    : tipoParam === 'eleitor'
    ? 'Convite para Eleitor'
    : null;

  // Detecção de modo: 'captacao' (link de afiliado ativo, formulário simples)
  // ou 'criar_acesso' (registro pendente do próprio afiliado, fluxo completo)
  const [modo, setModo] = useState<'detectando' | 'captacao' | 'criar_acesso' | 'invalido'>('detectando');
  const [afiliadoNome, setAfiliadoNome] = useState<string>('');

  // Captação (público)
  const [capNome, setCapNome] = useState('');
  const [capTelefone, setCapTelefone] = useState('');
  const [capData, setCapData] = useState('');
  const [capCep, setCapCep] = useState('');
  const [capCidadeCep, setCapCidadeCep] = useState('');
  const [capUfCep, setCapUfCep] = useState('');
  const [capBuscandoCep, setCapBuscandoCep] = useState(false);
  const [capRede, setCapRede] = useState('');
  const [capSaving, setCapSaving] = useState(false);

  // Pessoais
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [cidadeCep, setCidadeCep] = useState('');
  const [ufCep, setUfCep] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [instagram, setInstagram] = useState('');
  // Eleitorais
  const [tituloEleitor, setTituloEleitor] = useState('');
  const [zonaEleitoral, setZonaEleitoral] = useState('');
  const [secaoEleitoral, setSecaoEleitoral] = useState('');
  const [municipioEleitoral, setMunicipioEleitoral] = useState('');
  const [ufEleitoral, setUfEleitoral] = useState('GO');
  const [colegioEleitoral, setColegioEleitoral] = useState('');
  // Login
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ login: string } | null>(null);

  useEffect(() => { document.title = 'Cadastro de Afiliado'; }, []);

  // Detectar tipo do link ao montar
  useEffect(() => {
    if (!token) { setModo('invalido'); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('captacao-afiliado', {
          method: 'GET' as any,
          body: undefined as any,
          headers: {} as any,
          // workaround: usar URL com query — invoke não passa query, então usar fetch direto
        } as any);
        // Fallback: chamar via fetch direto (invoke não suporta query params facilmente)
        const url = `https://yvdfdmyusdhgtzfguxbj.supabase.co/functions/v1/captacao-afiliado?token=${encodeURIComponent(token)}`;
        const r = await fetch(url, { headers: { apikey: (supabase as any).supabaseKey || '' } });
        const j = await r.json();
        if (!r.ok || j?.error) { setModo('invalido'); return; }
        setAfiliadoNome(j.afiliado_nome || '');
        setModo(j.is_ativo ? 'captacao' : 'criar_acesso');
      } catch {
        setModo('invalido');
      }
    })();
  }, [token]);

  const buscarCidadePorCep = async (raw: string) => {
    const cepLimpo = raw.replace(/\D/g, '');
    if (cepLimpo.length !== 8) { setCidadeCep(''); setUfCep(''); return; }
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d?.erro) { setCidadeCep(''); setUfCep(''); }
      else { setCidadeCep(d.localidade || ''); setUfCep(d.uf || ''); }
    } catch {
      setCidadeCep(''); setUfCep('');
    } finally {
      setBuscandoCep(false);
    }
  };

  const buscarCidadePorCepCap = async (raw: string) => {
    const cepLimpo = raw.replace(/\D/g, '');
    if (cepLimpo.length !== 8) { setCapCidadeCep(''); setCapUfCep(''); return; }
    setCapBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const d = await r.json();
      if (d?.erro) { setCapCidadeCep(''); setCapUfCep(''); }
      else { setCapCidadeCep(d.localidade || ''); setCapUfCep(d.uf || ''); }
    } catch { setCapCidadeCep(''); setCapUfCep(''); }
    finally { setCapBuscandoCep(false); }
  };

  const handleSubmitCaptacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!capNome.trim() || capNome.trim().length < 2) {
      toast({ title: 'Informe seu nome', variant: 'destructive' }); return;
    }
    if (!capTelefone.trim() || capTelefone.replace(/\D/g, '').length < 6) {
      toast({ title: 'Informe um telefone válido', variant: 'destructive' }); return;
    }
    setCapSaving(true);
    try {
      const url = `https://yvdfdmyusdhgtzfguxbj.supabase.co/functions/v1/captacao-afiliado`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: (supabase as any).supabaseKey || '' },
        body: JSON.stringify({
          token,
          nome: capNome.trim(),
          telefone: capTelefone.trim(),
          data_nascimento: capData || null,
          cep: capCep.trim() || null,
          rede_social: capRede.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.error) {
        const msg = typeof j?.error === 'string' ? j.error : 'Erro ao enviar cadastro';
        throw new Error(msg);
      }
      toast({ title: '✅ Cadastro enviado!', description: 'Você será redirecionada(o) ao Instagram.' });
      // Pequeno delay para o usuário ver o toast
      setTimeout(() => {
        window.location.href = j.redirect_url || 'https://www.instagram.com/drafernandasarelli/';
      }, 800);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setCapSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!nome.trim() || nome.trim().length < 2) {
      toast({ title: 'Informe seu nome completo', variant: 'destructive' }); return;
    }
    if (!whatsapp.trim() || whatsapp.replace(/\D/g,'').length < 6) {
      toast({ title: 'Informe um WhatsApp válido', variant: 'destructive' }); return;
    }
    if (!usuarioLogin.trim() || usuarioLogin.trim().length < 3) {
      toast({ title: 'Defina um nome de usuário (mín. 3 letras)', variant: 'destructive' }); return;
    }
    if (!senha.trim() || senha.length < 6) {
      toast({ title: 'A senha precisa ter no mínimo 6 caracteres', variant: 'destructive' }); return;
    }
    if (!tituloEleitor.trim() || !zonaEleitoral.trim() || !secaoEleitoral.trim() || !municipioEleitoral.trim() || !colegioEleitoral.trim()) {
      toast({ title: 'Preencha os dados eleitorais (Título, Zona, Seção, Município e Colégio)', variant: 'destructive' }); return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('cadastro-afiliado-publico', {
        body: {
          token,
          nome: nome.trim(),
          cpf: cpf.trim() || null,
          telefone: whatsapp.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim() || null,
          data_nascimento: dataNascimento || null,
          cep: cep.trim() || null,
          cidade_cep: cidadeCep || null,
          instagram: instagram.trim() || null,
          titulo_eleitor: tituloEleitor.trim(),
          zona_eleitoral: zonaEleitoral.trim(),
          secao_eleitoral: secaoEleitoral.trim(),
          municipio_eleitoral: municipioEleitoral.trim(),
          uf_eleitoral: ufEleitoral.trim() || null,
          colegio_eleitoral: colegioEleitoral.trim(),
          usuario_login: usuarioLogin.trim(),
          senha: senha,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao enviar');
      const d: any = data;
      if (d?.error) {
        throw new Error(typeof d.error === 'string' ? d.error : 'Erro ao cadastrar');
      }
      setSuccess({ login: d?.login || usuarioLogin.trim() });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 overflow-y-auto flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-primary/10 to-background">
        <div className="w-full max-w-sm text-center space-y-5 my-auto">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={48} className="text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Cadastro concluído!</h1>
            <p className="text-sm text-muted-foreground">Sua conta foi criada com sucesso.</p>
          </div>
          <div className="section-card text-left space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Seu usuário de acesso</p>
            <p className="text-base font-mono font-bold text-foreground">{success.login}</p>
            <p className="text-[11px] text-muted-foreground mt-2">Use a senha que você definiu para entrar no sistema.</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            <LogIn size={16} /> Acessar o sistema
          </button>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all';
  const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block';

  if (modo === 'detectando') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin text-primary" /> Carregando…
        </div>
      </div>
    );
  }

  if (modo === 'invalido') {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">Solicite um novo link à pessoa que te enviou.</p>
        </div>
      </div>
    );
  }

  // ─── MODO CAPTAÇÃO: formulário simples para o público preencher ───
  if (modo === 'captacao') {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 pt-6 pb-32">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl opacity-60" />

        <div className="relative w-full max-w-md space-y-5 mx-auto">
          {/* Hero header */}
          <div className="relative overflow-hidden rounded-3xl gradient-primary p-6 text-center shadow-xl">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
            <div className="relative space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider">
                <Sparkles size={11} /> Mandato Dra. Fernanda Sarelli
              </div>
              {tipoLabel && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-primary text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  ⭐ {tipoLabel}
                </div>
              )}
              <h1 className="text-2xl font-extrabold text-white leading-tight drop-shadow-sm">
                Faça parte da nossa rede
              </h1>
              <p className="text-[13px] text-white/90 leading-snug">
                Cadastre-se e receba novidades, ações e convocações da Dra. Fernanda Sarelli.
              </p>
            </div>
          </div>

          {/* Indicado por */}
          {afiliadoNome && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-primary/20 shadow-sm">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
                <Heart size={18} className="text-white" fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Você foi indicado por</p>
                <p className="text-sm font-bold text-foreground truncate">{afiliadoNome}</p>
              </div>
              <UserCheck size={18} className="text-primary shrink-0" />
            </div>
          )}

          <form onSubmit={handleSubmitCaptacao} className="space-y-4">
            <div className="section-card space-y-3 shadow-sm">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                <ClipboardList size={13} className="text-primary" /> Seus dados
              </h2>
              <div>
                <label className={labelCls}>Nome *</label>
                <input type="text" value={capNome} onChange={e => setCapNome(e.target.value)} className={inputCls} required maxLength={120} />
              </div>
              <div>
                <label className={labelCls}>Telefone *</label>
                <input type="tel" value={capTelefone} onChange={e => setCapTelefone(e.target.value)} className={inputCls} required maxLength={40} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelCls}>Data de nascimento</label>
                <input type="date" value={capData} onChange={e => setCapData(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>CEP</label>
                <div className="relative">
                  <input
                    type="text"
                    value={capCep}
                    onChange={e => setCapCep(e.target.value)}
                    onBlur={e => buscarCidadePorCepCap(e.target.value)}
                    className={inputCls}
                    maxLength={20}
                    placeholder="00000-000"
                  />
                  {capBuscandoCep && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                {capCidadeCep && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                    <MapPin size={11} /> {capCidadeCep}{capUfCep ? ` - ${capUfCep}` : ''}
                  </span>
                )}
              </div>
              <div>
                <label className={labelCls}>Rede social</label>
                <input type="text" value={capRede} onChange={e => setCapRede(e.target.value)} className={inputCls} maxLength={200} placeholder="@usuario / link" />
              </div>
            </div>

            <button
              type="submit"
              disabled={capSaving}
              className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50 shadow-lg shadow-primary/30"
            >
              {capSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {capSaving ? 'Enviando...' : 'Quero fazer parte'}
            </button>
          </form>

          <div className="text-center space-y-1 pb-4">
            <p className="text-[10px] text-muted-foreground">
              🔒 Seus dados são tratados com sigilo e segurança.
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              Após o envio você será direcionado ao Instagram da deputada.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODO CRIAR ACESSO: afiliado define seu próprio login ───
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-primary/5 via-background to-background px-4 pt-8 pb-32">
      <div className="w-full max-w-md space-y-5 mx-auto">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ClipboardList size={26} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Cadastro de Afiliado</h1>
          <p className="text-xs text-muted-foreground">Preencha seus dados e crie seu acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados pessoais */}
          <div className="section-card space-y-3">
            <h2 className="section-title">👤 Dados pessoais</h2>
            <div>
              <label className={labelCls}>Nome completo *</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className={inputCls} required maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>CPF</label>
                <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} className={inputCls} maxLength={14} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={labelCls}>Data nasc.</label>
                <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>WhatsApp *</label>
              <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={inputCls} required maxLength={40} placeholder="(00) 00000-0000" />
              <p className="text-[10px] text-muted-foreground mt-1">Usado também como telefone de contato.</p>
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} maxLength={200} placeholder="seu@email.com" />
            </div>
            <div>
              <label className={labelCls}>CEP</label>
              <div className="relative">
                <input
                  type="text"
                  value={cep}
                  onChange={e => { setCep(e.target.value); }}
                  onBlur={e => buscarCidadePorCep(e.target.value)}
                  className={inputCls}
                  maxLength={20}
                  placeholder="00000-000"
                />
                {buscandoCep && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {cidadeCep && (
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                  <MapPin size={11} /> {cidadeCep}{ufCep ? ` - ${ufCep}` : ''}
                </span>
              )}
            </div>
            <div>
              <label className={labelCls}>Instagram</label>
              <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} className={inputCls} maxLength={120} placeholder="@usuario" />
            </div>
          </div>

          {/* Dados eleitorais */}
          <div className="section-card space-y-3">
            <h2 className="section-title">🗳️ Dados eleitorais</h2>
            <div>
              <label className={labelCls}>Título de eleitor *</label>
              <input type="text" value={tituloEleitor} onChange={e => setTituloEleitor(e.target.value)} className={inputCls} maxLength={40} required placeholder="Número do título" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Zona *</label>
                <input type="text" value={zonaEleitoral} onChange={e => setZonaEleitoral(e.target.value)} className={inputCls} maxLength={20} required placeholder="045" />
              </div>
              <div>
                <label className={labelCls}>Seção *</label>
                <input type="text" value={secaoEleitoral} onChange={e => setSecaoEleitoral(e.target.value)} className={inputCls} maxLength={20} required placeholder="0123" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Município *</label>
                <input type="text" value={municipioEleitoral} onChange={e => setMunicipioEleitoral(e.target.value)} className={inputCls} maxLength={120} required placeholder="Cidade" />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input type="text" value={ufEleitoral} onChange={e => setUfEleitoral(e.target.value.toUpperCase())} className={inputCls} maxLength={2} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Colégio eleitoral *</label>
              <input type="text" value={colegioEleitoral} onChange={e => setColegioEleitoral(e.target.value)} className={inputCls} maxLength={200} required placeholder="Nome da escola / local" />
            </div>
          </div>

          {/* Login */}
          <div className="section-card space-y-3">
            <h2 className="section-title">🔑 Crie seu acesso</h2>
            <div>
              <label className={labelCls}>Nome de usuário *</label>
              <input
                type="text"
                value={usuarioLogin}
                onChange={e => setUsuarioLogin(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ''))}
                className={inputCls}
                required
                minLength={3}
                maxLength={60}
                placeholder="ex: maria.silva"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Apenas letras minúsculas, números e ponto.</p>
            </div>
            <div>
              <label className={labelCls}>Senha *</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className={inputCls}
                  required
                  minLength={6}
                  maxLength={72}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {saving ? 'Criando seu acesso...' : 'Concluir cadastro'}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground pb-4">
          Seus dados são tratados com sigilo.
        </p>
      </div>
    </div>
  );
}