import { PlusCircle, List, UserCircle, BarChart3, Shield, Users, Network, MapPin, DollarSign, GitBranch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export type TabId = 'liderancas' | 'fiscais' | 'eleitores' | 'cadastros' | 'rede' | 'perfil' | 'rastreamento' | 'pagamentos' | 'hierarquia';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function BottomNav({ active, onChange }: Props) {
  const { isAdmin, tipoUsuario, usuario } = useAuth();
  const navigate = useNavigate();

  const isAgenteCampo = tipoUsuario === 'lideranca' && !usuario?.suplente_id;

  const tabs: { id: TabId; icon: typeof PlusCircle; label: string }[] = [];

  if (isAgenteCampo) {
    tabs.push({ id: 'eleitores', icon: Users, label: 'Eleitores' });
    tabs.push({ id: 'perfil', icon: UserCircle, label: 'Perfil' });
  } else {
    tabs.push({ id: 'liderancas', icon: PlusCircle, label: 'Cadastrar' });

    tabs.push({ id: 'cadastros', icon: List, label: 'Cadastros' });

    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador') {
      tabs.push({ id: 'hierarquia', icon: GitBranch, label: 'Usuários' });
      tabs.push({ id: 'rede', icon: Network, label: 'Rede' });
      tabs.push({ id: 'pagamentos', icon: DollarSign, label: 'Pgtos' });
    }

    if (tipoUsuario === 'super_admin') {
      tabs.push({ id: 'rastreamento', icon: MapPin, label: 'Rastro' });
    }

    tabs.push({ id: 'perfil', icon: UserCircle, label: 'Perfil' });
  }

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
