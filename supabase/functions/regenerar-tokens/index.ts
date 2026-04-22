import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function gerarToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await supabase
      .from('roles_usuarios')
      .select('cargo')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = roleData?.cargo === 'super_admin' || roleData?.cargo === 'admin';
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: usuarios, error: errUsr } = await supabase
      .from('hierarquia_usuarios')
      .select('id')
      .eq('ativo', true);

    if (errUsr) throw errUsr;

    let atualizados = 0;
    const erros: string[] = [];

    for (const u of usuarios || []) {
      const novoToken = gerarToken();
      const { error } = await supabase
        .from('hierarquia_usuarios')
        .update({ link_token: novoToken })
        .eq('id', u.id);
      if (error) erros.push(`${u.id}: ${error.message}`);
      else atualizados++;
    }

    return new Response(JSON.stringify({
      sucesso: true,
      total: usuarios?.length || 0,
      atualizados,
      erros,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});