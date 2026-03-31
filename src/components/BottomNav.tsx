import { PlusCircle, List, UserCircle, BarChart3, Shield, Users, Network } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export type TabId = 'liderancas' | 'fiscais' | 'eleitores' | 'cadastros' | 'rede' | 'perfil';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function BottomNav({ active, onChange }: Props) {
  const { isAdmin, tipoUsuario, usuario } = useAuth();
  const navigate = useNavigate();

  // "Agente de campo" = lideranca sem suplente_id (usuário livre)
  const isAgenteCampo = tipoUsuario === 'lideranca' && !usuario?.suplente_id;

  // Build tabs dynamically based on user type
  const tabs: { id: TabId; icon: typeof PlusCircle; label: string }[] = [];

  if (isAgenteCampo) {
    // Agentes de campo só veem Eleitores + Perfil
    tabs.push({ id: 'eleitores', icon: Users, label: 'Eleitores' });
    tabs.push({ id: 'perfil', icon: UserCircle, label: 'Perfil' });
  } else {
    // Everyone can register lideranças/fiscais/eleitores
    tabs.push({ id: 'liderancas', icon: PlusCircle, label: 'Lideranças' });

    // Suplentes, lideranças, coordenadores and admins see fiscais
    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador' || tipoUsuario === 'suplente' || tipoUsuario === 'lideranca') {
      tabs.push({ id: 'fiscais', icon: Shield, label: 'Fiscais' });
    }

    // Everyone sees eleitores tab
    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador' || tipoUsuario === 'suplente' || tipoUsuario === 'lideranca' || tipoUsuario === 'fiscal') {
      tabs.push({ id: 'eleitores', icon: Users, label: 'Eleitores' });
    }

    // Cadastros: unified view of all registrations
    tabs.push({ id: 'cadastros', icon: List, label: 'Cadastros' });

    // Admin sees full network view by suplente
    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador') {
      tabs.push({ id: 'rede', icon: Network, label: 'Rede' });
    }

    tabs.push({ id: 'perfil', icon: UserCircle, label: 'Perfil' });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="max-w-[672px] mx-auto flex justify-around items-center h-16">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all active:scale-90 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all active:scale-90 text-muted-foreground"
          >
            <BarChart3 size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">Dashboard</span>
          </button>
        )}
      </div>
    </nav>
  );
}
