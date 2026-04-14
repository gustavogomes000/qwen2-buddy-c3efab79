import { supabase } from '@/integrations/supabase/client';

/**
 * Dado um suplente_id externo, retorna o municipio_id local
 */
export async function resolverMunicipioId(
  suplenteId: string
): Promise<string | null> {
  if (!suplenteId) return null;

  // 1. Check suplente_municipio mapping first
  const { data } = await (supabase as any)
    .from('suplente_municipio')
    .select('municipio_id')
    .eq('suplente_id', suplenteId)
    .maybeSingle();

  if (data?.municipio_id) return data.municipio_id;

  // 2. Fallback: check hierarquia_usuarios.municipio_id for livre suplentes
  const { data: hierData } = await supabase
    .from('hierarquia_usuarios')
    .select('municipio_id')
    .eq('suplente_id', suplenteId)
    .not('municipio_id', 'is', null)
    .limit(1)
    .maybeSingle();

  return hierData?.municipio_id ?? null;
}

/**
 * Dado um municipio_id, retorna o nome do município
 */
export async function buscarNomeMunicipio(
  municipioId: string
): Promise<string | null> {
  if (!municipioId) return null;

  const { data } = await (supabase as any)
    .from('municipios')
    .select('nome')
    .eq('id', municipioId)
    .maybeSingle();

  return data?.nome ?? null;
}
