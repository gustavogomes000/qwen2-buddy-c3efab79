import { useEffect, useState } from 'react';

interface Props {
  message?: string;
  showProgress?: boolean;
}

export default function LoadingScreen({ message = 'Carregando...', showProgress = false }: Props) {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    if (!showProgress) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) return p;
        return p + Math.random() * 15;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [showProgress]);

  return (
    <div className="h-full bg-background flex flex-col items-center justify-center gap-6 px-8">
      {/* Logo animado */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-primary/15 absolute -inset-2 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="w-20 h-20 rounded-2xl bg-primary/10 absolute -inset-2 animate-pulse" />
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center relative shadow-lg shadow-primary/20">
          <span className="text-2xl font-black text-primary-foreground">FS</span>
        </div>
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-base font-bold text-foreground">Rede Sarelli</h2>
        <p className="text-sm text-muted-foreground">{message}{dots}</p>
      </div>

      {/* Barra de progresso */}
      {showProgress && (
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full gradient-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          />
        </div>
      )}

      {/* Spinner sutil */}
      {!showProgress && (
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      )}

      <p className="text-[9px] text-muted-foreground/50 absolute bottom-8">
        Dra. Fernanda Sarelli · Pré-candidata 2026
      </p>
    </div>
  );
}
