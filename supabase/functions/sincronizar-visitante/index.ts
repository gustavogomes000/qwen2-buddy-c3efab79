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

    // Client LOCAL — onde ficam pessoas, liderancas, fiscais, possiveis_eleitores, hierarquia_usuarios
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Client EXTERNO — onde ficam os suplentes
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const externalClient = createClient(externalUrl, externalKey);

    // ── 0. Validate indicador & resolve context ───────────────
    let validatedSuplenteId: string | null = null;
    let validatedLiderancaId: string | null = null;
    let cadastradoPor: string | null = null;
    let municipioId: string | null = null;

    if (indicador_id && indicador_tipo === 'suplente') {
      // Buscar suplente no banco EXTERNO (onde os suplentes vivem)
      const { data: sup } = await externalClient
        .from('suplentes')
        .select('id')
        .eq('id', indicador_id)
        .maybeSingle();

      if (sup) {
        // Suplente encontrado no banco externo
        // Verificar se TAMBÉM existe no banco local (para FK)
        const { data: supLocal } = await supabaseAdmin
          .from('suplentes')
          .select('id')
          .eq('id', indicador_id)
          .maybeSingle();

        if (supLocal) {
          validatedSuplenteId = supLocal.id;
        }
        // Se não existe localmente, não usar como FK (evita erro)

        // Resolve cadastrado_por from hierarquia local
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
        // Talvez indicador_id é um hierarquia_usuarios.id
        const { data: hierSup } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, suplente_id, municipio_id')
          .eq('id', indicador_id)
          .in('tipo', ['suplente', 'coordenador'])
          .eq('ativo', true)
          .maybeSingle();

        if (!hierSup) {
          return jsonResp({ erro: 'Indicador (suplente) não encontrado' }, 400);
        }

        if (hierSup.suplente_id) {
          const { data: supCheck } = await supabaseAdmin
            .from('suplentes')
            .select('id')
            .eq('id', hierSup.suplente_id)
            .maybeSingle();
          validatedSuplenteId = supCheck ? supCheck.id : null;
        }
        cadastradoPor = hierSup.id;
        municipioId = hierSup.municipio_id;
      }

      // Resolve municipio if still missing — try both validated and original indicador_id
      if (!municipioId) {
        const smId = validatedSuplenteId || indicador_id;
        if (smId) {
          const { data: sm } = await supabaseAdmin
            .from('suplente_municipio')
            .select('municipio_id')
            .eq('suplente_id', smId)
            .maybeSingle();
          if (sm) municipioId = sm.municipio_id;
        }
      }
    } else if (indicador_id && indicador_tipo === 'lideranca') {
      const { data: usuario } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, suplente_id, municipio_id')
        .eq('id', indicador_id)
        .eq('ativo', true)
        .maybeSingle();

      if (usuario) {
        cadastradoPor = usuario.id;
        municipioId = usuario.municipio_id;
        const { data: lid } = await supabaseAdmin
          .from('liderancas')
          .select('id, suplente_id')
          .eq('cadastrado_por', usuario.id)
          .maybeSingle();
        if (lid) {
          validatedLiderancaId = lid.id;
          if (lid.suplente_id) {
            const { data: sc } = await supabaseAdmin.from('suplentes').select('id').eq('id', lid.suplente_id).maybeSingle();
            validatedSuplenteId = sc ? sc.id : null;
          }
        } else if (usuario.suplente_id) {
          const { data: sc } = await supabaseAdmin.from('suplentes').select('id').eq('id', usuario.suplente_id).maybeSingle();
          validatedSuplenteId = sc ? sc.id : null;
        }
      } else {
        const { data: lid } = await supabaseAdmin
          .from('liderancas')
          .select('id, suplente_id, cadastrado_por, municipio_id')
          .eq('id', indicador_id)
          .maybeSingle();
        if (!lid) {
          return jsonResp({ erro: 'Indicador (liderança) não encontrado' }, 400);
        }
        validatedLiderancaId = lid.id;
        if (lid.suplente_id) {
          const { data: sc } = await supabaseAdmin.from('suplentes').select('id').eq('id', lid.suplente_id).maybeSingle();
          validatedSuplenteId = sc ? sc.id : null;
        }
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
