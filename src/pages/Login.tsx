import { useState, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import fernandaImg from '@/assets/fernanda-sarelli.webp';
import logoSarelli from '@/assets/logo-sarelli.webp';

const ConstellationBg = lazy(() => import('@/components/ConstellationBg'));

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState(() => localStorage.getItem("saved_user") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem("saved_user"));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: 'Preencha nome e senha', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao entrar', description: 'Nome ou senha incorretos', variant: 'destructive' });
    }
    if (remember) {
      localStorage.setItem("saved_user", username);
    } else {
      localStorage.removeItem("saved_user");
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center overflow-y-auto overscroll-contain relative"
      style={{ background: '#fdf2f8' }}
    >
      <Suspense fallback={null}>
        <ConstellationBg />
      </Suspense>

      <div className="w-full max-w-[520px] mx-auto px-4 sm:px-6 relative z-10 flex flex-col items-center animate-fade-in py-6 sm:py-8 my-auto">
        {/* Foto */}
        <div
          className="w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] md:w-[130px] md:h-[130px] rounded-full overflow-hidden shadow-lg ring-4 ring-pink-200/60 flex-shrink-0"
          style={{ border: '3px solid #f9a8d4' }}
        >
          <img src={fernandaImg} alt="Dra. Fernanda Sarelli" className="w-full h-full object-cover" loading="eager" decoding="sync" />
        </div>

        {/* Logo */}
        <img
          src={logoSarelli}
          alt="Sarelli"
          className="h-14 sm:h-18 md:h-22 object-contain mt-2 flex-shrink-0"
          loading="eager"
          decoding="sync"
        />

        {/* Subtítulo */}
        <p
          className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] mt-1.5 mb-4 sm:mb-5 text-center flex-shrink-0"
          style={{ color: '#ec4899' }}
        >
          Cadastro de Campanha
        </p>

        {/* Card do formulário */}
        <div
          className="w-full rounded-2xl backdrop-blur-sm px-5 py-6 sm:px-8 sm:py-7 shadow-sm flex-shrink-0"
          style={{ background: 'rgba(253, 242, 248, 0.7)', border: '2px solid #f9a8d4' }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Usuário */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.15em] text-gray-700 font-bold block">Usuário</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-300">
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <input
                  data-testid="input-nome"
                  type="text"
                  placeholder="Ex: Administrador"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  className="w-full bg-white border border-pink-200 text-gray-700 placeholder:text-gray-400 h-11 sm:h-[52px] pl-10 sm:pl-12 pr-4 rounded-xl text-sm outline-none transition-all focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.15em] text-gray-700 font-bold block">Senha</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-300">
                  <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  data-testid="input-senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-white border border-pink-200 text-gray-700 placeholder:text-gray-400 h-11 sm:h-[52px] pl-10 sm:pl-12 pr-11 sm:pr-12 rounded-xl text-sm outline-none transition-all focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-pink-300 hover:text-pink-500 transition-colors p-0.5"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Lembrar */}
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-pink-300 accent-pink-500 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">Lembrar meus dados</label>
            </div>

            {/* Botão Entrar */}
            <button
              data-testid="btn-entrar"
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-[52px] rounded-xl font-semibold text-sm sm:text-base text-white transition-all active:scale-[0.97] disabled:opacity-60 shadow-md hover:shadow-lg hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 35%, #f59e0b 100%)',
              }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Entrando...
                  </span>
                : <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Entrar
                  </span>
              }
            </button>
          </form>
        </div>

        {/* Rodapé */}
        <div className="text-center mt-4 sm:mt-6 space-y-0.5 flex-shrink-0">
          <p className="text-[11px] sm:text-xs text-gray-500 tracking-wide">Pré-candidata a Deputada Estadual — GO 2026</p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] sm:text-xs text-pink-400 hover:text-pink-500 transition-colors tracking-wide"
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
