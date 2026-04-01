import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startLocationTracking, stopLocationTracking, registerBackgroundSync } from '@/services/locationTracker';
import { resolverMunicipioId, buscarNomeMunicipio } from '@/lib/resolverMunicipio';
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
  municipio_id?: string | null;
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
  municipioId: string | null;
  municipioNome: string | null;
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
  const [municipioId, setMunicipioId] = useState<string | null>(null);
  const [municipioNome, setMunicipioNome] = useState<string | null>(null);

  const resolverMunicipio = async (usr: HierarquiaUsuario) => {
    try {
      // 1. Se tem municipio_id direto
      if (usr.municipio_id) {
        setMunicipioId(usr.municipio_id);
        const nome = await buscarNomeMunicipio(usr.municipio_id);
        setMunicipioNome(nome);
        return;
      }
      // 2. Se tem suplente_id, buscar via suplente_municipio
      if (usr.suplente_id) {
        const munId = await resolverMunicipioId(usr.suplente_id);
        if (munId) {
          setMunicipioId(munId);
          const nome = await buscarNomeMunicipio(munId);
          setMunicipioNome(nome);
          return;
        }
      }
      // 3. Avulso sem municipio
      setMunicipioId(null);
      setMunicipioNome(null);
    } catch {
      setMunicipioId(null);
      setMunicipioNome(null);
    }
  };

  const fetchUsuario = async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('hierarquia_usuarios')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('ativo', true)
        .single();
      if (error) {
        console.error('Erro ao buscar usuário:', error.message);
        setUsuario(null);
        return;
      }
      if (data) {
        const usr = data as unknown as HierarquiaUsuario;
        setUsuario(usr);
        await resolverMunicipio(usr);
      } else {
        setUsuario(null);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar usuário:', err);
      setUsuario(null);
    }
  };

  useEffect(() => {
    let initialized = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUsuario(session.user.id);
          startLocationTracking();
          registerBackgroundSync();
        }
      } catch (err) {
        console.error('Erro na inicialização:', err);
      } finally {
        setLoading(false);
        initialized = true;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initialized) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUsuario(session.user.id);
        startLocationTracking();
        registerBackgroundSync();
      } else {
        setUsuario(null);
        setMunicipioId(null);
        setMunicipioNome(null);
        stopLocationTracking();
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      stopLocationTracking();
    };
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
    setMunicipioId(null);
    setMunicipioNome(null);
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
      municipioId,
      municipioNome,
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
