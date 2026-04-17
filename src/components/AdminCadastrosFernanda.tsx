import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Edit2, Trash2, X, Save, Loader2, Phone, Instagram, MapPin, User, Download, ClipboardList } from 'lucide-react';

interface CadastroFernanda {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  instagram: string | null;
  cadastrado_por: string | null;
  criado_em: string;
}

interface FormState {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  instagram: string;
}

export default function AdminCadastrosFernanda() {
  const [cadastros, setCadastros] = useState<CadastroFernanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cadastros_fernanda' as any)
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setCadastros((data || []) as unknown as CadastroFernanda[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const channel = supabase
      .channel('admin_cadastros_fernanda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_fernanda' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const handleSalvar = async () => {
    if (!editing) return;
    if (!editing.nome.trim() || !editing.telefone.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e Telefone', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('cadastros_fernanda' as any)
      .update({
        nome: editing.nome.trim(),
        telefone: editing.telefone.trim(),
        cidade: editing.cidade.trim() || null,
        instagram: editing.instagram.trim() || null,
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Atualizado' });
    setEditing(null);
    carregar();
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este cadastro?')) return;
    const { error } = await supabase.from('cadastros_fernanda' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Excluído' });
    carregar();
  };

  const handleExportar = () => {
    const headers = ['Nome', 'Telefone', 'Cidade', 'Instagram', 'Cadastrado em'];
    const rows = filtrados.map(c => [
      c.nome,
      c.telefone,
      c.cidade ?? '',
      c.instagram ?? '',
      new Date(c.criado_em).toLocaleString('pt-BR'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadastros-fernanda-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtrados = cadastros.filter(c => {
    const q = busca.toLowerCase().trim();
    if (!q) return true;
    return c.nome.toLowerCase().includes(q)
      || c.telefone.toLowerCase().includes(q)
      || (c.cidade || '').toLowerCase().includes(q)
      || (c.instagram || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="text-primary" size={20} />
        <h2 className="text-lg font-bold">Cadastros Fernanda</h2>
        <span className="ml-auto text-xs text-muted-foreground">{filtrados.length} registros</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={handleExportar}
          disabled={filtrados.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium active:scale-95 disabled:opacity-50"
        >
          <Download size={16} /> Exportar
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md bg-card rounded-2xl border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Editar cadastro</h3>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input
                  type="text"
                  value={editing.nome}
                  onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone *</label>
                <input
                  type="tel"
                  value={editing.telefone}
                  onChange={(e) => setEditing({ ...editing, telefone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input
                  type="text"
                  value={editing.cidade}
                  onChange={(e) => setEditing({ ...editing, cidade: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                <input
                  type="text"
                  value={editing.instagram}
                  onChange={(e) => setEditing({ ...editing, instagram: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium">
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Nenhum cadastro encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-primary shrink-0" />
                    <h4 className="font-semibold text-sm truncate">{c.nome}</h4>
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} className="shrink-0" /><span>{c.telefone}</span>
                    </div>
                    {c.cidade && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="shrink-0" /><span>{c.cidade}</span>
                      </div>
                    )}
                    {c.instagram && (
                      <div className="flex items-center gap-1.5">
                        <Instagram size={12} className="shrink-0" /><span>{c.instagram}</span>
                      </div>
                    )}
                    <div className="text-[10px] opacity-70 mt-1">
                      Criado em {new Date(c.criado_em).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => setEditing({
                      id: c.id, nome: c.nome, telefone: c.telefone,
                      cidade: c.cidade ?? '', instagram: c.instagram ?? '',
                    })}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-90 transition-transform"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleExcluir(c.id)}
                    className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-90 transition-transform"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
