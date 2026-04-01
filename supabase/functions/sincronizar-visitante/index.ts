import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipo, nome, cpf, whatsapp, indicador_tipo, indicador_id } = body;

    if (!tipo || !nome) {
      return new Response(
        JSON.stringify({ erro: 'tipo e nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar ou criar pessoa
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
        // Atualizar dados se disponíveis
        const updates: Record<string, any> = {};
        if (whatsapp) updates.whatsapp = whatsapp;
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from('pessoas').update(updates).eq('id', pessoaId);
        }
      } else {
        const { data: nova, error } = await supabaseAdmin
          .from('pessoas')
          .insert({ nome, cpf: cpfLimpo, whatsapp: whatsapp || null })
          .select('id')
          .single();
        if (error) throw new Error(`Erro ao criar pessoa: ${error.message}`);
        pessoaId = nova.id;
      }
    } else {
      // Sem CPF válido — buscar por nome exato
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

    // 2. Resolver suplente_id e cadastrado_por do indicador
    let suplenteId: string | null = null;
    let cadastradoPor: string | null = null;
    let municipioId: string | null = null;

    if (indicador_tipo === 'suplente' && indicador_id) {
      suplenteId = indicador_id;
      // Buscar se há um usuário hierarquia vinculado a esse suplente
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
      // Buscar municipio via suplente_municipio
      if (!municipioId) {
        const { data: sm } = await supabaseAdmin
          .from('suplente_municipio')
          .select('municipio_id')
          .eq('suplente_id', indicador_id)
          .maybeSingle();
        if (sm) municipioId = sm.municipio_id;
      }
    } else if (indicador_tipo === 'lideranca' && indicador_id) {
      // Pode ser ID da hierarquia ou ID da tabela liderancas
      const { data: usuario } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, suplente_id, municipio_id')
        .eq('id', indicador_id)
        .eq('ativo', true)
        .maybeSingle();
      if (usuario) {
        cadastradoPor = usuario.id;
        suplenteId = usuario.suplente_id;
        municipioId = usuario.municipio_id;
      }
    }

    // 3. Inserir no tipo correto
    if (tipo === 'lideranca') {
      const { data: existente } = await supabaseAdmin
        .from('liderancas')
        .select('id')
        .eq('pessoa_id', pessoaId)
        .maybeSingle();
      if (existente) {
        return new Response(
          JSON.stringify({ acao: 'ja_existe', tipo: 'lideranca', id: existente.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: novo, error } = await supabaseAdmin
        .from('liderancas')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPor,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          status: 'Ativa',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar liderança: ${error.message}`);
      return new Response(
        JSON.stringify({ acao: 'criado', tipo: 'lideranca', id: novo.id, pessoa_id: pessoaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tipo === 'fiscal') {
      const { data: existente } = await supabaseAdmin
        .from('fiscais')
        .select('id')
        .eq('pessoa_id', pessoaId)
        .maybeSingle();
      if (existente) {
        return new Response(
          JSON.stringify({ acao: 'ja_existe', tipo: 'fiscal', id: existente.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: novo, error } = await supabaseAdmin
        .from('fiscais')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPor,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          status: 'Ativo',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar fiscal: ${error.message}`);
      return new Response(
        JSON.stringify({ acao: 'criado', tipo: 'fiscal', id: novo.id, pessoa_id: pessoaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tipo === 'eleitor') {
      const { data: existente } = await supabaseAdmin
        .from('possiveis_eleitores')
        .select('id')
        .eq('pessoa_id', pessoaId)
        .maybeSingle();
      if (existente) {
        return new Response(
          JSON.stringify({ acao: 'ja_existe', tipo: 'eleitor', id: existente.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: novo, error } = await supabaseAdmin
        .from('possiveis_eleitores')
        .insert({
          pessoa_id: pessoaId,
          cadastrado_por: cadastradoPor,
          suplente_id: suplenteId,
          municipio_id: municipioId,
          compromisso_voto: 'Indefinido',
          origem_captacao: 'visita_comite',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar eleitor: ${error.message}`);
      return new Response(
        JSON.stringify({ acao: 'criado', tipo: 'eleitor', id: novo.id, pessoa_id: pessoaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ erro: 'Tipo inválido. Use: lideranca, fiscal ou eleitor' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro sincronizar-visitante:', error);
    return new Response(
      JSON.stringify({ erro: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
