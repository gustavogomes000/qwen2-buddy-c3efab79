import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav, { type TabId } from '@/components/BottomNav';
import TabCadastrar from '@/components/TabCadastrar';
import TabLiderancas from '@/components/TabLiderancas';
import TabFiscais from '@/components/TabFiscais';
import TabEleitores from '@/components/TabEleitores';
import TabRede from '@/components/TabRede';
import TabPerfil from '@/components/TabPerfil';
import TabHierarquia from '@/components/TabHierarquia';
import PainelLocalizacao from '@/components/PainelLocalizacao';
import TabCriarUsuarios from '@/components/TabCriarUsuarios';
import TabSuplentes from '@/components/TabSuplentes';

export default function Home() {
  const { isAdmin, tipoUsuario, usuario } = useAuth();
  const isAgenteCampo = tipoUsuario === 'lideranca' && !usuario?.suplente_id;
  const [activeTab, setActiveTab] = useState<TabId>(isAgenteCampo ? 'eleitores' : 'cadastrar');
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const handleSaved = () => {
    setRefreshKey(k => k + 1);
  };

  const titles: Record<TabId, string> = {
    cadastrar: tipoUsuario === 'fiscal' ? 'Cadastrar Eleitor' : tipoUsuario === 'lideranca' ? 'Cadastrar Fiscal' : 'Novo Cadastro',
    suplentes: 'Suplentes',
    liderancas: isAdmin ? 'Todas as Lideranças' : 'Minhas Lideranças',
    fiscais: isAdmin ? 'Todos os Fiscais' : 'Meus Fiscais',
    eleitores: isAdmin ? 'Todos os Eleitores' : 'Meus Eleitores',
    arvore: 'Árvore Hierárquica',
    rede: 'Rede por Suplente',
    rastreamento: 'Rastreamento',
    importar: 'Importar Usuários',
    perfil: 'Perfil',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-[1.5px] gradient-header shrink-0" />

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-foreground">{titles[activeTab] || ''}</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Rede política – Dra. Fernanda Sarelli</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-[672px] mx-auto px-4 py-4 animate-in">
          {activeTab === 'cadastrar' && <TabCadastrar onSaved={handleSaved} />}
          {activeTab === 'suplentes' && <TabSuplentes refreshKey={refreshKey} />}
          {activeTab === 'liderancas' && <TabLiderancas refreshKey={refreshKey} />}
          {activeTab === 'fiscais' && <TabFiscais refreshKey={refreshKey} onSaved={handleSaved} />}
          {activeTab === 'eleitores' && <TabEleitores refreshKey={refreshKey} onSaved={handleSaved} />}
          {activeTab === 'arvore' && <TabHierarquia />}
          {activeTab === 'rede' && <TabRede />}
          {activeTab === 'rastreamento' && <PainelLocalizacao />}
          {activeTab === 'importar' && <TabCriarUsuarios />}
          {activeTab === 'perfil' && <TabPerfil />}
        </div>
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
