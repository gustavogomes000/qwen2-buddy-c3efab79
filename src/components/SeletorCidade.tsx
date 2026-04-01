import { useState, useEffect } from 'react';
import { Building2, Check, ChevronDown, X, Users, Shield, Target } from 'lucide-react';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';

interface Contagens {
  [municipioId: string]: { liderancas: number; fiscais: number; eleitores: number };
}

export default function SeletorCidade() {
  const { cidadeAtiva, setCidadeAtiva, municipios, isTodasCidades } = useCidade();
  const [aberto, setAberto] = useState(false);
  const [contagens, setContagens] = useState<Contagens>({});

  useEffect(() => {
    if (!aberto) return;
    (async () => {
      const counts: Contagens = {};

      // Use municipio_id directly on tables instead of old suplente_id lookup
      const [lidRes, fisRes, eleRes] = await Promise.all([
        (supabase as any).from('liderancas').select('id, municipio_id'),
        (supabase as any).from('fiscais').select('id, municipio_id'),
        (supabase as any).from('possiveis_eleitores').select('id, municipio_id'),
      ]);

      for (const m of municipios) {
        counts[m.id] = {
          liderancas: (lidRes.data || []).filter((l: any) => l.municipio_id === m.id).length,
          fiscais: (fisRes.data || []).filter((f: any) => f.municipio_id === m.id).length,
          eleitores: (eleRes.data || []).filter((e: any) => e.municipio_id === m.id).length,
        };
      }

      setContagens(counts);
    })();
  }, [aberto, municipios]);

  const nomeAtual = isTodasCidades ? 'Todas as cidades' : cidadeAtiva?.nome || 'Selecionar';

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs font-medium text-foreground active:scale-95 transition-all"
      >
        <Building2 size={13} className="text-primary" />
        <span className="truncate max-w-[180px]">{nomeAtual}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAberto(false)} />
          <div className="relative w-full max-w-lg bg-card rounded-t-2xl border-t border-border animate-in slide-in-from-bottom duration-200 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex items-center justify-between px-4 pb-3">
              <h3 className="text-sm font-bold text-foreground">🏙️ Selecionar Cidade</h3>
              <button onClick={() => setAberto(false)} className="p-1 rounded-lg hover:bg-muted">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-1.5">
              <button
                onClick={() => { setCidadeAtiva(null); setAberto(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                  isTodasCidades ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-primary" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-foreground">Todas as cidades</p>
                  <p className="text-[10px] text-muted-foreground">Visão consolidada</p>
                </div>
                {isTodasCidades && <Check size={16} className="text-primary shrink-0" />}
              </button>

              {municipios.map(m => {
                const selected = cidadeAtiva?.id === m.id;
                const c = contagens[m.id] || { liderancas: 0, fiscais: 0, eleitores: 0 };
                const temCadastros = c.liderancas > 0 || c.fiscais > 0 || c.eleitores > 0;

                return (
                  <button
                    key={m.id}
                    onClick={() => { setCidadeAtiva({ id: m.id, nome: m.nome }); setAberto(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                      {temCadastros ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Users size={9} /> {c.liderancas} lid.
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Shield size={9} /> {c.fiscais} fisc.
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Target size={9} /> {c.eleitores} eleit.
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">Nenhum cadastro ainda</p>
                      )}
                    </div>
                    {selected && <Check size={16} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
