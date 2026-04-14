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
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'diagnostico';
    const secret = body.secret;

    // Simple secret check to prevent unauthorized access
    if (secret !== 'sarelli-admin-2026') {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'atualizar_cargo') {
      const { nome_busca, cargo } = body;
      
      const { data: users } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, suplente_id, tipo')
        .ilike('nome', `%${nome_busca}%`)
        .eq('ativo', true);

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ ok: false, erro: 'Usuário não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const user = users[0];
      let updated = false;
      let detalhes = '';

      if (user.suplente_id) {
        const { error } = await supabaseAdmin
          .from('suplentes')
          .update({ cargo_disputado: cargo, updated_at: new Date().toISOString() })
          .eq('id', user.suplente_id);
        updated = !error;
        detalhes = error ? `Erro: ${error.message}` : `Atualizado suplente ${user.suplente_id}`;
      } else if (user.tipo === 'suplente') {
        const { error } = await supabaseAdmin
          .from('suplentes')
          .upsert({
            id: user.id,
            nome: user.nome,
            cargo_disputado: cargo,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (!error) {
          await supabaseAdmin
            .from('hierarquia_usuarios')
            .update({ suplente_id: user.id })
            .eq('id', user.id);
          updated = true;
          detalhes = `Criado suplente livre com cargo e vinculado`;
        } else {
          detalhes = `Erro: ${error.message}`;
        }
      }

      return new Response(JSON.stringify({ ok: updated, usuario: user, detalhes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default: diagnostic
    const [
      { data: usuarios },
      { count: totalLid },
      { count: totalEle },
      { count: totalFis },
      { data: suplentes },
    ] = await Promise.all([
      supabaseAdmin.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id, municipio_id, ativo').eq('ativo', true).order('nome'),
      supabaseAdmin.from('liderancas').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('possiveis_eleitores').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('fiscais').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('suplentes').select('id, nome, cargo_disputado'),
    ]);

    // Recent registrations (last 24h)
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [
      { data: recentLid, count: recentLidCount },
      { data: recentEle, count: recentEleCount },
      { data: recentFis, count: recentFisCount },
    ] = await Promise.all([
      supabaseAdmin.from('liderancas').select('id, cadastrado_por, criado_em', { count: 'exact' }).gte('criado_em', ontem),
      supabaseAdmin.from('possiveis_eleitores').select('id, cadastrado_por, criado_em', { count: 'exact' }).gte('criado_em', ontem),
      supabaseAdmin.from('fiscais').select('id, cadastrado_por, criado_em', { count: 'exact' }).gte('criado_em', ontem),
    ]);

    return new Response(JSON.stringify({
      usuarios_ativos: usuarios?.length || 0,
      lista_usuarios: usuarios,
      total_liderancas: totalLid || 0,
      total_eleitores: totalEle || 0,
      total_fiscais: totalFis || 0,
      recentes_24h: {
        liderancas: recentLidCount || 0,
        eleitores: recentEleCount || 0,
        fiscais: recentFisCount || 0,
      },
      suplentes_com_cargo: suplentes?.filter(s => s.cargo_disputado) || [],
      suplentes_todos: suplentes || [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ erro: error instanceof Error ? error.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
