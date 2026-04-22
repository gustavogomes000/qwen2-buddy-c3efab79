import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, ClipboardList, Eye, EyeOff, KeyRound, LogIn } from 'lucide-react';

export default function CadastroPublicoAfiliado() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Pessoais
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!nome.trim() || nome.trim().length < 2) {
      toast({ title: 'Informe seu nome completo', variant: 'destructive' }); return;
    }
    if (!telefone.trim()) {
      toast({ title: 'Informe um telefone', variant: 'destructive' }); return;
    }
    if (!usuarioLogin.trim() || usuarioLogin.trim().length < 3) {
      toast({ title: 'Defina um nome de usuário (mín. 3 letras)', variant: 'destructive' }); return;
    }
    if (!senha.trim() || senha.length < 6) {
      toast({ title: 'A senha precisa ter no mínimo 6 caracteres', variant: 'destructive' }); return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('cadastro-afiliado-publico', {
        body: {
          token,
          nome: nome.trim(),
          cpf: cpf.trim() || null,
          telefone: telefone.trim(),
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          data_nascimento: dataNascimento || null,
          cep: cep.trim() || null,
          instagram: instagram.trim() || null,
          facebook: facebook.trim() || null,
          titulo_eleitor: tituloEleitor.trim() || null,
          zona_eleitoral: zonaEleitoral.trim() || null,
          secao_eleitoral: secaoEleitoral.trim() || null,
          municipio_eleitoral: municipioEleitoral.trim() || null,
          uf_eleitoral: ufEleitoral.trim() || null,
          colegio_eleitoral: colegioEleitoral.trim() || null,
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-primary/10 to-background">
        <div className="w-full max-w-sm text-center space-y-5">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Telefone *</label>
                <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} className={inputCls} required maxLength={40} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={inputCls} maxLength={40} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} maxLength={200} placeholder="seu@email.com" />
            </div>
            <div>
              <label className={labelCls}>CEP</label>
              <input type="text" value={cep} onChange={e => setCep(e.target.value)} className={inputCls} maxLength={20} placeholder="00000-000" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Instagram</label>
                <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} className={inputCls} maxLength={120} placeholder="@usuario" />
              </div>
              <div>
                <label className={labelCls}>Facebook</label>
                <input type="text" value={facebook} onChange={e => setFacebook(e.target.value)} className={inputCls} maxLength={120} placeholder="usuario" />
              </div>
            </div>
          </div>

          {/* Dados eleitorais */}
          <div className="section-card space-y-3">
            <h2 className="section-title">🗳️ Dados eleitorais</h2>
            <div>
              <label className={labelCls}>Título de eleitor</label>
              <input type="text" value={tituloEleitor} onChange={e => setTituloEleitor(e.target.value)} className={inputCls} maxLength={40} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Zona</label>
                <input type="text" value={zonaEleitoral} onChange={e => setZonaEleitoral(e.target.value)} className={inputCls} maxLength={20} />
              </div>
              <div>
                <label className={labelCls}>Seção</label>
                <input type="text" value={secaoEleitoral} onChange={e => setSecaoEleitoral(e.target.value)} className={inputCls} maxLength={20} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Município eleitoral</label>
                <input type="text" value={municipioEleitoral} onChange={e => setMunicipioEleitoral(e.target.value)} className={inputCls} maxLength={120} />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input type="text" value={ufEleitoral} onChange={e => setUfEleitoral(e.target.value.toUpperCase())} className={inputCls} maxLength={2} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Colégio eleitoral</label>
              <input type="text" value={colegioEleitoral} onChange={e => setColegioEleitoral(e.target.value)} className={inputCls} maxLength={200} placeholder="Nome do local de votação" />
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