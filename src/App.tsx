import { lazy, Suspense, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CidadeProvider } from "@/contexts/CidadeContext";
import { EventoProvider } from "@/contexts/EventoContext";
import LoadingScreen from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { startAutoSync, syncOfflineData } from "@/services/offlineSync";
import SyncStatusBanner from "@/components/SyncStatusBanner";
import { createIdbPersister } from "@/lib/queryPersistence";
import { useRegisterSW } from 'virtual:pwa-register/react';

import { getPendingCount } from "@/lib/offlineQueue";

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
  // user is set but usuario still loading (initializeUser in progress)
  if (user && !usuario) return <LoadingScreen message="Carregando perfil..." showProgress />;
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

/** PWA silent auto-update — no popup, reloads automatically */
function PwaSilentUpdater() {
  const updateBlockedRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Check for updates every 30 seconds (balanced: fast OTA without battery drain)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30_000);
      }
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    },
  });

  // Auto-apply update when available — no user action needed
  useEffect(() => {
    if (needRefresh) {
      console.log('[SW] New version available, updating silently...');
      // Wait for pending offline items to finish syncing before reload
      const tryUpdate = async () => {
        const pending = await getPendingCount();
        if (pending > 0) {
          console.log(`[SW] ${pending} offline items pending, deferring update...`);
          updateBlockedRef.current = true;
          return; // Will retry on next interval
        }
        updateBlockedRef.current = false;
        updateServiceWorker(true);
      };
      const t = setTimeout(tryUpdate, 2000);
      // If blocked, retry every 10s
      const retryInterval = setInterval(async () => {
        if (!updateBlockedRef.current) return;
        const pending = await getPendingCount();
        if (pending === 0) {
          console.log('[SW] Offline queue clear, proceeding with update');
          updateBlockedRef.current = false;
          updateServiceWorker(true);
          clearInterval(retryInterval);
        }
      }, 10_000);
      return () => { clearTimeout(t); clearInterval(retryInterval); };
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: '',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
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
              <EventoProvider>
                <ErrorBoundary>
                  <PwaSilentUpdater />
                  <OfflineSyncManager />
                  <SyncStatusBanner />
                  <AppRoutes />
                </ErrorBoundary>
              </EventoProvider>
            </CidadeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
