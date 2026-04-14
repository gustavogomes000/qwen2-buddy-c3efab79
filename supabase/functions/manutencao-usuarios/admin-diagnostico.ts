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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'atualizar-cargo') {
      const { nome_busca, cargo } = body;
      // Find user in hierarquia
      const { data: users } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, suplente_id, tipo')
        .ilike('nome', `%${nome_busca}%`);
      
      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ ok: false, erro: 'Usuário não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const user = users[0];
      let updated = false;

      // If has suplente_id, update suplentes table
      if (user.suplente_id) {
        const { error } = await supabaseAdmin
          .from('suplentes')
          .update({ cargo_disputado: cargo, updated_at: new Date().toISOString() })
          .eq('id', user.suplente_id);
        updated = !error;
      }

      // If is a "livre" suplente (no suplente_id), create/update suplente record linked to themselves
      if (!user.suplente_id && user.tipo === 'suplente') {
        // Create a suplente record with the user's hierarquia id as suplente id
        const { error } = await supabaseAdmin
          .from('suplentes')
          .upsert({
            id: user.id,
            nome: user.nome,
            cargo_disputado: cargo,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        
        if (!error) {
          // Update hierarquia_usuarios to link to itself
          await supabaseAdmin
            .from('hierarquia_usuarios')
            .update({ suplente_id: user.id })
            .eq('id', user.id);
          updated = true;
        }
      }

      return new Response(JSON.stringify({ ok: updated, usuario: user }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default: diagnostic - list all users and counts
    const [
      { data: usuarios },
      { count: totalLid },
      { count: totalEle },
      { count: totalFis },
    ] = await Promise.all([
      supabaseAdmin.from('hierarquia_usuarios').select('id, nome, tipo, suplente_id, municipio_id, ativo').eq('ativo', true).order('nome'),
      supabaseAdmin.from('liderancas').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('possiveis_eleitores').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('fiscais').select('id', { count: 'exact', head: true }),
    ]);

    // Get suplentes with cargo_disputado
    const { data: suplentes } = await supabaseAdmin
      .from('suplentes')
      .select('id, nome, cargo_disputado');

    return new Response(JSON.stringify({
      usuarios: usuarios?.length || 0,
      lista_usuarios: usuarios,
      liderancas: totalLid || 0,
      eleitores: totalEle || 0,
      fiscais: totalFis || 0,
      suplentes_tags: suplentes?.filter(s => s.cargo_disputado) || [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ erro: error instanceof Error ? error.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
