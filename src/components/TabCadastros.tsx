import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TabLiderancas from '@/components/TabLiderancas';
import TabFiscais from '@/components/TabFiscais';
import TabEleitores from '@/components/TabEleitores';

const subTabs = [
  { id: 'liderancas', label: 'Lideranças' },
  { id: 'fiscais', label: 'Fiscais' },
  { id: 'eleitores', label: 'Eleitores' },
] as const;

type SubTabId = typeof subTabs[number]['id'];

interface Props {
  refreshKey: number;
  onSaved?: () => void;
}

export default function TabCadastros({ refreshKey, onSaved }: Props) {
  const { tipoUsuario } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('liderancas');

  // Filter sub-tabs based on user type (same logic as BottomNav visibility)
  const visibleSubTabs = subTabs.filter(tab => {
    if (tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador') return true;
    if (tab.id === 'liderancas' && (tipoUsuario === 'suplente')) return true;
    if (tab.id === 'fiscais' && (tipoUsuario === 'suplente' || tipoUsuario === 'lideranca')) return true;
    if (tab.id === 'eleitores') return true;
    return false;
  });

  return (
    <div className="space-y-3 pb-24">
      {/* Sub-tab pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {visibleSubTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold active:scale-95 transition-all ${
              activeSubTab === tab.id
                ? 'gradient-primary text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'liderancas' && <TabLiderancas refreshKey={refreshKey} />}
      {activeSubTab === 'fiscais' && <TabFiscais refreshKey={refreshKey} onSaved={onSaved} />}
      {activeSubTab === 'eleitores' && <TabEleitores refreshKey={refreshKey} onSaved={onSaved} />}
    </div>
  );
}
