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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active suplente/lideranca users
    const { data: usuarios } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo, auth_user_id, criado_em, suplente_id')
      .eq('ativo', true)
      .in('tipo', ['suplente', 'lideranca'])
      .order('nome')
      .order('criado_em', { ascending: true });

    // Group by name
    const groups: Record<string, any[]> = {};
    for (const u of (usuarios || [])) {
      const key = u.nome.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    }

    let removidos = 0;
    let authRemovidos = 0;
    const detalhes: any[] = [];

    for (const [nome, entries] of Object.entries(groups)) {
      if (entries.length <= 1) continue;

      // Keep the first one (oldest), remove the rest
      const [manter, ...duplicados] = entries;

      for (const dup of duplicados) {
        // Delete usuario_modulos for this user
        await supabaseAdmin
          .from('usuario_modulos')
          .delete()
          .eq('usuario_id', dup.id);

        // Deactivate hierarquia record
        await supabaseAdmin
          .from('hierarquia_usuarios')
          .update({ ativo: false })
          .eq('id', dup.id);

        // Delete auth user if exists
        if (dup.auth_user_id) {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(dup.auth_user_id);
          if (!error) authRemovidos++;
        }

        removidos++;
      }

      detalhes.push({
        nome: manter.nome,
        mantido_id: manter.id,
        duplicados_removidos: duplicados.length,
      });
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        registros_removidos: removidos,
        auth_users_removidos: authRemovidos,
        nomes_limpos: detalhes.length,
        detalhes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
