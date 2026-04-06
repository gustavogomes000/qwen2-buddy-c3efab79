import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Evento {
  id: string;
  nome: string;
  local: string | null;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
}

interface EventoContextType {
  eventos: Evento[];
  eventoAtivo: Evento | null;
  setEventoAtivoId: (id: string | null) => void;
  loading: boolean;
  refetch: () => void;
}

const EventoContext = createContext<EventoContextType | undefined>(undefined);

const EVENTO_STORAGE_KEY = 'sarelli_evento_ativo_id';

export function EventoProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoAtivoId, setEAId] = useState<string | null>(() => {
    try { return localStorage.getItem(EVENTO_STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const fetchEventos = async () => {
    if (!usuario) { setLoading(false); return; }
    try {
      const { data } = await (supabase as any)
        .from('eventos')
        .select('id, nome, local, descricao, ativo, criado_em')
        .eq('ativo', true)
        .order('criado_em', { ascending: false });
      setEventos(data || []);
    } catch { setEventos([]); }
    setLoading(false);
  };

  useEffect(() => { fetchEventos(); }, [usuario]);

  const setEventoAtivoId = (id: string | null) => {
    setEAId(id);
    try {
      if (id) localStorage.setItem(EVENTO_STORAGE_KEY, id);
      else localStorage.removeItem(EVENTO_STORAGE_KEY);
    } catch {}
  };

  const eventoAtivo = eventoAtivoId ? eventos.find(e => e.id === eventoAtivoId) || null : null;

  return (
    <EventoContext.Provider value={{ eventos, eventoAtivo, setEventoAtivoId, loading, refetch: fetchEventos }}>
      {children}
    </EventoContext.Provider>
  );
}

export function useEvento() {
  const ctx = useContext(EventoContext);
  if (!ctx) throw new Error('useEvento must be used within EventoProvider');
  return ctx;
}
