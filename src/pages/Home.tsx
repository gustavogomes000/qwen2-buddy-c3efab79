import { useState, useRef, useCallback, lazy, Suspense, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCidade } from '@/contexts/CidadeContext';
import BottomNav, { type TabId } from '@/components/BottomNav';
import SeletorCidade from '@/components/SeletorCidade';
import { useRealtimeSync } from '@/hooks/useDataCache';
import { Loader2 } from 'lucide-react';

const TabLiderancas = lazy(() => import('@/components/TabLiderancas'));
const TabFiscais = lazy(() => import('@/components/TabFiscais'));
const TabEleitores = lazy(() => import('@/components/TabEleitores'));
const TabCadastros = lazy(() => import('@/components/TabCadastros'));
const TabPerfil = lazy(() => import('@/components/TabPerfil'));

const TAB_STORAGE_KEY = 'home-active-tab';

function getInitialTab(): TabId {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY) as TabId | null;
    if (saved && ['liderancas', 'fiscais', 'eleitores', 'cadastros', 'perfil'].includes(saved)) {
      return saved;
    }
  } catch {}
  return 'liderancas';
}

export default function Home() {
  const { isAdmin, tipoUsuario } = useAuth();
  useRealtimeSync();
  const { municipios } = useCidade();
  const [activeTab, setActiveTab] = useState<TabId>(() => getInitialTab());
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set([getInitialTab()]));
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdminOrCoord = tipoUsuario === 'super_admin' || tipoUsuario === 'coordenador';
  const showCitySelector = isAdminOrCoord && municipios.length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const titles: Record<TabId, string> = {
    liderancas: 'Cadastro de Lideranças',
    fiscais: 'Cadastro de Fiscais',
    eleitores: 'Cadastro de Eleitores',
    cadastros: isAdmin ? 'Todos os Cadastros' : 'Meus Cadastros',
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
          <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>}>
            {visitedTabs.has('liderancas') && activeTab === 'liderancas' && <TabLiderancas refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('fiscais') && activeTab === 'fiscais' && <TabFiscais refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('eleitores') && activeTab === 'eleitores' && <TabEleitores refreshKey={refreshKey} onSaved={handleSaved} />}
            {visitedTabs.has('cadastros') && activeTab === 'cadastros' && <TabCadastros refreshKey={refreshKey} onSaved={handleSaved} />}
            
            {activeTab === 'perfil' && <TabPerfil />}
          </Suspense>
        </div>
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
