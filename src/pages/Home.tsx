import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import BottomNav, { type TabId } from '@/components/BottomNav';
import TabLiderancas from '@/components/TabLiderancas';
import TabEleitores from '@/components/TabEleitores';
import TabCadastros from '@/components/TabCadastros';
import TabPerfil from '@/components/TabPerfil';
import SeletorCidade from '@/components/SeletorCidade';
import { Loader2 } from 'lucide-react';

const PainelLocalizacao = lazy(() => import('@/components/PainelLocalizacao'));

export default function Home() {
  const { isAdmin, tipoUsuario } = useAuth();
  const { municipios } = useCidade();
  const [activeTab, setActiveTab] = useState<TabId>('liderancas');
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(new Set(['liderancas']));
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdminOrCoord = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';
  const showCitySelector = isAdminOrCoord && municipios.length > 0;

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const titles: Record<TabId, string> = {
    liderancas: 'Cadastro de Lideranças',
    eleitores: 'Cadastro de Eleitores',
    cadastros: isAdmin ? 'Todos os Cadastros' : 'Meus Cadastros',
    rastreamento: 'Rastreamento',
    perfil: 'Perfil & Usuários',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-[1.5px] gradient-header shrink-0" />

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">{titles[activeTab] || ''}</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Rede política – Dra. Fernanda Sarelli</p>
            </div>
          </div>
          {showCitySelector && activeTab !== 'perfil' && (
            <div className="mt-2">
              <SeletorCidade />
            </div>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-[672px] mx-auto px-4 py-4">
          {visitedTabs.has('liderancas') && (
            <div className={activeTab === 'liderancas' ? '' : 'hidden'}>
              <TabLiderancas refreshKey={refreshKey} onSaved={handleSaved} />
            </div>
          )}
          {visitedTabs.has('eleitores') && (
            <div className={activeTab === 'eleitores' ? '' : 'hidden'}>
              <TabEleitores refreshKey={refreshKey} onSaved={handleSaved} />
            </div>
          )}
          {visitedTabs.has('cadastros') && (
            <div className={activeTab === 'cadastros' ? '' : 'hidden'}>
              <TabCadastros refreshKey={refreshKey} onSaved={handleSaved} />
            </div>
          )}
          {activeTab === 'rastreamento' && <PainelLocalizacao />}
          {activeTab === 'perfil' && <TabPerfil />}
        </div>
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
