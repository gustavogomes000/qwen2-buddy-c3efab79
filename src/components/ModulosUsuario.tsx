import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { toggleModuleSelection } from '@/lib/moduleSelection';

const MODULOS = [
  { id: 'master', label: '🔑 Acesso Master', desc: 'Acesso total — vê e faz tudo no sistema' },
  { id: 'cadastrar_liderancas', label: '👥 Lideranças', desc: 'Pode cadastrar lideranças, fiscais e eleitores' },
  { id: 'cadastrar_eleitores', label: '🎯 Eleitores', desc: 'Pode cadastrar somente eleitores' },
];

interface Props {
  usuarioId: string;
  onClose?: () => void;
}

export default function ModulosUsuario({ usuarioId, onClose }: Props) {
  const [modulosAtivos, setModulosAtivos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchModulos();
  }, [usuarioId]);

  const fetchModulos = async () => {
    const { data } = await (supabase as any)
      .from('usuario_modulos')
      .select('modulo')
      .eq('usuario_id', usuarioId);
    if (data) {
      setModulosAtivos(new Set(data.map((d: any) => d.modulo)));
    }
    setLoading(false);
  };

  const toggleModulo = async (modulo: string) => {
    setSaving(true);
    const nextModulos = toggleModuleSelection(modulosAtivos, modulo);
    const modulosParaRemover = Array.from(modulosAtivos).filter(item => !nextModulos.has(item));
    const modulosParaAdicionar = Array.from(nextModulos).filter(item => !modulosAtivos.has(item));

    try {
      if (modulosParaRemover.length > 0) {
        await (supabase as any)
          .from('usuario_modulos')
          .delete()
          .eq('usuario_id', usuarioId)
          .in('modulo', modulosParaRemover);
      }

      if (modulosParaAdicionar.length > 0) {
        await (supabase as any)
          .from('usuario_modulos')
          .insert(modulosParaAdicionar.map(item => ({ usuario_id: usuarioId, modulo: item })));
      }

      setModulosAtivos(nextModulos);
    } catch (err: any) {
      toast({ title: 'Erro ao alterar módulo', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Módulos / Permissões</p>
      {MODULOS.map(mod => {
        const active = modulosAtivos.has(mod.id);
        return (
          <button
            key={mod.id}
            onClick={() => toggleModulo(mod.id)}
            disabled={saving}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
              active
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-card'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
              active ? 'border-primary bg-primary' : 'border-muted-foreground/30'
            }`}>
              {active && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-foreground">{mod.label}</p>
              <p className="text-[10px] text-muted-foreground">{mod.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
