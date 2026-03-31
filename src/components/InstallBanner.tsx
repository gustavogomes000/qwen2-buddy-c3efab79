import { useState, useEffect } from 'react';
import { Download, X, Share, MoreVertical } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android-chrome' | 'android-other' | 'desktop'>('desktop');

  useEffect(() => {
    // Don't show in iframe/preview
    try { if (window.self !== window.top) return; } catch { return; }
    if (window.location.hostname.includes('lovableproject.com')) return;
    if (window.location.hostname.includes('id-preview--')) return;

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((navigator as any).standalone === true) return;

    // Check dismissed recently
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 3 * 24 * 60 * 60 * 1000) return;

    const ua = navigator.userAgent.toLowerCase();

    // iOS detection
    const isiOS = /ipad|iphone|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isiOS) {
      setPlatform('ios');
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    // Android detection
    const isAndroid = /android/.test(ua);
    const isChrome = /chrome/.test(ua) && !/edge|opr|samsung/.test(ua);

    // Listen for native install prompt (Chrome on Android)
    let promptFired = false;
    const handler = (e: Event) => {
      e.preventDefault();
      promptFired = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform('android-chrome');
      setTimeout(() => setShowBanner(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // If after 4 seconds no prompt fired, show manual instructions
    const fallbackTimer = setTimeout(() => {
      if (!promptFired) {
        if (isAndroid) {
          setPlatform(isChrome ? 'android-chrome' : 'android-other');
        } else {
          setPlatform('desktop');
        }
        setShowBanner(true);
      }
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  // iOS guide
  if (platform === 'ios') {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[60] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Download size={16} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Instalar App</p>
                <p className="text-[10px] text-muted-foreground">Acesse rápido pela tela inicial</p>
              </div>
            </div>
            <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-muted">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-foreground font-medium">Como instalar no iPhone:</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
              Toque em <Share size={14} className="text-primary mx-0.5 shrink-0" /> (botão compartilhar)
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
              Selecione "Adicionar à Tela de Início"
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
              Toque em "Adicionar"
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android with native prompt available
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[60] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <span className="text-sm font-black text-primary-foreground">FS</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Instalar Rede Sarelli</p>
              <p className="text-[10px] text-muted-foreground">Acesse como app no seu celular</p>
            </div>
            <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-muted shrink-0">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          <button onClick={handleInstall}
            className="w-full mt-3 h-11 gradient-primary text-primary-foreground font-semibold rounded-xl active:scale-[0.97] transition-all flex items-center justify-center gap-2">
            <Download size={16} /> Instalar App
          </button>
        </div>
      </div>
    );
  }

  // Android/other browsers - manual instructions
  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
              <Download size={16} className="text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Instalar App</p>
              <p className="text-[10px] text-muted-foreground">Adicione à tela inicial do celular</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-muted">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-foreground font-medium">Como instalar:</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
            Toque em <MoreVertical size={14} className="text-primary mx-0.5 shrink-0" /> (menu do navegador)
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
            Selecione "Instalar app" ou "Adicionar à tela inicial"
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
            Confirme tocando em "Instalar"
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            💡 Use o Chrome para melhor experiência
          </p>
        </div>
      </div>
    </div>
  );
}
