import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type TipoUsuario = 'super_admin' | 'coordenador' | 'suplente' | 'lideranca' | 'fiscal';

interface HierarquiaUsuario {
  id: string;
  auth_user_id: string;
  nome: string;
  tipo: TipoUsuario;
  superior_id: string | null;
  suplente_id: string | null;
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  usuario: HierarquiaUsuario | null;
  loading: boolean;
  isAdmin: boolean;
  isSuplente: boolean;
  isLideranca: boolean;
  isFiscal: boolean;
  tipoUsuario: TipoUsuario | null;
  signIn: (nome: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function nomeToEmail(nome: string): string {
  const slug = nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  return `${slug}@rede.sarelli.com`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<HierarquiaUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async (authUserId: string) => {
    const { data } = await supabase
      .from('hierarquia_usuarios')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('ativo', true)
      .single();
    if (data) {
      setUsuario(data as unknown as HierarquiaUsuario);
    }
  };

  useEffect(() => {
    let initialized = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUsuario(session.user.id);
      }
      setLoading(false);
      initialized = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initialized) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUsuario(session.user.id);
      } else {
        setUsuario(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (nome: string, password: string) => {
    const email = nomeToEmail(nome);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUsuario(null);
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
      isFiscal: tipo === 'fiscal',
      tipoUsuario: tipo,
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
