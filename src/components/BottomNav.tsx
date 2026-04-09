import { useState, useEffect } from 'react';
import { Users, UserCircle, BarChart3, Target, List, Search, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getPendingCount } from '@/lib/offlineQueue';
import { onSyncStatusChange } from '@/services/offlineSync';

export type TabId = 'liderancas' | 'fiscais' | 'eleitores' | 'cadastros' | 'perfil';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const ALL_TABS: { id: TabId; icon: typeof Users; label: string; module?: string }[] = [
  { id: 'liderancas', icon: Users, label: 'Lideranças', module: 'cadastrar_liderancas' },
  { id: 'fiscais', icon: Search, label: 'Fiscais', module: 'cadastrar_fiscais' },
  { id: 'eleitores', icon: Target, label: 'Eleitores', module: 'cadastrar_eleitores' },
  { id: 'cadastros', icon: List, label: 'Cadastros' },
  { id: 'perfil', icon: UserCircle, label: 'Perfil' },
];

export default function BottomNav({ active, onChange }: Props) {
  const { isAdmin, tipoUsuario, usuario } = useAuth();
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Track online/offline status
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  // Track pending offline registrations
  useEffect(() => {
    const refresh = () => getPendingCount().then(setPendingCount);
    refresh();
    const interval = setInterval(refresh, 5000);
    const unsub = onSyncStatusChange(refresh);
    return () => { clearInterval(interval); unsub(); };
  }, []);

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
    // Module-based tabs
    if (tab.module) {
      if (isAdminOrCoord) return true;
      if (modulos.has('master')) return true;
      // cadastrar_liderancas grants access to lideranças, fiscais AND eleitores
      if (modulos.has('cadastrar_liderancas')) return true;
      // cadastrar_eleitores grants access ONLY to eleitores
      if (tab.module === 'cadastrar_eleitores' && modulos.has('cadastrar_eleitores')) return true;
      return false;
    }
    return false;
  });

  if (!loaded) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom">
      {/* Offline banner */}
      {(isOffline || pendingCount > 0) && (
        <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-medium ${isOffline ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}>
          {isOffline && <><WifiOff size={14} /> Sem internet</>}
          {pendingCount > 0 && <span>• {pendingCount} cadastro{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}</span>}
        </div>
      )}
      <div className="max-w-[672px] mx-auto flex justify-around items-center h-16 overflow-x-auto scrollbar-hide">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;

          // Insert Painel button right before Perfil — only for admin/coord
          const painelBtn = id === 'perfil' && isAdmin ? (
            <button
              key="painel"
              onClick={() => navigate('/admin')}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all active:scale-90 text-muted-foreground shrink-0"
            >
              <BarChart3 size={20} strokeWidth={1.5} />
              <span className="text-[9px] font-medium">Painel</span>
            </button>
          ) : null;

          return (
            <span key={id} className="contents">
              {painelBtn}
              <button
                data-testid={`nav-${id}`}
                onClick={() => onChange(id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all active:scale-90 shrink-0 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className={`text-[9px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            </span>
          );
        })}
      </div>
    </nav>
  );
}
