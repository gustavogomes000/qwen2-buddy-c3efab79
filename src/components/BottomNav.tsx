import { useState, useEffect } from 'react';
import { Users, UserCircle, BarChart3, MapPin, Shield, Target, List } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export type TabId = 'liderancas' | 'fiscais' | 'eleitores' | 'cadastros' | 'rastreamento' | 'perfil';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const ALL_TABS: { id: TabId; icon: typeof Users; label: string; module?: string }[] = [
  { id: 'liderancas', icon: Users, label: 'Lideranças', module: 'cadastrar_liderancas' },
  { id: 'fiscais', icon: Shield, label: 'Fiscais', module: 'cadastrar_fiscais' },
  { id: 'eleitores', icon: Target, label: 'Eleitores', module: 'cadastrar_eleitores' },
  { id: 'cadastros', icon: List, label: 'Cadastros' },
  { id: 'rastreamento', icon: MapPin, label: 'Rastro' },
  { id: 'perfil', icon: UserCircle, label: 'Perfil' },
];

export default function BottomNav({ active, onChange }: Props) {
  const { isAdmin, tipoUsuario, usuario } = useAuth();
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!usuario?.id) return;
    // Super admin / coordenador see everything
    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador') {
      setModulos(new Set(['master', 'cadastrar_liderancas', 'cadastrar_fiscais', 'cadastrar_eleitores']));
      setLoaded(true);
      return;
    }
    // Fetch modules for this user
    supabase.from('usuario_modulos').select('modulo').eq('usuario_id', usuario.id)
      .then(({ data }) => {
        if (data) setModulos(new Set(data.map((d: any) => d.modulo)));
        setLoaded(true);
      });
  }, [usuario?.id, tipoUsuario]);

  const isSuperAdmin = tipoUsuario === 'super_admin';
  const isAdminOrCoord = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';

  const tabs = ALL_TABS.filter(tab => {
    // Perfil always visible
    if (tab.id === 'perfil') return true;
    // Cadastros (meus cadastros) - visible to everyone
    if (tab.id === 'cadastros') return true;
    // Rastreamento - super_admin only
    if (tab.id === 'rastreamento') return isSuperAdmin;
    // Module-based tabs
    if (tab.module) {
      if (isAdminOrCoord) return true;
      if (modulos.has('master')) return true;
      return modulos.has(tab.module);
    }
    return false;
  });

  if (!loaded) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="max-w-[672px] mx-auto flex justify-around items-center h-16 overflow-x-auto scrollbar-hide">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all active:scale-90 shrink-0 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[9px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all active:scale-90 text-muted-foreground shrink-0"
          >
            <BarChart3 size={20} strokeWidth={1.5} />
            <span className="text-[9px] font-medium">Painel</span>
          </button>
        )}
      </div>
    </nav>
  );
}
