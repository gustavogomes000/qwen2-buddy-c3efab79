import { lazy, Suspense, useEffect, useState, useCallback, forwardRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CidadeProvider } from "@/contexts/CidadeContext";
import LoadingScreen from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { startAutoSync, syncOfflineData } from "@/services/offlineSync";
import { createIdbPersister } from "@/lib/queryPersistence";
import { useRegisterSW } from 'virtual:pwa-register/react';

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const idbPersister = createIdbPersister();

// Only persist critical data queries (liderancas, eleitores, fiscais, municipios, etc.)
const PERSISTED_QUERY_PREFIXES = ['liderancas', 'eleitores', 'fiscais', 'contagens', 'hierarquia_usuarios'];

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, usuario } = useAuth();
  if (loading) return <LoadingScreen message="Verificando acesso" showProgress />;
  if (!user) return <Navigate to="/login" replace />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, usuario } = useAuth();
  if (loading) return <LoadingScreen message="Carregando..." />;
  if (user && usuario) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen message="Carregando..." />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function OfflineSyncManager() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      startAutoSync();
    }, 3000);
    
    const handler = () => syncOfflineData();
    window.addEventListener('sync-offline-data', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('sync-offline-data', handler);
    };
  }, [user]);
  
  return null;
}

/** PWA Update Banner — prompts user to reload when new version is available */
function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[SW] Registered:', swUrl);
      // Check for updates every 60s
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60_000);
      }
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    },
  });

  const close = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex items-center gap-3 max-w-md mx-auto">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Nova versão disponível</p>
          <p className="text-xs text-muted-foreground">Atualize para a última versão.</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-4 py-2 text-xs font-semibold rounded-lg text-white"
          style={{ background: 'linear-gradient(135deg, #ec4899, #f59e0b)' }}
        >
          Atualizar
        </button>
        <button onClick={close} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>
    </div>
  );
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: idbPersister,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      buster: '', // Change this to invalidate all persisted caches
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          // Only persist queries whose key starts with one of our critical prefixes
          const key = query.queryKey[0];
          if (typeof key !== 'string') return false;
          return PERSISTED_QUERY_PREFIXES.includes(key) && query.state.status === 'success';
        },
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Analytics />
      <SpeedInsights />
      <BrowserRouter>
        <AuthProvider>
          <CidadeProvider>
            <ErrorBoundary>
              <PwaUpdatePrompt />
              <OfflineSyncManager />
              <AppRoutes />
            </ErrorBoundary>
          </CidadeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
