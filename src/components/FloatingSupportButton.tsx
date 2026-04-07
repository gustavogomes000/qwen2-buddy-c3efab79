import { MessageCircle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PHONE = '5562993885258';
const MESSAGE = encodeURIComponent('Olá! Preciso de ajuda com o sistema Rede Política.');

export default function FloatingSupportButton() {
  const navigate = useNavigate();

  const handleOpen = () => {
    window.open(`https://wa.me/${PHONE}?text=${MESSAGE}`, '_blank', 'noopener');
  };

  const handleConheca = () => {
    navigate('/');
  };

  const pillStyle = {
    background: 'rgba(236,72,153,0.12)',
    color: '#c06',
    backdropFilter: 'blur(8px)',
  };

  return (
    <div className="fixed top-[env(safe-area-inset-top,12px)] right-3 z-[9999] flex items-center gap-1.5 mt-1">
      <button
        onClick={handleConheca}
        aria-label="Conheça Doutora"
        className="flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-medium transition-all active:scale-95 hover:opacity-90"
        style={pillStyle}
      >
        <Globe size={12} strokeWidth={2} />
        Conheça Doutora
      </button>
      <button
        onClick={handleOpen}
        aria-label="Suporte"
        className="flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-medium transition-all active:scale-95 hover:opacity-90"
        style={pillStyle}
      >
        <MessageCircle size={12} strokeWidth={2} />
        Suporte
      </button>
    </div>
  );
}
