import { supabase } from '@/integrations/supabase/client';
import { cachedInvoke } from '@/lib/cacheEdgeFunctions';
import { resolverMunicipioId, buscarNomeMunicipio } from './resolverMunicipio';

/** Ensure a suplente exists in the local suplentes table using external data or hierarchy fallback */
async function ensureLocalSuplente(suplenteId: string, usuario?: HierarquiaUsuario) {
  try {
    // Check if already exists locally
    const { data: existing } = await (supabase as any).from('suplentes').select('id').eq('id', suplenteId).maybeSingle();
    if (existing) return;

    // Try external system first
    const data = await cachedInvoke<any[]>('buscar-suplentes');
    if (Array.isArray(data)) {
      const sup = data.find((s: any) => String(s.id) === String(suplenteId));
      if (sup) {
        await (supabase as any).from('suplentes').upsert({
          id: String(sup.id),
          nome: sup.nome,
          partido: sup.partido || null,
          regiao_atuacao: sup.regiao_atuacao || null,
        }, { onConflict: 'id' });
        return;
      }
    }

    // Fallback: create from hierarchy data
    const { data: hierUser } = await supabase
      .from('hierarquia_usuarios')
      .select('nome')
      .eq('suplente_id', suplenteId)
      .limit(1)
      .maybeSingle();

    await (supabase as any).from('suplentes').upsert({
      id: suplenteId,
      nome: hierUser?.nome || 'Suplente',
    }, { onConflict: 'id' });
  } catch {}
}

/** Ensure an external suplente exists in the local suplentes table */
async function sincronizarSuplenteLocal(suplenteId: string) {
  await ensureLocalSuplente(suplenteId);
}

interface HierarquiaUsuario {
  id: string;
  tipo: string;
  suplente_id: string | null;
  superior_id: string | null;
}

interface LigacaoPoliticaResult {
  bloqueado: boolean;
  nomeFixo: string | null;
  subtitulo: string | null;
  suplenteId: string | null;
  liderancaId: string | null;
  municipioId: string | null;
}

/**
 * Resolve a ligação política do usuário logado para pré-preencher formulários.
 */
export async function resolverLigacaoPolitica(
  usuario: HierarquiaUsuario
): Promise<LigacaoPoliticaResult> {
  const resultado: LigacaoPoliticaResult = {
    bloqueado: false,
    nomeFixo: null,
    subtitulo: null,
    suplenteId: null,
    liderancaId: null,
    municipioId: null,
  };

  // 1. Suplente com suplente_id → bloqueado, exibe nome do suplente
  if (usuario.tipo === 'suplente' && usuario.suplente_id) {
    resultado.bloqueado = true;
    resultado.suplenteId = usuario.suplente_id;

    // Buscar nome do suplente via Edge Function e sincronizar localmente
    try {
      const data = await cachedInvoke<any[]>('buscar-suplentes');
      if (Array.isArray(data)) {
        const sup = data.find((s: any) => String(s.id) === String(usuario.suplente_id));
        if (sup) {
          resultado.nomeFixo = sup.nome;
          resultado.subtitulo = [sup.partido, sup.regiao_atuacao].filter(Boolean).join(' · ');
          // Upsert into local suplentes table
          try {
            await (supabase as any).from('suplentes').upsert({
              id: String(sup.id),
              nome: sup.nome,
              partido: sup.partido || null,
              regiao_atuacao: sup.regiao_atuacao || null,
            }, { onConflict: 'id' });
          } catch {}
        } else {
          // Suplente not found in external system — ensure it exists locally
          // using data from hierarquia_usuarios
          await ensureLocalSuplente(usuario.suplente_id, usuario);
        }
      }
    } catch {}

    // Resolver município
    resultado.municipioId = await resolverMunicipioId(usuario.suplente_id);
    return resultado;
  }

  // 2. Liderança → buscar liderança vinculada ao usuário, herdar suplente_id
  if (usuario.tipo === 'lideranca' && usuario.suplente_id) {
    resultado.bloqueado = true;
    resultado.suplenteId = usuario.suplente_id;

    // Ensure suplente exists locally
    await sincronizarSuplenteLocal(usuario.suplente_id);

    // Buscar liderança do usuário pelo suplente_id na hierarquia
    try {
      const { data: liderancas } = await supabase
        .from('liderancas')
        .select('id, pessoas(nome)')
        .eq('suplente_id', usuario.suplente_id)
        .limit(1);
      if (liderancas && liderancas.length > 0) {
        const l = liderancas[0] as any;
        resultado.liderancaId = l.id;
        resultado.nomeFixo = l.pessoas?.nome || 'Liderança vinculada';
        resultado.subtitulo = 'Vinculado ao seu perfil de liderança';
      }
    } catch {}

    resultado.municipioId = await resolverMunicipioId(usuario.suplente_id);
    return resultado;
  }

  // 4. Caso contrário (avulso, admin, coordenador) → campo editável
  return resultado;
}
