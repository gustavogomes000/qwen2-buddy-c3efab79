import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Edit2, Trash2, X, Save, Loader2, Phone, Instagram, MapPin, User } from 'lucide-react';

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
  id?: string;
  nome: string;
  telefone: string;
  cidade: string;
  instagram: string;
}

const EMPTY: FormState = { nome: '', telefone: '', cidade: '', instagram: '' };

export default function TabCadastrosFernanda() {
  const { usuario, isAdmin } = useAuth();
  const [cadastros, setCadastros] = useState<CadastroFernanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cadastros_fernanda' as any)
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setCadastros((data || []) as unknown as CadastroFernanda[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('cadastros_fernanda_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_fernanda' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const handleSalvar = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e Telefone são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      cidade: form.cidade.trim() || null,
      instagram: form.instagram.trim() || null,
      cadastrado_por: usuario?.id ?? null,
    };
    const { error } = form.id
      ? await supabase.from('cadastros_fernanda' as any).update(payload).eq('id', form.id)
      : await supabase.from('cadastros_fernanda' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: form.id ? 'Cadastro atualizado' : 'Cadastro salvo' });
    setForm(EMPTY);
    setShowForm(false);
    carregar();
  };

  const handleEditar = (c: CadastroFernanda) => {
    setForm({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      cidade: c.cidade ?? '',
      instagram: c.instagram ?? '',
    });
    setShowForm(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este cadastro?')) return;
    const { error } = await supabase.from('cadastros_fernanda' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Cadastro excluído' });
    carregar();
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
    <div className="space-y-4 pb-24">
      {/* Header com busca e botão novo */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, cidade ou instagram..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => { setForm(EMPTY); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-transform"
        >
          <Plus size={16} /> Novo Cadastro
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{form.id ? 'Editar cadastro' : 'Novo cadastro'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone *</label>
                <input
                  type="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Cidade"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="@usuario"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium"
              >
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

      {/* Lista */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">
          {loading ? 'Carregando...' : `${filtrados.length} cadastro${filtrados.length !== 1 ? 's' : ''}`}
          {isAdmin && <span className="ml-2 text-primary">(visualização admin)</span>}
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {busca ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro ainda. Clique em "Novo Cadastro" para começar.'}
          </div>
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
                        <Phone size={12} className="shrink-0" />
                        <span>{c.telefone}</span>
                      </div>
                      {c.cidade && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="shrink-0" />
                          <span>{c.cidade}</span>
                        </div>
                      )}
                      {c.instagram && (
                        <div className="flex items-center gap-1.5">
                          <Instagram size={12} className="shrink-0" />
                          <span>{c.instagram}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => handleEditar(c)}
                      className="p-2 rounded-lg bg-muted hover:bg-muted/80 active:scale-90 transition-transform"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleExcluir(c.id)}
                      className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 active:scale-90 transition-transform"
                      title="Excluir"
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
    </div>
  );
}
