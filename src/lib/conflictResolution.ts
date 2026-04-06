// ── Last-Write-Wins (LWW) Conflict Resolution ───────────────────────────────
// Detects update conflicts by comparing local `atualizado_em` with server version.
// If server is newer, logs the conflict and lets the user choose action.

import { supabase } from '@/integrations/supabase/client';

export interface ConflictResult {
  hasConflict: boolean;
  serverVersion?: Record<string, any>;
  localVersion?: Record<string, any>;
}

/**
 * Before updating a record, check if the server version is newer than our local copy.
 * Returns conflict info if server's atualizado_em > our known atualizado_em.
 */
export async function checkUpdateConflict(
  table: 'pessoas' | 'liderancas' | 'fiscais' | 'possiveis_eleitores',
  recordId: string,
  localUpdatedAt: string
): Promise<ConflictResult> {
  try {
    const timestampCol = table === 'possiveis_eleitores' ? 'criado_em' : 'atualizado_em';
    const { data, error } = await (supabase as any)
      .from(table)
      .select(`id, ${timestampCol}`)
      .eq('id', recordId)
      .single();

    if (error || !data) return { hasConflict: false };

    const serverTime = new Date(data[timestampCol]).getTime();
    const localTime = new Date(localUpdatedAt).getTime();

    if (serverTime > localTime) {
      console.warn(`[Conflict] LWW conflict on ${table}/${recordId}: server=${data[timestampCol]} > local=${localUpdatedAt}`);
      return { hasConflict: true, serverVersion: data };
    }

    return { hasConflict: false };
  } catch (err) {
    console.error('[Conflict] Check failed:', err);
    return { hasConflict: false }; // Fail-open: proceed with update
  }
}

/**
 * Force-update a record (LWW — keep local version).
 * Sets atualizado_em to now() to win the conflict.
 */
export async function forceUpdate(
  table: 'pessoas' | 'liderancas' | 'fiscais' | 'possiveis_eleitores',
  recordId: string,
  data: Record<string, any>
): Promise<{ error: string | null }> {
  const updateData = {
    ...data,
    atualizado_em: new Date().toISOString(),
  };

  const { error } = await (supabase as any)
    .from(table)
    .update(updateData)
    .eq('id', recordId);

  if (error) {
    console.error(`[Conflict] forceUpdate failed on ${table}/${recordId}:`, error.message);
    return { error: error.message };
  }

  console.log(`[Conflict] forceUpdate succeeded on ${table}/${recordId}`);
  return { error: null };
}

/**
 * Discard local changes and refetch from server.
 */
export async function discardLocalVersion(
  table: 'pessoas' | 'liderancas' | 'fiscais' | 'possiveis_eleitores',
  recordId: string
): Promise<{ data: Record<string, any> | null; error: string | null }> {
  const { data, error } = await (supabase as any)
    .from(table)
    .select('*')
    .eq('id', recordId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
