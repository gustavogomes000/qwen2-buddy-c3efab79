import { useState, useEffect } from 'react';
import { Building2, Check, ChevronDown, X, Users, Shield, Target, Loader2 } from 'lucide-react';
import { useCidade } from '@/contexts/CidadeContext';
import { supabase } from '@/integrations/supabase/client';

interface ContagemCidade {
  liderancas: number;
  fiscais: number;
  eleitores: number;
}

export default function SeletorCidade() {
  const { cidadeAtiva, setCidadeAtiva, municipios, isTodasCidades } = useCidade();
  const [aberto, setAberto] = useState(false);
  const [contagens, setContagens] = useState<Record<string, ContagemCidade>>({});
  const [totalGeral, setTotalGeral] = useState<ContagemCidade>({ liderancas: 0, fiscais: 0, eleitores: 0 });
  const [loadingContagens, setLoadingContagens] = useState(false);

  useEffect(() => {
    if (!aberto || municipios.length === 0) return;
    let cancelled = false;

    (async () => {
      setLoadingContagens(true);

      // Use count queries (head: true) per municipality — efficient, no row limit issues
      const counts: Record<string, ContagemCidade> = {};
      const totals: ContagemCidade = { liderancas: 0, fiscais: 0, eleitores: 0 };

      const queries = municipios.flatMap(m => [
        (supabase as any).from('liderancas').select('*', { count: 'exact', head: true }).eq('municipio_id', m.id).then((r: any) => ({ mId: m.id, tipo: 'liderancas' as const, count: r.count ?? 0 })),
        (supabase as any).from('fiscais').select('*', { count: 'exact', head: true }).eq('municipio_id', m.id).then((r: any) => ({ mId: m.id, tipo: 'fiscais' as const, count: r.count ?? 0 })),
        (supabase as any).from('possiveis_eleitores').select('*', { count: 'exact', head: true }).eq('municipio_id', m.id).then((r: any) => ({ mId: m.id, tipo: 'eleitores' as const, count: r.count ?? 0 })),
      ]);

      const results = await Promise.all(queries);
      if (cancelled) return;

      for (const m of municipios) {
        counts[m.id] = { liderancas: 0, fiscais: 0, eleitores: 0 };
      }

      for (const r of results) {
        if (counts[r.mId]) {
          counts[r.mId][r.tipo] = r.count;
          totals[r.tipo] += r.count;
        }
      }

      setContagens(counts);
      setTotalGeral(totals);
      setLoadingContagens(false);
    })();

    return () => { cancelled = true; };
  }, [aberto, municipios]);

  const nomeAtual = isTodasCidades ? 'Todas as cidades' : cidadeAtiva?.nome || 'Selecionar';
  const totalGeralNum = totalGeral.liderancas + totalGeral.fiscais + totalGeral.eleitores;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs font-medium text-foreground active:scale-[0.98] transition-all"
      >
        <Building2 size={14} className="text-primary shrink-0" />
        <span className="flex-1 text-left truncate">{nomeAtual}</span>
        <ChevronDown size={13} className="text-muted-foreground shrink-0" />
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
              {/* Todas as cidades */}
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
                  {loadingContagens ? (
                    <Loader2 size={10} className="animate-spin text-muted-foreground mt-0.5" />
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">{totalGeralNum} cadastros</span>
                      {totalGeralNum > 0 && (
                        <>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <CityBadges c={totalGeral} />
                        </>
                      )}
                    </div>
                  )}
                </div>
                {isTodasCidades && <Check size={16} className="text-primary shrink-0" />}
              </button>

              {/* Cidades individuais */}
              {municipios.map(m => {
                const selected = cidadeAtiva?.id === m.id;
                const c = contagens[m.id] || { liderancas: 0, fiscais: 0, eleitores: 0 };
                const total = c.liderancas + c.fiscais + c.eleitores;

                return (
                  <button
                    key={m.id}
                    onClick={() => { setCidadeAtiva({ id: m.id, nome: m.nome }); setAberto(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      total > 0 ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Building2 size={18} className={total > 0 ? 'text-primary' : 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                        {total > 0 && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            {total}
                          </span>
                        )}
                      </div>
                      {loadingContagens ? (
                        <Loader2 size={10} className="animate-spin text-muted-foreground mt-0.5" />
                      ) : total > 0 ? (
                        <CityBadges c={c} />
                      ) : (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Nenhum cadastro</p>
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

function CityBadges({ c }: { c: ContagemCidade }) {
  return (
    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
      {c.liderancas > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded-full font-medium">
          <Users size={9} /> {c.liderancas}
        </span>
      )}
      {c.fiscais > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-medium">
          <Shield size={9} /> {c.fiscais}
        </span>
      )}
      {c.eleitores > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-medium">
          <Target size={9} /> {c.eleitores}
        </span>
      )}
    </div>
  );
}
