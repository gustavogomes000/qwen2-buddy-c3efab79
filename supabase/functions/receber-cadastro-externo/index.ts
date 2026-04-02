import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-token',
};

const bodySchema = z.object({
  tipo: z.enum(['lideranca', 'fiscal', 'eleitor']),
  indicador_id: z.string().uuid(),
  indicador_tipo: z.enum([
    'suplente', 'lideranca', 'coordenador', 'super_admin', 'fiscal',
    'eleitor_cadastrado', 'lideranca_cadastrada', 'fiscal_cadastrado', 'recepcao'
  ]),
  indicador_nome: z.string().optional().nullable(),
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  zona_eleitoral: z.string().optional().nullable(),
  secao_eleitoral: z.string().optional().nullable(),
  colegio_eleitoral: z.string().optional().nullable(),
  municipio_eleitoral: z.string().optional().nullable(),
  titulo_eleitor: z.string().optional().nullable(),
  regiao_atuacao: z.string().optional().nullable(),
  zona_fiscal: z.string().optional().nullable(),
  secao_fiscal: z.string().optional().nullable(),
  compromisso_voto: z.string().optional().nullable(),
  lideranca_id: z.string().uuid().optional().nullable(),
  cadastrado_por_id: z.string().optional().nullable(),
  cadastrado_por_fonte: z.enum(['externo', 'local']).optional().nullable(),
});

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const TOKEN_SECRETO = Deno.env.get('CADASTRO_EXTERNO_TOKEN');
    const tokenRecebido = req.headers.get('x-api-token');
    if (!tokenRecebido || tokenRecebido !== TOKEN_SECRETO) {
      return jsonResp({ erro: 'Token inválido ou ausente' }, 401);
    }

    const rawBody = await req.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResp({ erro: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const indId = body.indicador_id ?? body.cadastrado_por_id;
    const indTipo = body.indicador_tipo ?? (body.cadastrado_por_fonte === 'externo' ? 'suplente' : 'coordenador');

    if (!indId) {
      return jsonResp({ erro: 'indicador_id é obrigatório' }, 400);
    }

    console.log(`[receber-cadastro-externo] Indicador: tipo=${indTipo}, id=${indId}, nome=${body.indicador_nome}`);

    let cadastradoPorId: string | null = null;
    let suplenteId: string | null = null;
    let municipioId: string | null = null;
    let liderancaIdVinculada: string | null = null;

    // ── PASSO 1: Sempre tentar hierarquia_usuarios primeiro (funciona para TODOS os tipos) ──
    const { data: hierarquiaDirecta } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, suplente_id, municipio_id')
      .eq('id', indId)
      .eq('ativo', true)
      .maybeSingle();

    if (hierarquiaDirecta) {
      cadastradoPorId = hierarquiaDirecta.id;
      suplenteId = hierarquiaDirecta.suplente_id;
      municipioId = hierarquiaDirecta.municipio_id;
      console.log(`[receber-cadastro-externo] ✅ Resolvido via hierarquia direta: cadastrado_por=${cadastradoPorId}, suplente=${suplenteId}, municipio=${municipioId}`);
    } else {
      // ── PASSO 2: Fallback por tipo específico ──
      console.log(`[receber-cadastro-externo] Não encontrado em hierarquia_usuarios, tentando resolução por tipo=${indTipo}`);

      if (indTipo === 'suplente') {
        // Espelhar suplente localmente
        if (body.indicador_nome) {
          await supabaseAdmin.from('suplentes').upsert(
            { id: indId, nome: body.indicador_nome },
            { onConflict: 'id' }
          );
        }
        // Encontrar usuário vinculado ao suplente
        const { data: usuarioVinculado } = await supabaseAdmin
          .from('hierarquia_usuarios')
          .select('id, suplente_id, municipio_id')
          .eq('suplente_id', indId)
          .eq('ativo', true)
          .order('tipo')
          .limit(1)
          .maybeSingle();

        if (usuarioVinculado) {
          cadastradoPorId = usuarioVinculado.id;
          suplenteId = usuarioVinculado.suplente_id;
          municipioId = usuarioVinculado.municipio_id;
        } else {
          suplenteId = indId;
          const { data: sm } = await supabaseAdmin
            .from('suplente_municipio')
            .select('municipio_id')
            .eq('suplente_id', indId)
            .maybeSingle();
          municipioId = sm?.municipio_id ?? null;
        }
        console.log(`[receber-cadastro-externo] Suplente resolvido: cadastrado_por=${cadastradoPorId}, suplente=${suplenteId}`);

      } else if (indTipo === 'lideranca_cadastrada') {
        const { data: lid } = await supabaseAdmin
          .from('liderancas')
          .select('id, cadastrado_por, suplente_id, municipio_id, pessoa_id')
          .eq('id', indId)
          .maybeSingle();

        if (lid) {
          liderancaIdVinculada = lid.id;
          // Tentar encontrar um usuário hierarquia vinculado a essa liderança (via pessoa_id → buscar auth)
          // Fallback: usar o cadastrado_por da liderança
          cadastradoPorId = lid.cadastrado_por;
          suplenteId = lid.suplente_id;
          municipioId = lid.municipio_id;
        }
        console.log(`[receber-cadastro-externo] Liderança cadastrada: cadastrado_por=${cadastradoPorId}, suplente=${suplenteId}`);

      } else if (indTipo === 'fiscal_cadastrado') {
        const { data: fisc } = await supabaseAdmin
          .from('fiscais')
          .select('id, cadastrado_por, suplente_id, municipio_id, lideranca_id')
          .eq('id', indId)
          .maybeSingle();

        if (fisc) {
          cadastradoPorId = fisc.cadastrado_por;
          suplenteId = fisc.suplente_id;
          municipioId = fisc.municipio_id;
          liderancaIdVinculada = fisc.lideranca_id;
        }
        console.log(`[receber-cadastro-externo] Fiscal cadastrado: cadastrado_por=${cadastradoPorId}, suplente=${suplenteId}`);

      } else if (indTipo === 'eleitor_cadastrado') {
        const { data: el } = await supabaseAdmin
          .from('possiveis_eleitores')
          .select('id, cadastrado_por, suplente_id, municipio_id, lideranca_id')
          .eq('id', indId)
          .maybeSingle();

        if (el) {
          cadastradoPorId = el.cadastrado_por;
          suplenteId = el.suplente_id;
          municipioId = el.municipio_id;
          liderancaIdVinculada = el.lideranca_id;
        }
        console.log(`[receber-cadastro-externo] Eleitor cadastrado: cadastrado_por=${cadastradoPorId}, suplente=${suplenteId}`);

      } else {
        // recepcao ou qualquer outro tipo não mapeado → fallback admin
        console.log(`[receber-cadastro-externo] Tipo ${indTipo} sem resolução específica, usando fallback`);
      }
    }

    // ── FALLBACK: garantir que cadastrado_por NUNCA fique null ──
    if (!cadastradoPorId) {
      console.warn(`[receber-cadastro-externo] cadastrado_por é null! Buscando fallback admin...`);
      cadastradoPorId = await resolverAdminFallback(supabaseAdmin);
      console.log(`[receber-cadastro-externo] Fallback admin: cadastrado_por=${cadastradoPorId}`);
    }

    // ── Resolver municipio via suplente se ainda não tem ──
    if (!municipioId && suplenteId) {
      const { data: sm } = await supabaseAdmin
        .from('suplente_municipio')
        .select('municipio_id')
        .eq('suplente_id', suplenteId)
        .maybeSingle();
      municipioId = sm?.municipio_id ?? null;
    }

    console.log(`[receber-cadastro-externo] FINAL: cadastrado_por=${cadastradoPorId}, suplente=${suplenteId}, municipio=${municipioId}, tipo_cadastro=${body.tipo}`);

    // ── Upsert pessoa ──
    let pessoaId: string;

    if (body.cpf) {
      const cpfLimpo = body.cpf.replace(/\D/g, '');
      const { data: pessoaExistente } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .eq('cpf', cpfLimpo)
        .maybeSingle();

      if (pessoaExistente) {
        pessoaId = pessoaExistente.id;
        const updates: Record<string, string | null> = {};
        if (body.telefone) updates.telefone = body.telefone;
        if (body.whatsapp) updates.whatsapp = body.whatsapp;
        if (body.email) updates.email = body.email;
        if (body.zona_eleitoral) updates.zona_eleitoral = body.zona_eleitoral;
        if (body.secao_eleitoral) updates.secao_eleitoral = body.secao_eleitoral;
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from('pessoas').update(updates).eq('id', pessoaId);
        }
      } else {
        const { data: nova, error } = await supabaseAdmin
          .from('pessoas')
          .insert({
            nome: body.nome,
            cpf: cpfLimpo,
            telefone: body.telefone,
            whatsapp: body.whatsapp,
            email: body.email,
            zona_eleitoral: body.zona_eleitoral,
            secao_eleitoral: body.secao_eleitoral,
            colegio_eleitoral: body.colegio_eleitoral,
            municipio_eleitoral: body.municipio_eleitoral,
            titulo_eleitor: body.titulo_eleitor,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
        pessoaId = nova!.id;
      }
    } else {
      const { data: porNome } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .ilike('nome', body.nome.trim())
        .maybeSingle();

      if (porNome) {
        pessoaId = porNome.id;
      } else {
        const { data: nova, error } = await supabaseAdmin
          .from('pessoas')
          .insert({
            nome: body.nome,
            telefone: body.telefone,
            whatsapp: body.whatsapp,
            email: body.email,
          })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
        pessoaId = nova!.id;
      }
    }

    // ── Inserir no tipo correto ──
    if (body.tipo === 'lideranca') {
      const { data: existente } = await supabaseAdmin
        .from('liderancas').select('id').eq('pessoa_id', pessoaId).maybeSingle();
      if (existente) {
        return jsonResp({ aviso: 'Pessoa já cadastrada como liderança', id: existente.id }, 200);
      }
      const { data: novo, error } = await supabaseAdmin
        .from('liderancas')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPorId,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          status: 'Ativa',
          regiao_atuacao: body.regiao_atuacao,
          origem_captacao: 'visita_comite',
        })
        .select('id').single();
      if (error) throw new Error(`Erro ao criar liderança: ${error.message}`);
      console.log(`[receber-cadastro-externo] ✅ Liderança criada: id=${novo!.id}, cadastrado_por=${cadastradoPorId}`);
      return jsonResp({ sucesso: true, tipo: 'lideranca', id: novo!.id, pessoa_id: pessoaId }, 201);
    }

    if (body.tipo === 'fiscal') {
      const { data: existente } = await supabaseAdmin
        .from('fiscais').select('id').eq('pessoa_id', pessoaId).maybeSingle();
      if (existente) {
        return jsonResp({ aviso: 'Pessoa já cadastrada como fiscal', id: existente.id }, 200);
      }
      const { data: novo, error } = await supabaseAdmin
        .from('fiscais')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPorId,
          suplente_id: suplenteId,
          lideranca_id: liderancaIdVinculada || body.lideranca_id,
          municipio_id: municipioId,
          status: 'Ativo',
          zona_fiscal: body.zona_fiscal,
          secao_fiscal: body.secao_fiscal,
          origem_captacao: 'visita_comite',
        } as any)
        .select('id').single();
      if (error) throw new Error(`Erro ao criar fiscal: ${error.message}`);
      console.log(`[receber-cadastro-externo] ✅ Fiscal criado: id=${novo!.id}, cadastrado_por=${cadastradoPorId}`);
      return jsonResp({ sucesso: true, tipo: 'fiscal', id: novo!.id, pessoa_id: pessoaId }, 201);
    }

    if (body.tipo === 'eleitor') {
      const { data: existente } = await supabaseAdmin
        .from('possiveis_eleitores').select('id').eq('pessoa_id', pessoaId).maybeSingle();
      if (existente) {
        return jsonResp({ aviso: 'Pessoa já cadastrada como eleitor', id: existente.id }, 200);
      }
      const { data: novo, error } = await supabaseAdmin
        .from('possiveis_eleitores')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPorId,
          suplente_id: suplenteId,
          lideranca_id: liderancaIdVinculada || body.lideranca_id,
          municipio_id: municipioId,
          compromisso_voto: body.compromisso_voto ?? 'Indefinido',
          origem_captacao: 'visita_comite',
        } as any)
        .select('id').single();
      if (error) throw new Error(`Erro ao criar eleitor: ${error.message}`);
      console.log(`[receber-cadastro-externo] ✅ Eleitor criado: id=${novo!.id}, cadastrado_por=${cadastradoPorId}`);
      return jsonResp({ sucesso: true, tipo: 'eleitor', id: novo!.id, pessoa_id: pessoaId }, 201);
    }

    return jsonResp({ erro: 'Tipo inválido' }, 400);
  } catch (error) {
    console.error('Erro em receber-cadastro-externo:', error);
    return jsonResp(
      { erro: error instanceof Error ? error.message : 'Erro interno do servidor' },
      500
    );
  }
});
