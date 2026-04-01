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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipo, nome, cpf, whatsapp, indicador_tipo, indicador_id } = body;

    if (!tipo || !nome) {
      return jsonResp({ erro: 'tipo e nome são obrigatórios' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── 0. Validate indicador & resolve context ───────────────
    let validatedSuplenteId: string | null = null;
    let validatedLiderancaId: string | null = null;
    let cadastradoPor: string | null = null;
    let municipioId: string | null = null;

    if (indicador_id && indicador_tipo === 'suplente') {
      // The ID may come from table `suplentes` OR from `hierarquia_usuarios` (tipo=suplente)
      // Try suplentes table first
      const { data: sup } = await supabaseAdmin
        .from('suplentes')
        .select('id')
        .eq('id', indicador_id)
        .maybeSingle();

      if (sup) {
        validatedSuplenteId = sup.id;
      } else {
        // Try hierarquia_usuarios (buscar-indicadores returns hierarquia IDs for suplentes too)
        const { data: hierSup } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, suplente_id, municipio_id')
          .eq('id', indicador_id)
          .eq('tipo', 'suplente')
          .eq('ativo', true)
          .maybeSingle();

        if (!hierSup) {
          return jsonResp({ erro: 'Indicador (suplente) não encontrado' }, 400);
        }
        // This hierarquia user IS the suplente — use their suplente_id FK if it exists
        validatedSuplenteId = hierSup.suplente_id || null;
        cadastradoPor = hierSup.id;
        municipioId = hierSup.municipio_id;
      }

      // Resolve cadastrado_por + municipio from hierarquia if not set yet
      if (!cadastradoPor) {
        const { data: usuario } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, municipio_id')
          .eq('suplente_id', indicador_id)
          .eq('ativo', true)
          .maybeSingle();
        if (usuario) {
          cadastradoPor = usuario.id;
          municipioId = municipioId || usuario.municipio_id;
        }
      }
      if (!municipioId && validatedSuplenteId) {
        const { data: sm } = await supabaseAdmin
          .from('suplente_municipio')
          .select('municipio_id')
          .eq('suplente_id', validatedSuplenteId)
          .maybeSingle();
        if (sm) municipioId = sm.municipio_id;
      }
    } else if (indicador_id && indicador_tipo === 'lideranca') {
      // ID may be from hierarquia_usuarios or liderancas
      const { data: usuario } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, suplente_id, municipio_id')
        .eq('id', indicador_id)
        .eq('ativo', true)
        .maybeSingle();

      if (usuario) {
        cadastradoPor = usuario.id;
        municipioId = usuario.municipio_id;
        // Find the lideranca record for this user
        const { data: lid } = await supabaseAdmin
          .from('liderancas')
          .select('id, suplente_id')
          .eq('cadastrado_por', usuario.id)
          .maybeSingle();
        if (lid) {
          validatedLiderancaId = lid.id;
          validatedSuplenteId = lid.suplente_id;
        } else {
          validatedSuplenteId = usuario.suplente_id;
        }
      } else {
        // Try liderancas table directly
        const { data: lid } = await supabaseAdmin
          .from('liderancas')
          .select('id, suplente_id, cadastrado_por, municipio_id')
          .eq('id', indicador_id)
          .maybeSingle();
        if (!lid) {
          return jsonResp({ erro: 'Indicador (liderança) não encontrado' }, 400);
        }
        validatedLiderancaId = lid.id;
        validatedSuplenteId = lid.suplente_id;
        cadastradoPor = lid.cadastrado_por;
        municipioId = lid.municipio_id;
      }
    }

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
          municipio_id: municipioId,
          status: 'Ativa',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar liderança: ${error.message}`);
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
