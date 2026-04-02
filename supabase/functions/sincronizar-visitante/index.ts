import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getLocalSuplenteId(supabaseAdmin: any, suplenteId: string | null) {
  if (!suplenteId) return null;
  const { data } = await supabaseAdmin
    .from('suplentes')
    .select('id')
    .eq('id', suplenteId)
    .maybeSingle();
  return data?.id ?? null;
}

async function getMunicipioFromSuplente(supabaseAdmin: any, suplenteId: string | null) {
  if (!suplenteId) return null;
  const { data } = await supabaseAdmin
    .from('suplente_municipio')
    .select('municipio_id')
    .eq('suplente_id', suplenteId)
    .maybeSingle();
  return data?.municipio_id ?? null;
}

/**
 * Fallback: busca primeiro admin ativo para garantir que cadastrado_por nunca fique null.
 */
async function resolverAdminFallback(supabaseAdmin: any): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('hierarquia_usuarios')
    .select('id')
    .in('tipo', ['super_admin', 'coordenador'])
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const TIPOS_SOMBRA = new Set(['coordenador', 'lideranca', 'fiscal']);

function normalizeName(value?: string | null) {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

async function resolverHierarquiaPorNome(supabaseAdmin: any, nome: string | null | undefined, tipo?: string | null) {
  const nomeNormalizado = normalizeName(nome);
  if (!nomeNormalizado) return null;

  let query = supabaseAdmin
    .from('hierarquia_usuarios')
    .select('id, nome, tipo, suplente_id, municipio_id')
    .eq('ativo', true)
    .limit(1);

  if (tipo) query = query.eq('tipo', tipo);

  const { data: exato } = await query.ilike('nome', nomeNormalizado).maybeSingle();
  if (exato) return exato;

  const { data: aproximado } = await supabaseAdmin
    .from('hierarquia_usuarios')
    .select('id, nome, tipo, suplente_id, municipio_id')
    .eq('ativo', true)
    .ilike('nome', `%${nomeNormalizado}%`)
    .limit(1)
    .maybeSingle();

  return aproximado ?? null;
}

async function garantirUsuarioSombra(supabaseAdmin: any, nome: string | null | undefined, tipo: string | null | undefined, municipioId: string | null) {
  const nomeNormalizado = normalizeName(nome);
  if (!nomeNormalizado || !tipo || !TIPOS_SOMBRA.has(tipo)) return null;

  const existente = await resolverHierarquiaPorNome(supabaseAdmin, nomeNormalizado, tipo);
  if (existente) return existente;

  const { data, error } = await supabaseAdmin
    .from('hierarquia_usuarios')
    .insert({ nome: nomeNormalizado, tipo, ativo: true, municipio_id: municipioId ?? null })
    .select('id, nome, tipo, suplente_id, municipio_id')
    .single();

  if (error) {
    console.error('[sincronizar-visitante] Erro ao criar usuário sombra:', error);
    return null;
  }

  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipo, nome, cpf, whatsapp, indicador_tipo, indicador_id, indicador_nome } = body;

    if (!tipo || !nome) {
      return jsonResp({ erro: 'tipo e nome são obrigatórios' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const externalClient = createClient(externalUrl, externalKey);

    // ── 0. Validate indicador & resolve context ───────────────
    let validatedSuplenteId: string | null = null;
    let validatedLiderancaId: string | null = null;
    let cadastradoPor: string | null = null;
    let municipioId: string | null = null;

    const indicadorTipoNormalizado = typeof indicador_tipo === 'string' ? indicador_tipo : null;
    const tiposHierarquia = new Set(['super_admin', 'coordenador', 'lideranca', 'fiscal']);

    console.log(`[sincronizar-visitante] Indicador: tipo=${indicadorTipoNormalizado}, id=${indicador_id}, nome=${indicador_nome}`);

    if (indicador_id && indicadorTipoNormalizado === 'suplente') {
      const { data: sup } = await externalClient
        .from('suplentes')
        .select('id, nome')
        .eq('id', indicador_id)
        .maybeSingle();

      if (sup) {
        await supabaseAdmin.from('suplentes').upsert(
          { id: sup.id, nome: sup.nome },
          { onConflict: 'id' }
        );
        validatedSuplenteId = sup.id;

        const { data: usuario } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, municipio_id')
          .eq('suplente_id', indicador_id)
          .eq('ativo', true)
          .maybeSingle();

        if (usuario) {
          cadastradoPor = usuario.id;
          municipioId = usuario.municipio_id;
        }
      } else {
        const { data: hierSup } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, suplente_id, municipio_id')
          .eq('id', indicador_id)
          .in('tipo', ['suplente', 'coordenador'])
          .eq('ativo', true)
          .maybeSingle();

        if (hierSup) {
          if (hierSup.suplente_id) {
            validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, hierSup.suplente_id);
          }
          cadastradoPor = hierSup.id;
          municipioId = hierSup.municipio_id;
        }
      }

      if (!municipioId) {
        municipioId = await getMunicipioFromSuplente(supabaseAdmin, validatedSuplenteId || indicador_id);
      }
    } else if (indicador_id && indicadorTipoNormalizado && tiposHierarquia.has(indicadorTipoNormalizado)) {
      const { data: usuario } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, suplente_id, municipio_id')
        .eq('id', indicador_id)
        .eq('ativo', true)
        .maybeSingle();

      if (usuario) {
        cadastradoPor = usuario.id;
        municipioId = usuario.municipio_id;

        if (usuario.suplente_id) {
          validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, usuario.suplente_id);
        }

        if (indicadorTipoNormalizado === 'lideranca') {
          const { data: lid } = await supabaseAdmin
            .from('liderancas')
            .select('id, suplente_id')
            .eq('cadastrado_por', usuario.id)
            .maybeSingle();

          if (lid) {
            validatedLiderancaId = lid.id;
            if (lid.suplente_id) {
              validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, lid.suplente_id);
            }
          }
        }
      } else {
        // ID não encontrado na hierarquia — resolver por nome
        console.log(`[sincronizar-visitante] ID ${indicador_id} não encontrado em hierarquia para tipo=${indicadorTipoNormalizado}, tentando por nome: ${indicador_nome}`);
        
        const usuarioPorNome = await resolverHierarquiaPorNome(supabaseAdmin, indicador_nome, indicadorTipoNormalizado);
        if (usuarioPorNome) {
          cadastradoPor = usuarioPorNome.id;
          municipioId = usuarioPorNome.municipio_id;
          if (usuarioPorNome.suplente_id) {
            validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, usuarioPorNome.suplente_id);
          }
          console.log(`[sincronizar-visitante] ✅ Resolvido por nome: ${usuarioPorNome.nome} -> ${cadastradoPor}`);
        } else {
          // Criar usuário sombra
          const sombra = await garantirUsuarioSombra(supabaseAdmin, indicador_nome, indicadorTipoNormalizado, null);
          if (sombra) {
            cadastradoPor = sombra.id;
            municipioId = sombra.municipio_id;
            console.log(`[sincronizar-visitante] ✅ Usuário sombra criado: ${sombra.nome} -> ${cadastradoPor}`);
          }
        }

        // Se é lideranca, tentar vincular
        if (indicadorTipoNormalizado === 'lideranca' && cadastradoPor) {
          const { data: lid } = await supabaseAdmin
            .from('liderancas')
            .select('id, suplente_id, municipio_id')
            .eq('cadastrado_por', cadastradoPor)
            .maybeSingle();
          if (lid) {
            validatedLiderancaId = lid.id;
            if (lid.suplente_id) {
              validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, lid.suplente_id);
            }
            municipioId = municipioId || lid.municipio_id;
          }
        }
      }

      if (!municipioId) {
        municipioId = await getMunicipioFromSuplente(supabaseAdmin, validatedSuplenteId);
      }
    } else if (indicador_id && indicadorTipoNormalizado === 'lideranca_cadastrada') {
      const { data: lideranca } = await supabaseAdmin
        .from('liderancas')
        .select('id, suplente_id, cadastrado_por, municipio_id')
        .eq('id', indicador_id)
        .maybeSingle();

      if (lideranca) {
        validatedLiderancaId = lideranca.id;
        validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, lideranca.suplente_id);
        cadastradoPor = lideranca.cadastrado_por;
        municipioId = lideranca.municipio_id || await getMunicipioFromSuplente(supabaseAdmin, validatedSuplenteId);
      }
    } else if (indicador_id && indicadorTipoNormalizado === 'fiscal_cadastrado') {
      const { data: fiscal } = await supabaseAdmin
        .from('fiscais')
        .select('id, suplente_id, lideranca_id, cadastrado_por, municipio_id')
        .eq('id', indicador_id)
        .maybeSingle();

      if (fiscal) {
        validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, fiscal.suplente_id);
        validatedLiderancaId = fiscal.lideranca_id ?? null;
        cadastradoPor = fiscal.cadastrado_por;
        municipioId = fiscal.municipio_id || await getMunicipioFromSuplente(supabaseAdmin, validatedSuplenteId);
      }
    } else if (indicador_id && indicadorTipoNormalizado === 'eleitor_cadastrado') {
      const { data: eleitor } = await supabaseAdmin
        .from('possiveis_eleitores')
        .select('id, suplente_id, lideranca_id, cadastrado_por, municipio_id')
        .eq('id', indicador_id)
        .maybeSingle();

      if (eleitor) {
        validatedSuplenteId = await getLocalSuplenteId(supabaseAdmin, eleitor.suplente_id);
        validatedLiderancaId = eleitor.lideranca_id ?? null;
        cadastradoPor = eleitor.cadastrado_por;
        municipioId = eleitor.municipio_id || await getMunicipioFromSuplente(supabaseAdmin, validatedSuplenteId);
      }
    }

    // ── FALLBACK CRÍTICO: cadastrado_por NUNCA pode ser null ──
    if (!cadastradoPor) {
      console.warn(`[sincronizar-visitante] cadastrado_por é null! Buscando fallback admin...`);
      cadastradoPor = await resolverAdminFallback(supabaseAdmin);
      console.log(`[sincronizar-visitante] Fallback admin: cadastrado_por=${cadastradoPor}`);
    }

    console.log(`[sincronizar-visitante] FINAL: cadastrado_por=${cadastradoPor}, suplente=${validatedSuplenteId}, municipio=${municipioId}, tipo=${tipo}`);

    // ── 1. Find or create pessoa ──────────────────────────────
    let pessoaId: string;
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null;

    if (cpfLimpo && cpfLimpo.length === 11 && !cpfLimpo.startsWith('TEMP')) {
      const { data: existente } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (existente) {
        pessoaId = existente.id;
        const updates: Record<string, string> = {};
        if (whatsapp) updates.whatsapp = whatsapp;
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from('pessoas').update(updates).eq('id', pessoaId);
        }
      } else {
        const { data: nova, error } = await supabaseAdmin
          .from('pessoas')
          .insert({ nome: nome.trim(), cpf: cpfLimpo, whatsapp: whatsapp || null })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
        pessoaId = nova.id;
      }
    } else {
      const { data: porNome } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .ilike('nome', nome.trim())
        .maybeSingle();

      if (porNome) {
        pessoaId = porNome.id;
      } else {
        const { data: nova, error } = await supabaseAdmin
          .from('pessoas')
          .insert({ nome: nome.trim(), whatsapp: whatsapp || null })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
        pessoaId = nova.id;
      }
    }

    // ── 2. Insert into the correct table ──────────────────────
    if (tipo === 'lideranca') {
      const { data: existente } = await supabaseAdmin
        .from('liderancas')
        .select('id')
        .eq('pessoa_id', pessoaId)
        .maybeSingle();
      if (existente) {
        return jsonResp({ acao: 'ja_existe', tipo: 'lideranca', id: existente.id });
      }
      const { data: novo, error } = await supabaseAdmin
        .from('liderancas')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPor,
          suplente_id: validatedSuplenteId,
          lider_principal_id: validatedLiderancaId,
          municipio_id: municipioId,
          status: 'Ativa',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar liderança: ${error.message}`);
      console.log(`[sincronizar-visitante] ✅ Liderança criada: id=${novo.id}, cadastrado_por=${cadastradoPor}`);
      return jsonResp({ acao: 'criado', tipo: 'lideranca', id: novo.id, pessoa_id: pessoaId });
    }

    if (tipo === 'fiscal') {
      const { data: existente } = await supabaseAdmin
        .from('fiscais')
        .select('id')
        .eq('pessoa_id', pessoaId)
        .maybeSingle();
      if (existente) {
        return jsonResp({ acao: 'ja_existe', tipo: 'fiscal', id: existente.id });
      }
      const { data: novo, error } = await supabaseAdmin
        .from('fiscais')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPor,
          suplente_id: validatedSuplenteId,
          lideranca_id: validatedLiderancaId,
          municipio_id: municipioId,
          status: 'Ativo',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar fiscal: ${error.message}`);
      console.log(`[sincronizar-visitante] ✅ Fiscal criado: id=${novo.id}, cadastrado_por=${cadastradoPor}`);
      return jsonResp({ acao: 'criado', tipo: 'fiscal', id: novo.id, pessoa_id: pessoaId });
    }

    if (tipo === 'eleitor') {
      const { data: existente } = await supabaseAdmin
        .from('possiveis_eleitores')
        .select('id')
        .eq('pessoa_id', pessoaId)
        .maybeSingle();
      if (existente) {
        return jsonResp({ acao: 'ja_existe', tipo: 'eleitor', id: existente.id });
      }
      const { data: novo, error } = await supabaseAdmin
        .from('possiveis_eleitores')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPor,
          suplente_id: validatedSuplenteId,
          lideranca_id: validatedLiderancaId,
          municipio_id: municipioId,
          compromisso_voto: 'Indefinido',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar eleitor: ${error.message}`);
      console.log(`[sincronizar-visitante] ✅ Eleitor criado: id=${novo.id}, cadastrado_por=${cadastradoPor}`);
      return jsonResp({ acao: 'criado', tipo: 'eleitor', id: novo.id, pessoa_id: pessoaId });
    }

    return jsonResp({ erro: 'Tipo inválido. Use: lideranca, fiscal ou eleitor' }, 400);
  } catch (error) {
    console.error('Erro sincronizar-visitante:', error);
    return jsonResp(
      { erro: error instanceof Error ? error.message : 'Erro interno' },
      500
    );
  }
});