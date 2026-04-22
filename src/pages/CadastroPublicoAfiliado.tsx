import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, ClipboardList, Instagram } from 'lucide-react';

export default function CadastroPublicoAfiliado() {
  const { token } = useParams<{ token: string }>();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [redeSocial, setRedeSocial] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ instagram: string } | null>(null);

  useEffect(() => {
    document.title = 'Cadastro';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!nome.trim() || !telefone.trim()) {
      toast({ title: 'Preencha nome e telefone', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('cadastro-afiliado-publico', {
        body: {
          token,
          nome: nome.trim(),
          telefone: telefone.trim(),
          data_nascimento: dataNascimento || null,
          cep: cep.trim() || null,
          rede_social: redeSocial.trim() || null,
        },
      });
      if (error) throw new Error(error.message || 'Erro ao enviar');
      if ((data as any)?.error) throw new Error(typeof (data as any).error === 'string' ? (data as any).error : 'Erro ao salvar');
      const url = (data as any)?.instagram_url || 'https://instagram.com/deputadasarelli';
      setSuccess({ instagram: url });
      // Redireciona após 2s para o Instagram
      setTimeout(() => { window.location.href = url; }, 2200);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-primary/10 to-background">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <CheckCircle2 size={48} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro realizado!</h1>
          <p className="text-sm text-muted-foreground">Obrigado! Você será redirecionado para o Instagram da Doutora.</p>
          <a href={success.instagram} className="inline-flex items-center gap-2 px-5 h-11 rounded-xl gradient-primary text-white text-sm font-bold active:scale-95">
            <Instagram size={16} /> Ir para o Instagram
          </a>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full h-11 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all';
  const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <ClipboardList size={26} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Cadastro</h1>
          <p className="text-xs text-muted-foreground">Preencha seus dados abaixo</p>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-3">
          <div>
            <label className={labelCls}>Nome *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" className={inputCls} required maxLength={120} />
          </div>
          <div>
            <label className={labelCls}>Telefone *</label>
            <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} required maxLength={40} />
          </div>
          <div>
            <label className={labelCls}>Data de nascimento</label>
            <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CEP</label>
            <input type="text" value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" className={inputCls} maxLength={20} />
          </div>
          <div>
            <label className={labelCls}>Rede social</label>
            <input type="text" value={redeSocial} onChange={e => setRedeSocial(e.target.value)} placeholder="@usuario" className={inputCls} maxLength={120} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50 mt-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Enviando...' : 'Enviar cadastro'}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground">
          Seus dados são tratados com sigilo.
        </p>
      </div>
    </div>
  );
}