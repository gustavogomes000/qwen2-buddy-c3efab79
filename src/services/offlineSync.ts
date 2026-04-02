// ── Offline Sync Service ─────────────────────────────────────────────────────
// Processes pending offline registrations when back online.

import { supabase } from '@/integrations/supabase/client';
import { getAllPending, removeFromQueue, updateAttempts, type OfflineRegistration } from '@/lib/offlineQueue';

let syncing = false;
let listeners: Array<() => void> = [];

export function onSyncStatusChange(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

function notifyListeners() {
  listeners.forEach(cb => cb());
}

export async function syncOfflineData(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getAllPending();
    if (pending.length === 0) { syncing = false; return { synced: 0, failed: 0 }; }

    for (const item of pending) {
      try {
        await syncSingleRegistration(item);
        await removeFromQueue(item.id!);
        synced++;
      } catch (err) {
        console.error('[OfflineSync] Failed to sync item', item.id, err);
        await updateAttempts(item.id!, (item.attempts || 0) + 1);
        failed++;
      }
    }

    notifyListeners();
  } catch (err) {
    console.error('[OfflineSync] Sync error', err);
  } finally {
    syncing = false;
  }

  return { synced, failed };
}

async function syncSingleRegistration(item: OfflineRegistration) {
  let pessoaId: string;

  if (item.pessoaExistenteId) {
    pessoaId = item.pessoaExistenteId;
    const { error } = await supabase.from('pessoas').update({
      ...item.pessoa,
      atualizado_em: new Date().toISOString(),
    }).eq('id', pessoaId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('pessoas').insert(item.pessoa as any).select('id').single();
    if (error) throw error;
    pessoaId = data!.id;
  }

  const registro = { ...item.registro, pessoa_id: pessoaId };

  if (item.type === 'lideranca') {
    const { error } = await (supabase as any).from('liderancas').insert(registro);
    if (error) throw error;
  } else if (item.type === 'fiscal') {
    const { error } = await (supabase as any).from('fiscais').insert(registro);
    if (error) throw error;
  } else if (item.type === 'eleitor') {
    const { error } = await (supabase as any).from('possiveis_eleitores').insert(registro);
    if (error) throw error;
  }
}

// Auto-sync setup
let syncInterval: ReturnType<typeof setInterval> | null = null;
let onlineHandler: (() => void) | null = null;

export function startAutoSync() {
  // Prevent duplicate listeners
  if (syncInterval) return;

  // Sync immediately if online
  if (navigator.onLine) {
    syncOfflineData();
  }

  // Sync when coming back online (single handler)
  if (!onlineHandler) {
    onlineHandler = () => {
      console.log('[OfflineSync] Back online, syncing...');
      syncOfflineData();
    };
    window.addEventListener('online', onlineHandler);
  }

  // Periodic sync every 30 seconds
  syncInterval = setInterval(() => {
    if (navigator.onLine) syncOfflineData();
  }, 30_000);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
}
