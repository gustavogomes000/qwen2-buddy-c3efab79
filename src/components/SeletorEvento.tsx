import { useState } from 'react';
import { Calendar, X, Check, ChevronDown } from 'lucide-react';
import { useEvento } from '@/contexts/EventoContext';

export default function SeletorEvento() {
  const { eventos, eventoAtivo, setEventoAtivoId } = useEvento();
  const [open, setOpen] = useState(false);

  if (eventos.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all active:scale-[0.98] ${
          eventoAtivo
            ? 'border-primary/30 bg-primary/5 text-primary'
            : 'border-border bg-muted text-muted-foreground'
        }`}
      >
        <Calendar size={13} />
        <span className="flex-1 text-left truncate">
          {eventoAtivo ? eventoAtivo.nome : 'Selecionar evento...'}
        </span>
        {eventoAtivo && (
          <button
            onClick={e => { e.stopPropagation(); setEventoAtivoId(null); }}
            className="p-0.5 hover:bg-primary/10 rounded"
          >
            <X size={11} />
          </button>
        )}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {eventos.map(e => (
            <button
              key={e.id}
              onClick={() => { setEventoAtivoId(e.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-xs hover:bg-muted/50 transition-all ${
                eventoAtivo?.id === e.id ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground'
              }`}
            >
              {eventoAtivo?.id === e.id && <Check size={12} className="text-primary shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{e.nome}</p>
                {e.local && <p className="text-[10px] text-muted-foreground truncate">{e.local}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
