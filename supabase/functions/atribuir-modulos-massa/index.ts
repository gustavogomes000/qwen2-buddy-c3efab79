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

    const body = await req.json().catch(() => ({}));
    const acao = body.acao || 'atribuir_modulos';

    if (acao === 'listar_usuarios') {
      // List all active users with their auth emails
      const { data: usuarios } = await supabaseAdmin
        .from('hierarquia_usuarios')
        .select('id, nome, tipo, auth_user_id, suplente_id')
        .eq('ativo', true)
        .in('tipo', ['suplente', 'lideranca'])
        .order('nome');

      const resultado = [];
      for (const u of (usuarios || [])) {
        if (!u.auth_user_id) continue;
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(u.auth_user_id);
        resultado.push({
          nome: u.nome,
          tipo: u.tipo,
          email_login: authUser?.user?.email || '—',
          login: u.nome, // login is the name
          senha: '12345',
        });
      }
      return new Response(
        JSON.stringify(resultado),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atribuir módulos padrão para todos suplentes e lideranças
    const modulos = ['cadastrar_liderancas', 'cadastrar_fiscais', 'cadastrar_eleitores'];

    const { data: usuarios } = await supabaseAdmin
      .from('hierarquia_usuarios')
      .select('id, nome, tipo')
      .eq('ativo', true)
      .in('tipo', ['suplente', 'lideranca'])
      .not('auth_user_id', 'is', null);

    let atribuidos = 0;
    let jaTemModulo = 0;

    for (const u of (usuarios || [])) {
      // Check existing modules
      const { data: existentes } = await supabaseAdmin
        .from('usuario_modulos')
        .select('modulo')
        .eq('usuario_id', u.id);

      const modulosExistentes = new Set((existentes || []).map((e: any) => e.modulo));
      const modulosFaltantes = modulos.filter(m => !modulosExistentes.has(m));

      if (modulosFaltantes.length === 0) {
        jaTemModulo++;
        continue;
      }

      const inserts = modulosFaltantes.map(modulo => ({
        usuario_id: u.id,
        modulo,
      }));

      const { error } = await supabaseAdmin.from('usuario_modulos').insert(inserts);
      if (!error) {
        atribuidos++;
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        usuarios_atualizados: atribuidos,
        ja_tinham_modulos: jaTemModulo,
        total: (usuarios || []).length,
        modulos_atribuidos: modulos,
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
