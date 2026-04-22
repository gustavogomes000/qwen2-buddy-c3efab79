import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ClipboardList, KeyRound, User as UserIcon, Eye, EyeOff, Loader2, X } from 'lucide-react';
import TabCadastrosAfiliado from '@/components/TabCadastrosAfiliado';
import FloatingSupportButton from '@/components/FloatingSupportButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function HomeAfiliado() {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState<string>('');
  const [aberto, setAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email || '';
      setLogin(email.includes('@') ? email.split('@')[0] : email);
    })();
  }, []);

  const handleSair = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleAlterarSenha = async () => {
    if (!novaSenha.trim() || novaSenha.length < 6) {
      toast({ title: 'Senha deve ter ao menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
        body: { acao: 'alterar_propria_senha', nova_senha: novaSenha.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Senha alterada com sucesso!' });
      setNovaSenha('');
      setAberto(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <FloatingSupportButton />
      <div className="h-[1.5px] gradient-header shrink-0" />
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-primary" size={22} />
            <div>
              <h1 className="text-base font-bold leading-tight">Afiliados</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Olá, {usuario?.nome ?? 'usuário'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSair}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium active:scale-95 transition-transform"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[672px] mx-auto px-4 py-4">
          {/* Conta: usuário + alterar senha */}
          <div className="section-card mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <UserIcon size={14} className="text-primary" />
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Sua conta</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground">Usuário de acesso</p>
                <p className="text-sm font-mono font-semibold text-foreground truncate">{login || '—'}</p>
              </div>
              {!aberto && (
                <button
                  onClick={() => setAberto(true)}
                  className="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-lg bg-card border border-border text-[11px] font-semibold active:scale-95"
                >
                  <KeyRound size={12} /> Alterar senha
                </button>
              )}
            </div>
            {aberto && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground">Nova senha</label>
                  <button onClick={() => { setAberto(false); setNovaSenha(''); }} className="text-muted-foreground p-1">
                    <X size={14} />
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full h-11 pl-3 pr-10 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleAlterarSenha}
                  disabled={salvando || novaSenha.length < 6}
                  className="w-full h-11 gradient-primary text-white text-sm font-semibold rounded-xl active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {salvando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  {salvando ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </div>
            )}
          </div>

          <TabCadastrosAfiliado />
        </div>
      </main>
    </div>
  );
}