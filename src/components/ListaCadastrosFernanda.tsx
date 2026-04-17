// Lista somente-leitura/edição dos cadastros feitos pelo tipo "fernanda".
// Componente isolado para não interferir em TabCadastros existente.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Edit2, Trash2, X, Save, Loader2, Phone, Instagram, MapPin, User, Calendar } from 'lucide-react';

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

export default function ListaCadastrosFernanda() {
  const [cadastros, setCadastros] = useState<CadastroFernanda[]>([]);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cadastros_fernanda' as any)
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const lista = (data || []) as unknown as CadastroFernanda[];
    setCadastros(lista);

    // Buscar nomes dos autores
    const ids = Array.from(new Set(lista.map(c => c.cadastrado_por).filter(Boolean) as string[]));
    if (ids.length > 0) {
      const { data: users } = await supabase
        .from('hierarquia_usuarios')
        .select('id, nome')
        .in('id', ids);
      const map: Record<string, string> = {};
      (users || []).forEach((u: any) => { map[u.id] = u.nome; });
      setAutores(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const channel = supabase
      .channel('lista_cadastros_fernanda_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadastros_fernanda' }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  const handleSalvar = async () => {
    if (!editForm) return;
    if (!editForm.nome.trim() || !editForm.telefone.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e Telefone são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('cadastros_fernanda' as any)
      .update({
        nome: editForm.nome.trim(),
        telefone: editForm.telefone.trim(),
        cidade: editForm.cidade.trim() || null,
        instagram: editForm.instagram.trim() || null,
      })
      .eq('id', editForm.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Cadastro atualizado' });
    setEditForm(null);
    carregar();
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
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <input
          type="text"
          placeholder="Buscar por nome, telefone, cidade ou instagram..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="text-xs text-muted-foreground">
        {loading ? 'Carregando...' : `${filtrados.length} cadastro${filtrados.length !== 1 ? 's' : ''} feito${filtrados.length !== 1 ? 's' : ''} pela Fernanda`}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {busca ? 'Nenhum cadastro encontrado' : 'Nenhum cadastro da Fernanda ainda.'}
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
                    <div className="flex items-center gap-1.5 pt-1">
                      <Calendar size={12} className="shrink-0" />
                      <span>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
                      {c.cadastrado_por && autores[c.cadastrado_por] && (
                        <span className="ml-1 text-primary">• por {autores[c.cadastrado_por]}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => setEditForm({
                      id: c.id, nome: c.nome, telefone: c.telefone,
                      cidade: c.cidade ?? '', instagram: c.instagram ?? '',
                    })}
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

      {editForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setEditForm(null)}>
          <div className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Editar cadastro</h3>
              <button onClick={() => setEditForm(null)} className="p-1 rounded-lg hover:bg-muted">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input
                  type="text"
                  value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone *</label>
                <input
                  type="tel"
                  value={editForm.telefone}
                  onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <input
                  type="text"
                  value={editForm.cidade}
                  onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                <input
                  type="text"
                  value={editForm.instagram}
                  onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditForm(null)}
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
    </div>
  );
}
