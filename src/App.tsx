import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CidadeProvider } from "@/contexts/CidadeContext";
import LoadingScreen from "@/components/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Login from "./pages/Login";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import CadastrosExternos from "./pages/CadastrosExternos";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
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
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
      <Route path="/admin/externos" element={<PrivateRoute><CadastrosExternos /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <CidadeProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </CidadeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
