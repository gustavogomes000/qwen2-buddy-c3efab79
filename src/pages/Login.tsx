import { useState, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import fernandaImg from '@/assets/fernanda-sarelli.jpg';
import logoSarelli from '@/assets/logo-sarelli.png';

const ConstellationBg = lazy(() => import('@/components/ConstellationBg'));

const APP_TITLE = "Cadastro de Campanha";

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
      className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center overflow-y-auto overscroll-contain relative"
      style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fdf2f8 50%, #fce7f3 100%)' }}
    >
      {/* Constellation animated background */}
      <Suspense fallback={null}>
        <ConstellationBg />
      </Suspense>

      {/* Card container */}
      <div className="w-full max-w-sm mx-auto px-4 py-8 sm:py-0 relative z-10">
        {/* Glassmorphism card with pulsing pink border */}
        <div className="relative">
          {/* Animated pulsing border */}
          <div
            className="absolute -inset-[2px] rounded-3xl opacity-70 animate-pulse"
            style={{
              background: 'conic-gradient(from 0deg, #ec4899, #f9a8d4, #ec4899, #be185d, #ec4899)',
              filter: 'blur(2px)',
              animationDuration: '2s',
            }}
          />
          <div
            className="absolute -inset-[2px] rounded-3xl"
            style={{
              background: 'conic-gradient(from 180deg, #ec4899, #f9a8d4, #ec4899, #be185d, #ec4899)',
              opacity: 0.5,
            }}
          />

          <div className="relative bg-white/80 backdrop-blur-md rounded-3xl p-5 sm:p-8 shadow-xl">
            {/* Photo + Logo */}
            <div className="flex flex-col items-center">
              {/* Circular photo */}
              <div className="w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] rounded-full border-4 border-pink-400 overflow-hidden shadow-lg shadow-pink-200/50">
                <img
                  src={fernandaImg}
                  alt="Dra. Fernanda Sarelli"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>

              {/* Logo overlapping */}
              <img
                src={logoSarelli}
                alt="Sarelli"
                className="h-36 sm:h-44 -mt-6 object-contain"
                loading="eager"
              />

              {/* Subtitle */}
              <p
                className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] -mt-2 mb-4"
                style={{ color: '#c8aa64' }}
              >
                {APP_TITLE}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block">Usuário</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input
                    data-testid="input-nome"
                    type="text"
                    placeholder="Seu nome de acesso"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    className="w-full bg-white/60 border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-pink-400 h-11 pl-10 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block">Senha</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    data-testid="input-senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full bg-white/60 border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-pink-400 h-11 pl-10 pr-10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                    style={{ fontSize: '16px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-pink-500 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-gray-500 cursor-pointer select-none">Lembrar meus dados</label>
              </div>

              {/* Submit */}
              <button
                data-testid="btn-entrar"
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-pink-300/40 hover:shadow-pink-400/50"
                style={{ background: 'linear-gradient(135deg, #ec4899, #fb7185)' }}
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      Entrando...
                    </span>
                  : <span className="flex items-center justify-center gap-2">
                      Entrar
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                }
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-[10px] text-gray-400">Pré-candidata a Deputada Estadual — GO 2026</p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-pink-400 hover:text-pink-500 transition-colors"
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
