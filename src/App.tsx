import { lazy, Suspense, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CidadeProvider } from "@/contexts/CidadeContext";
import LoadingScreen from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { startAutoSync, syncOfflineData } from "@/services/offlineSync";

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

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
    // Defer sync start to avoid blocking initial render
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Analytics />
      <SpeedInsights />
      <BrowserRouter>
        <AuthProvider>
          <CidadeProvider>
            <ErrorBoundary>
              <OfflineSyncManager />
              <AppRoutes />
            </ErrorBoundary>
          </CidadeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
