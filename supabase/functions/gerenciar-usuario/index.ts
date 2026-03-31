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
    const { acao, hierarquia_id, auth_user_id, novo_nome, nova_senha } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (acao === 'atualizar') {
      if (novo_nome) {
        const newEmail = novo_nome.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') + '@rede.sarelli.com';
        
        await supabaseAdmin.auth.admin.updateUserById(auth_user_id, { email: newEmail });
        await supabaseAdmin.from('hierarquia_usuarios').update({ nome: novo_nome.trim() }).eq('id', hierarquia_id);
      }

      if (nova_senha) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, { password: nova_senha });
        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário atualizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (acao === 'deletar') {
      await supabaseAdmin.from('hierarquia_usuarios').update({ ativo: false }).eq('id', hierarquia_id);
      await supabaseAdmin.auth.admin.deleteUser(auth_user_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário removido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
