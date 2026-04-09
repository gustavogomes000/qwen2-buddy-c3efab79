import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolverMunicipioId, buscarNomeMunicipio } from '@/lib/resolverMunicipio';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

export type TipoUsuario = 'super_admin' | 'coordenador' | 'suplente' | 'lideranca';

interface HierarquiaUsuario {
  id: string;
  auth_user_id: string;
  nome: string;
  tipo: TipoUsuario;
  superior_id: string | null;
  suplente_id: string | null;
  ativo: boolean;
  municipio_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  usuario: HierarquiaUsuario | null;
  loading: boolean;
  isAdmin: boolean;
  isSuplente: boolean;
  isLideranca: boolean;
  tipoUsuario: TipoUsuario | null;
  municipioId: string | null;
  municipioNome: string | null;
  isOfflineMode: boolean; // true when session expired but we have cached data
  signIn: (nome: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function nomeToEmail(nome: string): string {
  const trimmed = nome.trim();
  // If the user already typed a full email address, use it as-is
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const slug = trimmed.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}@rede.sarelli.com`;
}

// Cache last known user in localStorage for offline fallback
const CACHED_USUARIO_KEY = 'sarelli_cached_usuario';
const CACHED_MUNICIPIO_KEY = 'sarelli_cached_municipio';

function cacheUsuario(usr: HierarquiaUsuario, munId: string | null, munNome: string | null) {
  try {
    localStorage.setItem(CACHED_USUARIO_KEY, JSON.stringify(usr));
    localStorage.setItem(CACHED_MUNICIPIO_KEY, JSON.stringify({ id: munId, nome: munNome }));
  } catch {}
}

function getCachedUsuario(): { usuario: HierarquiaUsuario | null; munId: string | null; munNome: string | null } {
  try {
    const usr = localStorage.getItem(CACHED_USUARIO_KEY);
    const mun = localStorage.getItem(CACHED_MUNICIPIO_KEY);
    return {
      usuario: usr ? JSON.parse(usr) : null,
      munId: mun ? JSON.parse(mun).id : null,
      munNome: mun ? JSON.parse(mun).nome : null,
    };
  } catch {
    return { usuario: null, munId: null, munNome: null };
  }
}

function clearCachedUsuario() {
  try {
    localStorage.removeItem(CACHED_USUARIO_KEY);
    localStorage.removeItem(CACHED_MUNICIPIO_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<HierarquiaUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipioId, setMunicipioId] = useState<string | null>(null);
  const [municipioNome, setMunicipioNome] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const resolverMunicipio = async (usr: HierarquiaUsuario) => {
    const t0 = performance.now();
    try {
      if (usr.municipio_id) {
        setMunicipioId(usr.municipio_id);
        const nome = await buscarNomeMunicipio(usr.municipio_id);
        setMunicipioNome(nome);
        cacheUsuario(usr, usr.municipio_id, nome);
        console.log(`[Auth] resolverMunicipio (direto) ${(performance.now() - t0).toFixed(0)}ms`);
        return;
      }
      if (usr.suplente_id) {
        const munId = await resolverMunicipioId(usr.suplente_id);
        if (munId) {
          setMunicipioId(munId);
          const nome = await buscarNomeMunicipio(munId);
          setMunicipioNome(nome);
          cacheUsuario(usr, munId, nome);
          console.log(`[Auth] resolverMunicipio (suplente) ${(performance.now() - t0).toFixed(0)}ms`);
          return;
        }
      }
      setMunicipioId(null);
      setMunicipioNome(null);
      cacheUsuario(usr, null, null);
    } catch (err) {
      console.error('[Auth] resolverMunicipio error:', err);
      setMunicipioId(null);
      setMunicipioNome(null);
    }
  };

  const fetchUsuario = async (authUserId: string): Promise<HierarquiaUsuario | null> => {
    const t0 = performance.now();
    try {
      const { data, error } = await supabase
        .from('hierarquia_usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('ativo', true)
        .single();
      console.log(`[Auth] fetchUsuario ${(performance.now() - t0).toFixed(0)}ms`);
      if (error) {
        console.error('[Auth] fetchUsuario error:', error.message);
        return null;
      }
      return data as unknown as HierarquiaUsuario;
    } catch (err) {
      console.error('[Auth] fetchUsuario unexpected error:', err);
      return null;
    }
  };

  const initializeUser = async (authUserId: string) => {
    const t0 = performance.now();
    console.log('[Auth] ⏱ initializeUser start');
    setIsOfflineMode(false);

    const usr = await fetchUsuario(authUserId);
    if (!usr) {
      setUsuario(null);
      setMunicipioId(null);
      setMunicipioNome(null);
      console.log(`[Auth] ⏱ initializeUser done (no user) ${(performance.now() - t0).toFixed(0)}ms`);
      return;
    }

    setUsuario(usr);
    await resolverMunicipio(usr);
    console.log(`[Auth] ⏱ initializeUser done ${(performance.now() - t0).toFixed(0)}ms`);
  };

  /**
   * Fallback: if getSession fails (offline/token expired), use cached usuario
   * to allow read-only browsing with persisted React Query data.
   */
  const fallbackToOffline = () => {
    const cached = getCachedUsuario();
    if (cached.usuario) {
      console.warn('[Auth] Falling back to offline mode with cached user data');
      setUsuario(cached.usuario);
      setMunicipioId(cached.munId);
      setMunicipioNome(cached.munNome);
      setIsOfflineMode(true);
    }
  };

  useEffect(() => {
    let initialized = false;
    let active = true;
    const t0 = performance.now();

    const safetyTimeout = setTimeout(() => {
      if (active && !initialized) {
        console.warn('[Auth] Safety timeout (4s) — forcing loading=false');
        // If offline, try cached user
        if (!navigator.onLine) {
          fallbackToOffline();
        }
        setLoading(false);
        initialized = true;
      }
    }, 4000);

    console.log('[Auth] ⏱ getSession start');
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log(`[Auth] ⏱ getSession done ${(performance.now() - t0).toFixed(0)}ms`);
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await initializeUser(session.user.id);
        } else if (!navigator.onLine) {
          // No session but offline — use cached
          fallbackToOffline();
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        if (!navigator.onLine) fallbackToOffline();
      } finally {
        if (active) setLoading(false);
        initialized = true;
        clearTimeout(safetyTimeout);
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err);
      // Offline fallback
      if (!navigator.onLine) fallbackToOffline();
      if (active) setLoading(false);
      initialized = true;
      clearTimeout(safetyTimeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!initialized || !active) return;

      logger.info('auth_state_change', { event });

      if (event === 'TOKEN_REFRESHED') {
        logger.info('token_refreshed');
        setIsOfflineMode(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        logger.info('signed_out');
        setUser(null);
        setUsuario(null);
        setMunicipioId(null);
        setMunicipioNome(null);
        setIsOfflineMode(false);
        clearCachedUsuario();
        if (active) setLoading(false);
        return;
      }

      // IMPORTANT: Do NOT await inside onAuthStateChange — it causes deadlocks.
      // Fire-and-forget the initialization.
      setUser(session?.user ?? null);
      if (session?.user) {
        initializeUser(session.user.id).catch((err) => {
          console.error('[Auth] Auth state change init error:', err);
        });
      } else {
        setUsuario(null);
        setMunicipioId(null);
        setMunicipioNome(null);
      }
    });

    // Listen for online event to re-validate session
    const handleOnline = async () => {
      if (isOfflineMode) {
        console.log('[Auth] Back online — attempting session refresh');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            await initializeUser(session.user.id);
            setIsOfflineMode(false);
            console.log('[Auth] Session restored after reconnect');
          }
        } catch (err) {
          console.error('[Auth] Session refresh on reconnect failed:', err);
        }
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const signIn = async (nome: string, password: string) => {
    const t0 = performance.now();
    console.log('[Auth] ⏱ signIn start');
    const email = nomeToEmail(nome);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    console.log(`[Auth] ⏱ signIn done ${(performance.now() - t0).toFixed(0)}ms, error=${!!error}`);
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // Immediately clear state so UI redirects to login without waiting for network
    setUser(null);
    setUsuario(null);
    setMunicipioId(null);
    setMunicipioNome(null);
    setIsOfflineMode(false);
    setLoading(false);
    clearCachedUsuario();
    // Fire signOut in background — don't block UI on slow/offline network
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // Ignore errors — user is already logged out locally
    }
  };

  const tipo = usuario?.tipo ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      usuario,
      loading,
      isAdmin: tipo === 'super_admin' || tipo === 'coordenador',
      isSuplente: tipo === 'suplente',
      isLideranca: tipo === 'lideranca',
      tipoUsuario: tipo,
      municipioId,
      municipioNome,
      isOfflineMode,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
