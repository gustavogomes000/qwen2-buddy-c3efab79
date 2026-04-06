import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Loader2, Calendar, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEvento } from '@/contexts/EventoContext';
import { toast } from '@/hooks/use-toast';

export default function GerenciarEventos() {
  const { usuario } = useAuth();
  const { eventos, refetch } = useEvento();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch ALL events (including inactive) for admin
  const [allEventos, setAllEventos] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const fetchAll = async () => {
    setLoadingAll(true);
    const { data } = await (supabase as any)
      .from('eventos')
      .select('*')
      .order('criado_em', { ascending: false });
    setAllEventos(data || []);
    setLoadingAll(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = async () => {
    if (!nome.trim()) { toast({ title: 'Informe o nome do evento', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (editId) {
        await (supabase as any).from('eventos').update({
          nome: nome.trim(),
          local: local.trim() || null,
          descricao: descricao.trim() || null,
          atualizado_em: new Date().toISOString(),
        }).eq('id', editId);
        toast({ title: '✅ Evento atualizado!' });
      } else {
        await (supabase as any).from('eventos').insert({
          nome: nome.trim(),
          local: local.trim() || null,
          descricao: descricao.trim() || null,
          criado_por: usuario?.id || null,
        });
        toast({ title: '✅ Evento criado!' });
      }
      setNome(''); setLocal(''); setDescricao('');
      setShowForm(false); setEditId(null);
      fetchAll(); refetch();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await (supabase as any).from('eventos').update({ ativo: !ativo, atualizado_em: new Date().toISOString() }).eq('id', id);
    fetchAll(); refetch();
    toast({ title: ativo ? 'Evento desativado' : 'Evento ativado' });
  };

  const handleEdit = (e: any) => {
    setEditId(e.id);
    setNome(e.nome);
    setLocal(e.local || '');
    setDescricao(e.descricao || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir evento permanentemente?')) return;
    await (supabase as any).from('eventos').delete().eq('id', id);
    fetchAll(); refetch();
    toast({ title: 'Evento excluído' });
  };

  const inputCls = "w-full h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Calendar size={16} className="text-primary" /> Eventos
        </h3>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setNome(''); setLocal(''); setDescricao(''); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground active:scale-95 transition-all"
        >
          <Plus size={12} /> Novo
        </button>
      </div>

      {showForm && (
        <div className="section-card space-y-2">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do evento *" className={inputCls} />
          <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Local (opcional)" className={inputCls} />
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (opcional)"
            className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none" rows={2} />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-9 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editId ? 'Salvar' : 'Criar Evento'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="h-9 px-4 bg-muted text-muted-foreground rounded-lg text-xs font-semibold active:scale-[0.97] transition-all">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {loadingAll ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      ) : allEventos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento criado</p>
      ) : (
        <div className="space-y-1.5">
          {allEventos.map(e => (
            <div key={e.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
              e.ativo ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30 opacity-60'
            }`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{e.nome}</p>
                {e.local && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin size={9} /> {e.local}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleAtivo(e.id, e.ativo)}
                  className={`px-2 py-1 rounded text-[9px] font-semibold ${e.ativo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {e.ativo ? 'Ativo' : 'Inativo'}
                </button>
                <button onClick={() => handleEdit(e)} className="p-1 hover:bg-muted rounded">
                  <Edit2 size={11} className="text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(e.id)} className="p-1 hover:bg-destructive/10 rounded">
                  <Trash2 size={11} className="text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
