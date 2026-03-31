import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav, { type TabId } from '@/components/BottomNav';
import TabCadastrar from '@/components/TabCadastrar';
import TabFiscais from '@/components/TabFiscais';
import TabEleitores from '@/components/TabEleitores';
import TabCadastros from '@/components/TabCadastros';
import TabRede from '@/components/TabRede';
import TabPerfil from '@/components/TabPerfil';

export default function Home() {
  const { isAdmin, tipoUsuario, usuario } = useAuth();
  const isAgenteCampo = tipoUsuario === 'lideranca' && !usuario?.suplente_id;
  const [activeTab, setActiveTab] = useState<TabId>(isAgenteCampo ? 'eleitores' : 'liderancas');
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const handleSaved = () => {
    setRefreshKey(k => k + 1);
    if (activeTab === 'liderancas') setActiveTab('cadastros');
  };

  const getTitle = () => {
    if (activeTab === 'liderancas') {
      if (tipoUsuario === 'fiscal') return 'Cadastrar Eleitor';
      if (tipoUsuario === 'lideranca') return 'Cadastrar Fiscal';
      return 'Nova Liderança';
    }
    if (activeTab === 'fiscais') return isAdmin ? 'Todos os Fiscais' : 'Meus Fiscais';
    if (activeTab === 'eleitores') return isAdmin ? 'Todos os Eleitores' : 'Meus Eleitores';
    if (activeTab === 'cadastros') return isAdmin ? 'Todos os Cadastros' : 'Meus Cadastros';
    if (activeTab === 'rede') return 'Rede por Suplente';
    if (activeTab === 'perfil') return 'Perfil';
    return '';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-[1.5px] gradient-header shrink-0" />

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-foreground">{getTitle()}</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Rede política – Dra. Fernanda Sarelli</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-[672px] mx-auto px-4 py-4 animate-in">
          {activeTab === 'liderancas' && <TabCadastrar onSaved={handleSaved} />}
          {activeTab === 'fiscais' && <TabFiscais refreshKey={refreshKey} onSaved={() => setRefreshKey(k => k + 1)} />}
          {activeTab === 'eleitores' && <TabEleitores refreshKey={refreshKey} onSaved={() => setRefreshKey(k => k + 1)} />}
          {activeTab === 'cadastros' && <TabCadastros refreshKey={refreshKey} onSaved={() => setRefreshKey(k => k + 1)} />}
          {activeTab === 'rede' && <TabRede />}
          {activeTab === 'perfil' && <TabPerfil />}
        </div>
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
